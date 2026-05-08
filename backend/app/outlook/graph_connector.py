"""Microsoft Graph API connector — works with New Outlook and Classic Outlook.

Required setup (one time):
1. Go to https://portal.azure.com → Azure Active Directory → App registrations
2. New registration → name "Control Tower IA" → Accounts in any org + personal
3. Authentication → Add platform → Mobile and desktop → tick the localhost redirect
4. API permissions → Add → Microsoft Graph → Delegated → Mail.Read → Add
5. Copy the Application (client) ID and paste it in config.py as GRAPH_CLIENT_ID
"""
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import msal
import httpx

from app.config import APP_DATA, DEFAULT_SYNC_DAYS

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
SCOPES = ["Mail.Read"]
AUTHORITY = "https://login.microsoftonline.com/common"
REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient"

TOKEN_CACHE_PATH = APP_DATA / "data" / "graph_token_cache.bin"
CLIENT_ID_PATH   = APP_DATA / "data" / "graph_client_id.txt"


def get_client_id() -> str | None:
    if CLIENT_ID_PATH.exists():
        val = CLIENT_ID_PATH.read_text().strip()
        return val if val else None
    return None


def save_client_id(client_id: str) -> None:
    CLIENT_ID_PATH.write_text(client_id.strip())


class GraphConnector:
    def __init__(self):
        self._cache = msal.SerializableTokenCache()
        if TOKEN_CACHE_PATH.exists():
            try:
                self._cache.deserialize(TOKEN_CACHE_PATH.read_text())
            except Exception:
                pass
        client_id = get_client_id()
        self._app = msal.PublicClientApplication(
            client_id or "placeholder",
            authority=AUTHORITY,
            token_cache=self._cache,
        ) if client_id else None

    def _save_cache(self) -> None:
        if self._cache.has_state_changed:
            TOKEN_CACHE_PATH.write_text(self._cache.serialize())

    def _rebuild_app(self) -> bool:
        client_id = get_client_id()
        if not client_id:
            return False
        self._app = msal.PublicClientApplication(
            client_id,
            authority=AUTHORITY,
            token_cache=self._cache,
        )
        return True

    # ── Auth ──────────────────────────────────────────────
    def start_device_flow(self) -> dict:
        if not self._app:
            if not self._rebuild_app():
                raise RuntimeError("Client ID no configurado.")
        flow = self._app.initiate_device_flow(scopes=SCOPES)
        if "error" in flow:
            raise RuntimeError(f"Error iniciando auth: {flow.get('error_description', flow['error'])}")
        return {
            "user_code":        flow["user_code"],
            "verification_uri": flow["verification_uri"],
            "message":          flow["message"],
            "_flow":            flow,   # kept server-side in memory
        }

    def complete_device_flow(self, flow: dict) -> bool:
        if not self._app:
            return False
        result = self._app.acquire_token_by_device_flow(flow)
        if "access_token" in result:
            self._save_cache()
            logger.info("Graph auth completed for account: %s",
                        result.get("id_token_claims", {}).get("preferred_username", "?"))
            return True
        logger.error("Graph auth failed: %s", result.get("error_description"))
        return False

    def get_token(self) -> str | None:
        if not self._app:
            return None
        accounts = self._app.get_accounts()
        if not accounts:
            return None
        result = self._app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            self._save_cache()
            return result["access_token"]
        return None

    def is_authenticated(self) -> bool:
        return self.get_token() is not None

    def logout(self) -> None:
        if self._app:
            for acc in self._app.get_accounts():
                self._app.remove_account(acc)
        if TOKEN_CACHE_PATH.exists():
            TOKEN_CACHE_PATH.unlink()

    # ── Sync ──────────────────────────────────────────────
    def sync_emails(self, days: int = DEFAULT_SYNC_DAYS) -> list[dict]:
        token = self.get_token()
        if not token:
            raise RuntimeError("No autenticado con Microsoft Graph. Iniciá sesión primero.")

        cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        emails: list[dict] = []
        seen: set[str] = set()

        headers = {"Authorization": f"Bearer {token}"}

        # Fetch all mail folders recursively
        folders = self._list_all_folders(headers)
        logger.info("Graph: found %d folders to scan", len(folders))

        for folder_id, folder_name in folders:
            self._scan_graph_folder(folder_id, folder_name, cutoff, headers, emails, seen)

        logger.info("Graph: synced %d logistics emails (last %d days)", len(emails), days)
        return emails

    def _list_all_folders(self, headers: dict) -> list[tuple[str, str]]:
        result = []
        try:
            resp = httpx.get(
                f"{GRAPH_BASE}/me/mailFolders?$top=50&includeHiddenFolders=true",
                headers=headers, timeout=15
            )
            resp.raise_for_status()
            for f in resp.json().get("value", []):
                result.append((f["id"], f["displayName"]))
                if f.get("childFolderCount", 0) > 0:
                    result.extend(self._list_child_folders(f["id"], f["displayName"], headers))
        except Exception as exc:
            logger.warning("Could not list folders: %s", exc)
        return result

    def _list_child_folders(self, parent_id: str, parent_name: str, headers: dict, depth: int = 0) -> list[tuple[str, str]]:
        if depth > 5:
            return []
        result = []
        try:
            resp = httpx.get(
                f"{GRAPH_BASE}/me/mailFolders/{parent_id}/childFolders?$top=50",
                headers=headers, timeout=10
            )
            resp.raise_for_status()
            for f in resp.json().get("value", []):
                name = f"{parent_name}/{f['displayName']}"
                result.append((f["id"], name))
                if f.get("childFolderCount", 0) > 0:
                    result.extend(self._list_child_folders(f["id"], name, headers, depth + 1))
        except Exception as exc:
            logger.debug("Child folder error: %s", exc)
        return result

    def _scan_graph_folder(
        self, folder_id: str, folder_name: str,
        cutoff: str, headers: dict,
        result: list[dict], seen: set[str]
    ) -> None:
        url = (
            f"{GRAPH_BASE}/me/mailFolders/{folder_id}/messages"
            f"?$top=50"
            f"&$filter=receivedDateTime ge {cutoff}"
            f"&$select=id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments"
            f"&$orderby=receivedDateTime desc"
        )
        from app.operations.extractor import is_logistics_email
        while url:
            try:
                resp = httpx.get(url, headers=headers, timeout=20)
                resp.raise_for_status()
                data = resp.json()
                for msg in data.get("value", []):
                    msg_id = msg["id"]
                    if msg_id in seen:
                        continue
                    seen.add(msg_id)
                    subject = msg.get("subject") or ""
                    body    = msg.get("body", {}).get("content") or msg.get("bodyPreview") or ""
                    if not is_logistics_email(subject, body[:1000]):
                        continue
                    result.append(self._normalize_message(msg, folder_name))
                url = data.get("@odata.nextLink")
            except Exception as exc:
                logger.warning("Folder %s scan error: %s", folder_name, exc)
                break

    @staticmethod
    def _normalize_message(msg: dict, folder_name: str) -> dict:
        received_raw = msg.get("receivedDateTime", "")
        try:
            received_dt = datetime.strptime(received_raw, "%Y-%m-%dT%H:%M:%SZ")
            received_iso = received_dt.isoformat()
        except Exception:
            received_iso = None

        body = msg.get("body", {}).get("content") or msg.get("bodyPreview") or ""
        # Strip HTML tags for plain-text body
        import re
        body_plain = re.sub(r"<[^>]+>", " ", body)[:8000]
        preview = body_plain[:300].replace("\n", " ").strip()

        sender_obj = msg.get("from", {}).get("emailAddress", {})
        sender = sender_obj.get("address") or sender_obj.get("name") or ""

        return {
            "entry_id":         msg["id"],
            "subject":          msg.get("subject") or "",
            "sender":           sender,
            "received_at":      received_iso,
            "body":             body_plain,
            "body_preview":     preview,
            "has_attachments":  msg.get("hasAttachments", False),
            "attachment_count": 0,
            "attachments":      [],
            "folder":           folder_name,
        }


# ── Module-level singleton ────────────────────────────────
_graph_connector: GraphConnector | None = None
_pending_flow: dict | None = None


def get_graph_connector() -> GraphConnector:
    global _graph_connector
    if _graph_connector is None:
        _graph_connector = GraphConnector()
    return _graph_connector


def set_pending_flow(flow: dict) -> None:
    global _pending_flow
    _pending_flow = flow


def get_pending_flow() -> dict | None:
    return _pending_flow
