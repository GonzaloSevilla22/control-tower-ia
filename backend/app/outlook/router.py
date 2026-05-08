"""Outlook API routes — sync and status."""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import EmailRecord, Operation, SyncLog
from app.outlook.connector import get_connector
from app.operations.extractor import extract_references, detect_status, detect_delays

logger = logging.getLogger(__name__)
router = APIRouter()


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
        conn        = get_connector()
        raw_emails  = conn.sync_emails(days=req.days)

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
