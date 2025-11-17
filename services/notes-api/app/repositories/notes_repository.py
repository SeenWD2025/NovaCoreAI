"""Data access layer for structured notes stored in PostgreSQL."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.database import healthcheck
from app.db_models import StructuredNote
from app.models.note import NoteCreate, NoteInDB, NoteResponse, NoteUpdate


class NotesRepository:
    """Repository encapsulating relational persistence for notes."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    async def _run(self, func, *args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)

    def _to_in_db(self, record: StructuredNote) -> NoteInDB:
        payload = {
            "noteId": record.note_id,
            "userId": record.user_id,
            "appId": record.app_id,
            "sessionId": record.session_id,
            "title": record.title,
            "components": record.components or [],
            "tags": record.tags or [],
            "retentionPolicyDays": record.retention_policy_days,
            "quizGenerationRequested": record.quiz_generation_requested,
            "metadata": record.metadata_json or {},
            "isDeleted": record.is_deleted,
            "deletedAt": record.deleted_at,
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }
        return NoteInDB.model_validate(payload)

    async def create(self, note: NoteCreate) -> NoteInDB:
        timestamp = datetime.now(timezone.utc)
        components = [component.model_dump(by_alias=True) for component in note.components]
        metadata = note.metadata.model_dump(by_alias=True)

        def _create() -> NoteInDB:
            session: Session = self._session_factory()
            try:
                record = StructuredNote(
                    note_id=str(uuid4()),
                    user_id=note.user_id,
                    app_id=note.app_id,
                    session_id=note.session_id,
                    title=note.title,
                    components=components,
                    tags=note.tags,
                    retention_policy_days=note.retention_policy_days,
                    quiz_generation_requested=note.quiz_generation_requested,
                    metadata_json=metadata,
                    is_deleted=note.is_deleted,
                    deleted_at=note.deleted_at,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
                session.add(record)
                session.commit()
                session.refresh(record)
                return self._to_in_db(record)
            finally:
                session.close()

        return await self._run(_create)

    async def get(self, note_id: str) -> Optional[NoteInDB]:
        def _get() -> Optional[NoteInDB]:
            session: Session = self._session_factory()
            try:
                record = session.get(StructuredNote, note_id)
                if record is None:
                    return None
                return self._to_in_db(record)
            finally:
                session.close()

        return await self._run(_get)

    async def list_by_user(
        self,
        user_id: str,
        app_id: Optional[str] = None,
        limit: int = 100,
        include_deleted: bool = False,
    ) -> List[NoteResponse]:
        def _list() -> List[NoteResponse]:
            session: Session = self._session_factory()
            try:
                stmt = select(StructuredNote).where(StructuredNote.user_id == user_id)
                if app_id:
                    stmt = stmt.where(StructuredNote.app_id == app_id)
                if not include_deleted:
                    stmt = stmt.where(StructuredNote.is_deleted.is_(False))
                stmt = stmt.order_by(StructuredNote.updated_at.desc()).limit(limit)
                records = session.execute(stmt).scalars().all()
                return [NoteResponse.model_validate(self._to_in_db(record).model_dump()) for record in records]
            finally:
                session.close()

        return await self._run(_list)

    async def update(self, note_id: str, update: NoteUpdate) -> Optional[NoteInDB]:
        payload = update.model_dump(by_alias=True, exclude_none=True)

        def _update() -> Optional[NoteInDB]:
            session: Session = self._session_factory()
            try:
                record = session.get(StructuredNote, note_id)
                if record is None:
                    return None

                if payload:
                    if "title" in payload:
                        record.title = payload["title"]
                    if "components" in payload:
                        record.components = payload["components"]
                    if "tags" in payload:
                        record.tags = payload["tags"]
                    if "retentionPolicyDays" in payload:
                        record.retention_policy_days = payload["retentionPolicyDays"]
                    if "quizGenerationRequested" in payload:
                        record.quiz_generation_requested = payload["quizGenerationRequested"]
                    if "metadata" in payload:
                        record.metadata_json = payload["metadata"]
                    if "isDeleted" in payload:
                        record.is_deleted = payload["isDeleted"]
                    if "deletedAt" in payload:
                        record.deleted_at = payload["deletedAt"]
                    record.updated_at = datetime.now(timezone.utc)
                    session.add(record)
                    session.commit()
                    session.refresh(record)
                return self._to_in_db(record)
            finally:
                session.close()

        return await self._run(_update)

    async def delete(self, note_id: str) -> bool:
        def _delete() -> bool:
            session: Session = self._session_factory()
            try:
                record = session.get(StructuredNote, note_id)
                if record is None:
                    return False
                record.is_deleted = True
                timestamp = datetime.now(timezone.utc)
                record.deleted_at = timestamp
                record.updated_at = timestamp
                session.add(record)
                session.commit()
                return True
            finally:
                session.close()

        return await self._run(_delete)

    async def health(self) -> bool:
        return await self._run(healthcheck)
