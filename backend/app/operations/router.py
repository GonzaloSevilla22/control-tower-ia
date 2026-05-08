"""Operations CRUD routes."""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import EmailRecord, Operation

logger = logging.getLogger(__name__)
router = APIRouter()


# ── List ──────────────────────────────────────────────────
@router.get("")
def list_operations(
    status: str | None = None,
    forwarder: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 25,
    db: Session = Depends(get_db),
):
    q = db.query(Operation)

    if status:
        q = q.filter(Operation.status == status)
    if forwarder:
        q = q.filter(Operation.forwarder.ilike(f"%{forwarder}%"))
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                Operation.so_number.ilike(term),
                Operation.bl_number.ilike(term),
                Operation.awb_number.ilike(term),
                Operation.op_internal.ilike(term),
                Operation.forwarder.ilike(term),
            )
        )

    total = q.count()
    items = (
        q.order_by(Operation.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "items": [_op_to_dict(op, db) for op in items]}


# ── Detail ────────────────────────────────────────────────
@router.get("/{op_id}")
def get_operation(op_id: int, db: Session = Depends(get_db)):
    op = db.query(Operation).filter(Operation.id == op_id).first()
    if not op:
        raise HTTPException(404, "Operación no encontrada")
    return _op_to_dict(op, db)


# ── Patch status ──────────────────────────────────────────
class StatusUpdate(BaseModel):
    status: str


@router.patch("/{op_id}/status")
def update_status(op_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    op = db.query(Operation).filter(Operation.id == op_id).first()
    if not op:
        raise HTTPException(404, "Operación no encontrada")
    op.status     = body.status
    op.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(op)
    return _op_to_dict(op, db)


# ── Helper ────────────────────────────────────────────────
def _op_to_dict(op: Operation, db: Session) -> dict:
    email_count = db.query(func.count(EmailRecord.id)).filter(EmailRecord.operation_id == op.id).scalar() or 0
    from app.database.models import Document
    doc_count   = db.query(func.count(Document.id)).filter(Document.operation_id == op.id).scalar() or 0

    def iso(d):
        return d.isoformat() if d else None

    return {
        "id":                  op.id,
        "so_number":           op.so_number,
        "delivery_numbers":    op.delivery_numbers or [],
        "bl_number":           op.bl_number,
        "awb_number":          op.awb_number,
        "op_internal":         op.op_internal,
        "status":              op.status,
        "pickup_scheduled":    iso(op.pickup_scheduled),
        "pickup_actual":       iso(op.pickup_actual),
        "etd_promised":        iso(op.etd_promised),
        "etd_actual":          iso(op.etd_actual),
        "eta_promised":        iso(op.eta_promised),
        "eta_actual":          iso(op.eta_actual),
        "forwarder":           op.forwarder,
        "tracking_references": op.tracking_references or {},
        "has_pending_docs":    op.has_pending_docs,
        "delay_causes":        op.delay_causes or [],
        "last_email_date":     iso(op.last_email_date),
        "email_count":         email_count,
        "doc_count":           doc_count,
        "created_at":          iso(op.created_at),
        "updated_at":          iso(op.updated_at),
    }
