"""FastAPI application — main entry point."""
from contextlib import asynccontextmanager
from datetime import datetime
import threading
import time

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import APP_NAME, APP_VERSION
from app.database.database import create_tables, get_db
from app.database.models import Operation, SyncLog
from app.outlook.router import router as outlook_router
from app.operations.router import router as operations_router
from app.documents.router import router as documents_router

# Outlook availability — checked in a background thread, never blocks requests
_outlook_status: dict = {"available": False, "checked_at": 0.0}
_outlook_lock = threading.Lock()


def _refresh_outlook_status() -> None:
    """Run in background thread every 30s — never called from a request handler."""
    while True:
        try:
            import pythoncom
            import win32com.client
            pythoncom.CoInitialize()
            ol = win32com.client.Dispatch("Outlook.Application")
            available = ol is not None
            pythoncom.CoUninitialize()
        except Exception:
            available = False
        with _outlook_lock:
            _outlook_status["available"] = available
            _outlook_status["checked_at"] = time.time()
        time.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    t = threading.Thread(target=_refresh_outlook_status, daemon=True)
    t.start()
    yield


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="API de automatización logística — Control Tower IA",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(outlook_router,     prefix="/api/outlook",     tags=["Outlook"])
app.include_router(operations_router,  prefix="/api/operations",  tags=["Operations"])
app.include_router(documents_router,   prefix="/api/documents",   tags=["Documents"])


# ── Health ────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    # Never blocks — Outlook status comes from background thread
    with _outlook_lock:
        outlook_ok = _outlook_status["available"]
    return {
        "status": "ok",
        "version": APP_VERSION,
        "outlook_available": outlook_ok,
        "db_ok": True,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Stats ─────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total  = db.query(func.count(Operation.id)).scalar() or 0
    active = db.query(func.count(Operation.id)).filter(
        Operation.status.notin_(["entregada_warehouse", "enviada_costeo"])
    ).scalar() or 0
    # JSON columns in SQLite are stored as text — use cast comparison
    from sqlalchemy import cast, String
    delayed = db.query(func.count(Operation.id)).filter(
        Operation.delay_causes.isnot(None),
        cast(Operation.delay_causes, String) != "[]",
        cast(Operation.delay_causes, String) != "null",
    ).scalar() or 0
    pending_docs = db.query(func.count(Operation.id)).filter(
        Operation.has_pending_docs == True  # noqa: E712
    ).scalar() or 0
    in_transit = db.query(func.count(Operation.id)).filter(
        Operation.status == "en_transito"
    ).scalar() or 0
    at_customs = db.query(func.count(Operation.id)).filter(
        Operation.status.in_(["detenida_aduana", "intervencion_aduana", "aprobado_aduana"])
    ).scalar() or 0
    delivered = db.query(func.count(Operation.id)).filter(
        Operation.status.in_(["entregada_warehouse", "enviada_costeo"])
    ).scalar() or 0

    last_sync = db.query(SyncLog.finished_at).filter(
        SyncLog.status == "ok"
    ).order_by(SyncLog.finished_at.desc()).scalar()

    return {
        "total_ops":   total,
        "active":      active,
        "delayed":     delayed,
        "pending_docs": pending_docs,
        "in_transit":  in_transit,
        "at_customs":  at_customs,
        "delivered":   delivered,
        "last_sync":   last_sync.isoformat() if last_sync else None,
    }


# ── Emails list ───────────────────────────────────────────
@app.get("/api/emails")
def list_emails(
    operation_id: int | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    from app.database.models import EmailRecord
    q = db.query(EmailRecord)
    if operation_id:
        q = q.filter(EmailRecord.operation_id == operation_id)
    total = q.count()
    items = q.order_by(EmailRecord.received_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [_email_to_dict(e) for e in items],
    }


def _email_to_dict(e) -> dict:
    return {
        "id":               e.id,
        "outlook_entry_id": e.outlook_entry_id,
        "operation_id":     e.operation_id,
        "subject":          e.subject,
        "sender":           e.sender,
        "received_at":      e.received_at.isoformat() if e.received_at else None,
        "body_preview":     e.body_preview,
        "has_attachments":  e.has_attachments,
        "attachment_count": e.attachment_count,
        "found_so":         e.found_so,
        "found_bl":         e.found_bl,
        "found_awb":        e.found_awb,
        "found_delivery":   e.found_delivery or [],
    }
