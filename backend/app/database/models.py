"""SQLAlchemy ORM models — full schema for all stages."""
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Integer, String, Text, JSON
)
from sqlalchemy.orm import relationship
from app.database.database import Base


class Operation(Base):
    __tablename__ = "operations"

    id                  = Column(Integer, primary_key=True, index=True)

    # ── Primary reference ─────────────────────────────────
    so_number           = Column(String, unique=True, index=True, nullable=False)

    # ── Secondary references ──────────────────────────────
    delivery_numbers    = Column(JSON, default=list)        # ["DN123", "DN456"]
    bl_number           = Column(String, nullable=True, index=True)
    awb_number          = Column(String, nullable=True, index=True)
    op_internal         = Column(String, nullable=True, index=True)

    # ── Status ────────────────────────────────────────────
    status              = Column(String, default="desconocido", index=True)

    # ── Dates ─────────────────────────────────────────────
    pickup_scheduled    = Column(DateTime, nullable=True)
    pickup_actual       = Column(DateTime, nullable=True)
    etd_promised        = Column(DateTime, nullable=True)
    etd_actual          = Column(DateTime, nullable=True)
    eta_promised        = Column(DateTime, nullable=True)
    eta_actual          = Column(DateTime, nullable=True)

    # ── Logistics info ────────────────────────────────────
    forwarder           = Column(String, nullable=True)
    tracking_references = Column(JSON, default=dict)        # {"carrier": "MAEU1234"}

    # ── Flags ─────────────────────────────────────────────
    has_pending_docs    = Column(Boolean, default=False)
    delay_causes        = Column(JSON, default=list)        # ["falta_documentacion", ...]

    # ── Metadata ──────────────────────────────────────────
    last_email_date     = Column(DateTime, nullable=True)
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────
    emails      = relationship("EmailRecord",  back_populates="operation", cascade="all, delete-orphan")
    documents   = relationship("Document",     back_populates="operation", cascade="all, delete-orphan")
    ai_suggestions = relationship("AISuggestion", back_populates="operation", cascade="all, delete-orphan")


class EmailRecord(Base):
    __tablename__ = "emails"

    id                  = Column(Integer, primary_key=True, index=True)
    outlook_entry_id    = Column(String, unique=True, index=True, nullable=False)
    operation_id        = Column(Integer, ForeignKey("operations.id"), nullable=True, index=True)

    subject             = Column(String, nullable=False, default="")
    sender              = Column(String, nullable=True)
    received_at         = Column(DateTime, nullable=True, index=True)
    body_text           = Column(Text, nullable=True)
    body_preview        = Column(String(500), nullable=True)

    # ── Extracted references ──────────────────────────────
    found_so            = Column(String, nullable=True)
    found_bl            = Column(String, nullable=True)
    found_awb           = Column(String, nullable=True)
    found_delivery      = Column(JSON, default=list)
    found_op            = Column(String, nullable=True)

    has_attachments     = Column(Boolean, default=False)
    attachment_count    = Column(Integer, default=0)

    created_at          = Column(DateTime, default=datetime.utcnow)

    operation   = relationship("Operation", back_populates="emails")
    documents   = relationship("Document",  back_populates="email")


class Document(Base):
    __tablename__ = "documents"

    id              = Column(Integer, primary_key=True, index=True)
    operation_id    = Column(Integer, ForeignKey("operations.id"), nullable=False, index=True)
    email_id        = Column(Integer, ForeignKey("emails.id"), nullable=True)

    filename        = Column(String, nullable=False)
    file_path       = Column(String, nullable=False)
    doc_type        = Column(String, nullable=True)         # invoice, packing_list, bl, awb, etc.
    file_size       = Column(Integer, nullable=True)
    file_hash       = Column(String, nullable=True)         # MD5 for deduplication

    created_at      = Column(DateTime, default=datetime.utcnow)

    operation   = relationship("Operation",   back_populates="documents")
    email       = relationship("EmailRecord", back_populates="documents")


class AISuggestion(Base):
    """Copilot IA suggestions — Stage 5."""
    __tablename__ = "ai_suggestions"

    id              = Column(Integer, primary_key=True, index=True)
    operation_id    = Column(Integer, ForeignKey("operations.id"), nullable=False, index=True)

    trigger         = Column(String, nullable=True)         # what caused the suggestion
    suggestion_text = Column(Text, nullable=False)
    priority        = Column(String, default="medium")      # low / medium / high / critical
    action_type     = Column(String, nullable=True)         # follow_up / request_doc / escalate / etc.
    resolved        = Column(Boolean, default=False)

    created_at      = Column(DateTime, default=datetime.utcnow)
    resolved_at     = Column(DateTime, nullable=True)

    operation   = relationship("Operation", back_populates="ai_suggestions")


class SyncLog(Base):
    """History of Outlook sync runs."""
    __tablename__ = "sync_logs"

    id              = Column(Integer, primary_key=True, index=True)
    started_at      = Column(DateTime, default=datetime.utcnow)
    finished_at     = Column(DateTime, nullable=True)
    emails_synced   = Column(Integer, default=0)
    new_operations  = Column(Integer, default=0)
    updated_ops     = Column(Integer, default=0)
    errors          = Column(Integer, default=0)
    duration_secs   = Column(Integer, nullable=True)
    status          = Column(String, default="running")     # running / ok / error
