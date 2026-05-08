"""Outlook connector via win32com (local Outlook desktop app)."""
import logging
from datetime import datetime, timedelta
from typing import Any

import pythoncom
import win32com.client

from app.config import DEFAULT_SYNC_DAYS
from app.operations.extractor import is_logistics_email

logger = logging.getLogger(__name__)


class OutlookConnector:
    def __init__(self):
        self._outlook = None
        self._namespace = None

    # ── Connection ────────────────────────────────────────
    def connect(self) -> bool:
        try:
            pythoncom.CoInitialize()
            self._outlook   = win32com.client.Dispatch("Outlook.Application")
            self._namespace = self._outlook.GetNamespace("MAPI")
            return True
        except Exception as exc:
            logger.error("Outlook connect error: %s", exc)
            return False

    def get_account_info(self) -> dict:
        try:
            if not self._namespace:
                self.connect()
            account = self._namespace.Accounts.Item(1)
            return {
                "connected":    True,
                "email":        str(account.SmtpAddress),
                "display_name": str(account.DisplayName),
                "folders_count": self._namespace.Folders.Count,
            }
        except Exception as exc:
            logger.warning("Could not get account info: %s", exc)
            return {"connected": False, "email": None, "display_name": None, "folders_count": 0}

    # ── Sync ──────────────────────────────────────────────
    def sync_emails(self, days: int = DEFAULT_SYNC_DAYS) -> list[dict]:
        if not self._namespace:
            if not self.connect():
                raise RuntimeError("No se pudo conectar a Outlook. ¿Está abierto?")

        cutoff = datetime.now() - timedelta(days=days)
        emails: list[dict] = []

        inbox = self._namespace.GetDefaultFolder(6)     # olFolderInbox = 6
        self._scan_folder(inbox, cutoff, emails)

        # Also scan Sent Items
        try:
            sent = self._namespace.GetDefaultFolder(5)  # olFolderSentMail = 5
            self._scan_folder(sent, cutoff, emails)
        except Exception:
            pass

        logger.info("Scanned %d emails (last %d days)", len(emails), days)
        return emails

    def _scan_folder(self, folder, cutoff: datetime, result: list[dict]) -> None:
        try:
            messages = folder.Items
            messages.Sort("[ReceivedTime]", True)    # newest first
            for msg in messages:
                try:
                    # Sent items may have ReceivedTime = None; fall back to SentOn
                    received = _com_date(msg.ReceivedTime) or _com_date(getattr(msg, 'SentOn', None))
                    if received and received < cutoff:
                        break       # items are sorted desc; stop when too old
                    data = self._extract_message(msg)
                    if data and is_logistics_email(data["subject"], data["body"]):
                        result.append(data)
                except Exception as exc:
                    logger.debug("Skip message: %s", exc)
        except Exception as exc:
            logger.warning("Folder scan error: %s", exc)

    def _extract_message(self, msg) -> dict | None:
        try:
            entry_id    = str(msg.EntryID or "")
            subject     = str(msg.Subject or "")
            sender      = str(getattr(msg, "SenderEmailAddress", "") or msg.SenderName or "")
            received    = _com_date(msg.ReceivedTime) or _com_date(getattr(msg, 'SentOn', None))
            body        = str(msg.Body or "")[:8000]    # cap to 8 KB

            attachments = []
            att_count   = msg.Attachments.Count
            if att_count:
                for att in msg.Attachments:
                    try:
                        attachments.append({
                            "filename": str(att.FileName),
                            "size":     int(att.Size),
                        })
                    except Exception:
                        pass

            return {
                "entry_id":         entry_id,
                "subject":          subject,
                "sender":           sender,
                "received_at":      received.isoformat() if received else None,
                "body":             body,
                "body_preview":     body[:300].replace("\n", " ").strip(),
                "has_attachments":  att_count > 0,
                "attachment_count": att_count,
                "attachments":      attachments,
            }
        except Exception as exc:
            logger.debug("Extract message error: %s", exc)
            return None

    # ── Attachment download ───────────────────────────────
    def download_attachment(self, entry_id: str, filename: str, save_path: str) -> bool:
        try:
            if not self._namespace:
                self.connect()
            msg = self._namespace.GetItemFromID(entry_id)
            for att in msg.Attachments:
                if str(att.FileName) == filename:
                    att.SaveAsFile(save_path)
                    return True
        except Exception as exc:
            logger.error("Download attachment error: %s", exc)
        return False

    # ── Helpers ───────────────────────────────────────────
    @staticmethod
    def _is_logistics_email(subject: str, body: str) -> bool:
        text = (subject + " " + body[:2000]).lower()
        return any(kw.lower() in text for kw in LOGISTICS_KEYWORDS)


def _com_date(com_dt: Any) -> datetime | None:
    """Convert a COM DATETIME (pywintypes) to a plain Python datetime."""
    if com_dt is None:
        return None
    try:
        return datetime(
            com_dt.year, com_dt.month, com_dt.day,
            com_dt.hour, com_dt.minute, com_dt.second
        )
    except Exception:
        return None


# ── Module-level singleton ────────────────────────────────
_connector: OutlookConnector | None = None


def get_connector() -> OutlookConnector:
    global _connector
    if _connector is None:
        _connector = OutlookConnector()
    return _connector
