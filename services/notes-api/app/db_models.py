"""SQLAlchemy models for the Notes API."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.config import settings
from app.database import Base


class StructuredNote(Base):
    """Structured note persisted in PostgreSQL."""

    __tablename__ = settings.notes_table

    note_id = Column(String, primary_key=True, nullable=False)
    user_id = Column(String, nullable=False, index=True)
    app_id = Column(String, nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    title = Column(String(250), nullable=False)
    components = Column(JSONB, nullable=False, default=list)
    tags = Column(JSONB, nullable=False, default=list)
    retention_policy_days = Column(Integer, nullable=False, default=365)
    quiz_generation_requested = Column(Boolean, nullable=False, default=False)
    metadata_json = Column("metadata", JSONB, nullable=False, default=dict)
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"StructuredNote(note_id={self.note_id!r}, title={self.title!r})"
