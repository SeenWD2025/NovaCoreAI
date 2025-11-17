"""PostgreSQL repository for persisting generated quizzes."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Dict, Optional
from uuid import uuid4

from sqlalchemy.orm import Session, sessionmaker

from ..db_models import QuizArtifactRecord
from ..models.quiz import QuizGenerationRequest, QuizResult


class QuizRepository:
    """Persist quiz artifacts for downstream consumption."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    async def _run(self, func, *args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)

    def _build_metadata(self, request: QuizGenerationRequest, provider_quiz_id: str) -> Dict[str, object]:
        return {
            "topics": request.note_context.topics,
            "tags": request.note_context.tags,
            "difficulty": request.note_context.difficulty,
            "noteTitle": request.note_context.title,
            "providerRawId": provider_quiz_id,
            "noteMetadata": request.note_context.metadata,
        }

    async def save_quiz(
        self,
        request: QuizGenerationRequest,
        quiz: QuizResult,
        provider_quiz_id: str,
    ) -> str:
        artifact_id = quiz.quiz_id or str(uuid4())
        timestamp = datetime.now(timezone.utc)
        questions = [question.model_dump(by_alias=True) for question in quiz.questions]
        reflection: Optional[dict] = quiz.reflection.model_dump(by_alias=True) if quiz.reflection else None
        metadata = self._build_metadata(request, provider_quiz_id)
        requested_types = [t.value for t in request.question_types] if request.question_types else None
        question_types = [question.type.value for question in quiz.questions]

        def _persist() -> str:
            session: Session = self._session_factory()
            try:
                record = session.get(QuizArtifactRecord, artifact_id)
                if record is None:
                    record = QuizArtifactRecord(quiz_id=artifact_id, created_at=timestamp)

                record.provider = quiz.provider
                record.note_id = request.note_context.note_id
                record.app_id = request.note_context.app_id
                record.user_id = request.note_context.user_id
                record.session_id = request.note_context.session_id
                record.question_count = len(quiz.questions)
                record.requested_question_count = request.question_count
                record.requested_question_types = requested_types
                record.question_types = question_types
                record.include_reflection = request.include_reflection
                record.questions = questions
                record.reflection = reflection
                record.metadata_json = metadata
                record.updated_at = timestamp

                session.add(record)
                session.commit()
                return artifact_id
            finally:
                session.close()

        return await self._run(_persist)