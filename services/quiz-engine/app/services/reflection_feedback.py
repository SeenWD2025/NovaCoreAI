"""Service for handling quiz reflection feedback."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict
from uuid import uuid4

from ..models.reflection_feedback import (
    ReflectionFeedbackCreateRequest,
    ReflectionFeedbackRecord,
    ReflectionFeedbackResponse,
)
from ..repositories.quiz_session_repository import QuizSessionRepository
from ..repositories.reflection_feedback_repository import ReflectionFeedbackRepository
from .errors import (
    QuizOwnershipMismatchError,
    QuizSessionNotFoundError,
    ReflectionFeedbackPersistenceError,
    ReflectionFeedbackValidationError,
)


class ReflectionFeedbackService:
    """Coordinate validation and persistence for reflection feedback."""

    def __init__(
        self,
        session_repository: QuizSessionRepository,
        feedback_repository: ReflectionFeedbackRepository,
    ) -> None:
        self._session_repository = session_repository
        self._feedback_repository = feedback_repository

    async def submit_feedback(
        self,
        session_id: str,
        request: ReflectionFeedbackCreateRequest,
    ) -> ReflectionFeedbackResponse:
        session_record = await self._session_repository.get_session(session_id)
        if session_record is None:
            raise QuizSessionNotFoundError(f"Quiz session {session_id} was not found")

        if request.session_id and request.session_id != session_id:
            raise ReflectionFeedbackValidationError("Feedback sessionId does not match route parameter")

        if request.quiz_id != session_record.quiz_id:
            raise ReflectionFeedbackValidationError("Feedback quizId does not match session quiz")

        if request.user_id != session_record.user_id:
            raise QuizOwnershipMismatchError("Feedback user does not match session owner")

        if request.app_id != session_record.app_id:
            raise QuizOwnershipMismatchError("Feedback app does not match session owner")

        if session_record.results is None:
            raise ReflectionFeedbackValidationError("Cannot submit feedback before results are available")

        if request.note_id and session_record.note_id and request.note_id != session_record.note_id:
            raise ReflectionFeedbackValidationError("Feedback noteId does not match session note")

        existing = await self._feedback_repository.get_by_session(session_id)
        now = datetime.now(timezone.utc)
        created_at = existing.created_at if existing else now
        submitted_at = request.submitted_at or now
        note_id = request.note_id or session_record.note_id

        metadata: Dict[str, object] = {}
        if existing and existing.metadata:
            metadata.update(existing.metadata)
        if request.metadata:
            metadata.update(request.metadata)

        record = ReflectionFeedbackRecord(
            feedbackId=existing.feedback_id if existing else str(uuid4()),
            sessionId=session_id,
            quizId=session_record.quiz_id,
            appId=session_record.app_id,
            userId=session_record.user_id,
            noteId=note_id,
            quizRating=request.quiz_rating,
            recommendationRating=request.recommendation_rating,
            notes=request.notes,
            metadata=metadata,
            submittedAt=submitted_at,
            createdAt=created_at,
            updatedAt=now,
            isDeleted=False,
            deletedAt=None,
        )

        try:
            stored = await self._feedback_repository.upsert_feedback(record)
        except Exception as exc:  # pragma: no cover - surfaced as domain error
            raise ReflectionFeedbackPersistenceError("Failed to persist reflection feedback") from exc

        return ReflectionFeedbackResponse(feedback=stored)
