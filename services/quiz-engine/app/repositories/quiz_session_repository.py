"""PostgreSQL repository for quiz session persistence."""
from __future__ import annotations

import asyncio
from typing import Optional

from sqlalchemy.orm import Session, sessionmaker

from ..db_models import QuizSessionRecordORM
from ..models.quiz_session import QuizSessionRecord


class QuizSessionRepository:
    """Create and retrieve quiz sessions."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    async def _run(self, func, *args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)

    async def create_session(self, record: QuizSessionRecord) -> None:
        payload = record.model_dump(by_alias=True)
        payload["quizSnapshot"] = record.quiz_snapshot.model_dump(by_alias=True)

        def _create() -> None:
            session: Session = self._session_factory()
            try:
                db_record = QuizSessionRecordORM(
                    session_id=payload["sessionId"],
                    quiz_id=payload["quizId"],
                    app_id=payload["appId"],
                    user_id=payload["userId"],
                    note_id=payload.get("noteId"),
                    status=payload.get("status", "in_progress"),
                    created_at=payload.get("createdAt"),
                    updated_at=payload.get("updatedAt"),
                    is_deleted=payload.get("isDeleted", False),
                    deleted_at=payload.get("deletedAt"),
                    metadata_json=payload.get("metadata") or {},
                    quiz_snapshot=payload["quizSnapshot"],
                    answers=payload.get("answers", []),
                    results=payload.get("results"),
                )
                session.merge(db_record)
                session.commit()
            finally:
                session.close()

        await self._run(_create)

    async def get_session(self, session_id: str) -> Optional[QuizSessionRecord]:
        def _get() -> Optional[QuizSessionRecord]:
            session: Session = self._session_factory()
            try:
                record = session.get(QuizSessionRecordORM, session_id)
                if record is None:
                    return None
                payload = {
                    "sessionId": record.session_id,
                    "quizId": record.quiz_id,
                    "appId": record.app_id,
                    "userId": record.user_id,
                    "noteId": record.note_id,
                    "status": record.status,
                    "createdAt": record.created_at,
                    "updatedAt": record.updated_at,
                    "isDeleted": record.is_deleted,
                    "deletedAt": record.deleted_at,
                    "metadata": record.metadata_json or {},
                    "quizSnapshot": record.quiz_snapshot,
                    "answers": record.answers or [],
                    "results": record.results,
                }
                return QuizSessionRecord(**payload)
            finally:
                session.close()

        return await self._run(_get)
