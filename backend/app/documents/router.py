"""Document management routes — list, download attachments from Outlook."""
import hashlib
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import DOCS_DIR
from app.database.database import get_db
from app.database.models import Document, EmailRecord, Operation
from app.operations.extractor import classify_document
from app.outlook.connector import get_connector

logger = logging.getLogger(__name__)
router = APIRouter()


# ── List ──────────────────────────────────────────────────
@router.get("")
def list_documents(
    operation_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Document)
    if operation_id:
        q = q.filter(Document.operation_id == operation_id)
    items = q.order_by(Document.created_at.desc()).all()
    return {"items": [_doc_to_dict(d) for d in items]}


# ── Download attachment ───────────────────────────────────
class DownloadRequest(BaseModel):
    email_entry_id: str
    filename: str
    operation_id: int


@router.post("/download")
def download_attachment(req: DownloadRequest, db: Session = Depends(get_db)):
    op = db.query(Operation).filter(Operation.id == req.operation_id).first()
    if not op:
        raise HTTPException(404, "Operación no encontrada")

    # Build folder path: docs_storage / SO-XXXXX /
    op_folder = DOCS_DIR / op.so_number
    op_folder.mkdir(parents=True, exist_ok=True)

    save_path = op_folder / req.filename

    # Check for duplicate by name
    existing = db.query(Document).filter(
        Document.operation_id == req.operation_id,
        Document.filename     == req.filename,
    ).first()
    if existing:
        return {"file_path": existing.file_path, "duplicate": True}

    # Download via Outlook connector
    conn = get_connector()
    ok   = conn.download_attachment(req.email_entry_id, req.filename, str(save_path))
    if not ok:
        raise HTTPException(500, f"No se pudo descargar el adjunto '{req.filename}'")

    # Hash for future dedup
    file_hash = None
    try:
        file_hash = hashlib.md5(save_path.read_bytes()).hexdigest()

        # Check dedup by hash
        dup = db.query(Document).filter(
            Document.operation_id == req.operation_id,
            Document.file_hash    == file_hash,
        ).first()
        if dup:
            save_path.unlink(missing_ok=True)
            return {"file_path": dup.file_path, "duplicate": True}
    except Exception:
        pass

    # Find linked email
    email = db.query(EmailRecord).filter(
        EmailRecord.outlook_entry_id == req.email_entry_id
    ).first()

    doc = Document(
        operation_id = req.operation_id,
        email_id     = email.id if email else None,
        filename     = req.filename,
        file_path    = str(save_path),
        doc_type     = classify_document(req.filename),
        file_size    = save_path.stat().st_size if save_path.exists() else None,
        file_hash    = file_hash,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {"file_path": str(save_path), "duplicate": False}


# ── Helper ────────────────────────────────────────────────
def _doc_to_dict(d: Document) -> dict:
    return {
        "id":           d.id,
        "operation_id": d.operation_id,
        "email_id":     d.email_id,
        "filename":     d.filename,
        "file_path":    d.file_path,
        "doc_type":     d.doc_type,
        "file_size":    d.file_size,
        "created_at":   d.created_at.isoformat() if d.created_at else None,
    }
