"""Outlook API routes — sync and status."""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import EmailRecord, Operation, SyncLog
from app.outlook.connector import get_connector
from app.outlook.graph_connector import (
    get_graph_connector, get_client_id, save_client_id,
    set_pending_flow, get_pending_flow,
)
from app.operations.extractor import extract_references, detect_status, detect_delays, is_logistics_email

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Debug scan ───────────────────────────────────────────
@router.get("/debug-scan")
def debug_scan(days: int = 7):
    """Returns raw email subjects before and after the logistics filter.
    Use this to diagnose why sync finds 0 emails.
    """
    try:
        conn = get_connector()
        if not conn._namespace:
            conn.connect()

        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)

        from app.outlook.connector import _com_date

        total_found = 0
        passed_filter = 0
        rejected_samples: list[str] = []
        passed_samples: list[str] = []
        folders_scanned: list[str] = []

        def scan_folder_debug(folder, depth=0):
            nonlocal total_found, passed_filter
            if depth > 6:
                return
            try:
                name = str(folder.Name)
                folders_scanned.append("  " * depth + name)
                messages = folder.Items
                messages.Sort("[ReceivedTime]", True)
                for msg in messages:
                    try:
                        received = _com_date(msg.ReceivedTime) or _com_date(getattr(msg, 'SentOn', None))
                        if received and received < cutoff:
                            break
                        subject = str(msg.Subject or "")
                        body_preview = str(msg.Body or "")[:300]
                        total_found += 1
                        if is_logistics_email(subject, body_preview):
                            passed_filter += 1
                            if len(passed_samples) < 5:
                                passed_samples.append(subject)
                        else:
                            if len(rejected_samples) < 10:
                                rejected_samples.append(subject)
                    except Exception:
                        pass
            except Exception:
                pass
            try:
                for sub in folder.Folders:
                    scan_folder_debug(sub, depth + 1)
            except Exception:
                pass

        try:
            root = conn._namespace.GetDefaultFolder(6).Parent
            scan_folder_debug(root)
        except Exception:
            inbox = conn._namespace.GetDefaultFolder(6)
            scan_folder_debug(inbox)

        return {
            "days_scanned": days,
            "total_emails_in_inbox": total_found,
            "passed_filter": passed_filter,
            "rejected_samples": rejected_samples,
            "passed_samples": passed_samples,
            "folders_scanned": folders_scanned[:30],
        }
    except Exception as exc:
        return {"error": str(exc)}


# ── Graph auth ───────────────────────────────────────────

class ClientIdRequest(BaseModel):
    client_id: str

@router.post("/graph/setup")
def graph_setup(req: ClientIdRequest):
    save_client_id(req.client_id)
    return {"ok": True}

@router.get("/graph/auth-status")
def graph_auth_status():
    gc = get_graph_connector()
    return {
        "client_id_configured": get_client_id() is not None,
        "authenticated": gc.is_authenticated(),
    }

@router.post("/graph/start-login")
def graph_start_login():
    gc = get_graph_connector()
    try:
        flow = gc.start_device_flow()
        inner = flow.pop("_flow")
        set_pending_flow(inner)
        return flow   # user_code, verification_uri, message
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/graph/complete-login")
def graph_complete_login():
    flow = get_pending_flow()
    if not flow:
        raise HTTPException(status_code=400, detail="No hay un login pendiente. Iniciá el proceso de nuevo.")
    gc = get_graph_connector()
    ok = gc.complete_device_flow(flow)
    if ok:
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Autenticación fallida o expirada. Intentá de nuevo.")

@router.post("/graph/logout")
def graph_logout():
    get_graph_connector().logout()
    return {"ok": True}


# ── Status ────────────────────────────────────────────────
@router.get("/status")
def outlook_status():
    try:
        conn = get_connector()
        info = conn.get_account_info()
        return info
    except Exception as exc:
        return {"connected": False, "email": None, "display_name": None, "folders_count": 0, "error": str(exc)}


# ── Sync ──────────────────────────────────────────────────
class SyncRequest(BaseModel):
    days: int = 30


@router.post("/sync")
def sync_outlook(req: SyncRequest, db: Session = Depends(get_db)):
    log = SyncLog(started_at=datetime.utcnow(), status="running")
    db.add(log)
    db.commit()

    try:
        gc = get_graph_connector()
        if gc.is_authenticated():
            raw_emails = gc.sync_emails(days=req.days)
        else:
            conn = get_connector()
            raw_emails = conn.sync_emails(days=req.days)

        new_ops     = 0
        updated     = 0
        errors      = 0

        for raw in raw_emails:
            try:
                _process_email(raw, db)
                # Count new vs updated after commit
            except Exception as exc:
                logger.warning("Error processing email %s: %s", raw.get("entry_id", "?"), exc)
                errors += 1

        db.commit()

        # Count results
        synced_count = len(raw_emails)
        all_new  = db.query(SyncLog).filter(SyncLog.id == log.id).first()

        # Update log
        finished = datetime.utcnow()
        log.finished_at   = finished
        log.emails_synced = synced_count
        log.errors        = errors
        log.duration_secs = int((finished - log.started_at).total_seconds())
        log.status        = "ok"
        db.commit()

        return {
            "synced":           synced_count,
            "new_operations":   new_ops,
            "updated":          updated,
            "errors":           errors,
            "duration_seconds": log.duration_secs,
        }

    except Exception as exc:
        log.status = "error"
        db.commit()
        logger.error("Sync failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al sincronizar Outlook: {exc}")


# ── Internal helpers ──────────────────────────────────────

def _process_email(raw: dict, db: Session) -> None:
    entry_id = raw["entry_id"]
    if not entry_id:
        return

    # Skip already imported emails
    existing = db.query(EmailRecord).filter(EmailRecord.outlook_entry_id == entry_id).first()
    if existing:
        return

    # Extract references from subject + body
    refs = extract_references(raw["subject"], raw["body"])

    # Parse received_at
    received_at = None
    if raw.get("received_at"):
        try:
            received_at = datetime.fromisoformat(raw["received_at"])
        except ValueError:
            pass

    email = EmailRecord(
        outlook_entry_id = entry_id,
        subject          = raw["subject"],
        sender           = raw.get("sender", ""),
        received_at      = received_at,
        body_text        = raw.get("body", ""),
        body_preview     = raw.get("body_preview", "")[:300],
        has_attachments  = raw.get("has_attachments", False),
        attachment_count = raw.get("attachment_count", 0),
        found_so         = refs.get("so_number"),
        found_bl         = refs.get("bl_number"),
        found_awb        = refs.get("awb_number"),
        found_delivery   = refs.get("delivery_numbers", []),
        found_op         = refs.get("op_internal"),
    )
    db.add(email)
    db.flush()  # get email.id

    # Link to operation (or create new one)
    so = refs.get("so_number")
    if so:
        subject = raw.get("subject", "")
        body    = raw.get("body", "")
        op = db.query(Operation).filter(Operation.so_number == so).first()
        if not op:
            op = _create_operation(so, refs, subject, body, db)
        else:
            _update_operation(op, refs, subject, body, received_at)
        email.operation_id = op.id
        db.flush()


def _create_operation(so: str, refs: dict, subject: str, body: str, db: Session) -> Operation:
    status      = detect_status(subject, body) or "desconocido"
    delay_causes = detect_delays(subject, body)

    op = Operation(
        so_number           = so,
        bl_number           = refs.get("bl_number"),
        awb_number          = refs.get("awb_number"),
        op_internal         = refs.get("op_internal"),
        delivery_numbers    = refs.get("delivery_numbers", []),
        forwarder           = refs.get("forwarder"),
        status              = status,
        delay_causes        = delay_causes,
        tracking_references = {},
    )
    db.add(op)
    db.flush()
    return op


def _update_operation(op: Operation, refs: dict, subject: str, body: str, received_at) -> None:
    if refs.get("bl_number") and not op.bl_number:
        op.bl_number = refs["bl_number"]
    if refs.get("awb_number") and not op.awb_number:
        op.awb_number = refs["awb_number"]
    if refs.get("forwarder") and not op.forwarder:
        op.forwarder = refs["forwarder"]
    if refs.get("delivery_numbers"):
        existing = set(op.delivery_numbers or [])
        existing.update(refs["delivery_numbers"])
        op.delivery_numbers = list(existing)
    if received_at:
        if not op.last_email_date or received_at > op.last_email_date:
            op.last_email_date = received_at
    op.updated_at = datetime.utcnow()
