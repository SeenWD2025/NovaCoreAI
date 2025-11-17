"""Service for managing quiz sessions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from ..models.quiz_artifact import ArtifactQuestion, QuizArtifact
from ..models.quiz_session import (
    QuizSessionCreateRequest,
    QuizSessionRecord,
    QuizSessionResponse,
    QuizSessionStatus,
    QuizSessionView,
    SessionQuestion,
    SessionQuestionOption,
    SessionQuestionType,
    SessionReflection,
)
from ..repositories.quiz_artifact_repository import QuizArtifactRepository
from ..repositories.quiz_session_repository import QuizSessionRepository
from .errors import (
    QuizArtifactNotFoundError,
    QuizOwnershipMismatchError,
    QuizSessionNotFoundError,
    QuizSessionPersistenceError,
)


_TYPE_MAPPING = {
    "multiple_choice": SessionQuestionType.MULTIPLE_CHOICE,
    "multiple-choice": SessionQuestionType.MULTIPLE_CHOICE,
    "true_false": SessionQuestionType.TRUE_FALSE,
    "true-false": SessionQuestionType.TRUE_FALSE,
    "short_answer": SessionQuestionType.SHORT_ANSWER,
    "short-answer": SessionQuestionType.SHORT_ANSWER,
    "fill_in_the_blank": SessionQuestionType.SHORT_ANSWER,
    "fill-in-the-blank": SessionQuestionType.SHORT_ANSWER,
    "written_response": SessionQuestionType.WRITTEN_RESPONSE,
    "written-response": SessionQuestionType.WRITTEN_RESPONSE,
}


class QuizSessionService:
    """Coordinate quiz session creation and retrieval."""

    def __init__(
        self,
        artifact_repository: QuizArtifactRepository,
        session_repository: QuizSessionRepository,
    ) -> None:
        self._artifact_repository = artifact_repository
        self._session_repository = session_repository

    async def create_session(self, request: QuizSessionCreateRequest) -> QuizSessionResponse:
        artifact = await self._artifact_repository.get_quiz(request.quiz_id)
        if artifact is None:
            raise QuizArtifactNotFoundError(f"Quiz {request.quiz_id} was not found")

        self._assert_ownership(artifact, request.app_id, request.user_id)

        now = datetime.now(timezone.utc)
        session_id = str(uuid4())
        session_metadata: Dict[str, Any] = {
            "artifact": artifact.metadata or {},
            "session": request.metadata or {},
        }

        record = QuizSessionRecord(
            sessionId=session_id,
            quizId=artifact.quiz_id,
            appId=request.app_id,
            userId=request.user_id,
            noteId=artifact.note_id,
            status=QuizSessionStatus.IN_PROGRESS,
            createdAt=now,
            updatedAt=now,
            isDeleted=False,
            deletedAt=None,
            metadata=session_metadata,
            quizSnapshot=artifact,
            answers=[],
            results=None,
        )

        try:
            await self._session_repository.create_session(record)
        except Exception as exc:  # pragma: no cover - surfaced as domain error
            raise QuizSessionPersistenceError("Failed to persist quiz session") from exc

        view = self._build_view(record)
        return QuizSessionResponse(session=view)

    async def get_session(self, session_id: str, *, app_id: str, user_id: str) -> QuizSessionResponse:
        record = await self._session_repository.get_session(session_id)
        if record is None:
            raise QuizSessionNotFoundError(f"Quiz session {session_id} was not found")

        self._assert_ownership(record.quiz_snapshot, app_id, user_id)
        view = self._build_view(record)
        return QuizSessionResponse(session=view)

    def _build_view(self, record: QuizSessionRecord) -> QuizSessionView:
        questions = [self._to_session_question(question) for question in record.quiz_snapshot.questions]
        reflection = None
        if record.quiz_snapshot.reflection:
            reflection = SessionReflection(
                prompt=record.quiz_snapshot.reflection.prompt,
                guidance=record.quiz_snapshot.reflection.guidance,
            )

        return QuizSessionView(
            sessionId=record.session_id,
            quizId=record.quiz_id,
            appId=record.app_id,
            userId=record.user_id,
            noteId=record.note_id,
            status=record.status,
            createdAt=record.created_at,
            updatedAt=record.updated_at,
            questions=questions,
            reflection=reflection,
            metadata=record.metadata,
        )

    @staticmethod
    def _assert_ownership(artifact: QuizArtifact, app_id: str, user_id: str) -> None:
        if artifact.app_id and artifact.app_id != app_id:
            raise QuizOwnershipMismatchError("Quiz artifact belongs to a different app")
        if artifact.user_id and artifact.user_id != user_id:
            raise QuizOwnershipMismatchError("Quiz artifact belongs to a different user")

    def _to_session_question(self, question: ArtifactQuestion) -> SessionQuestion:
        qtype_key = (question.type or "").lower()
        mapped_type = _TYPE_MAPPING.get(qtype_key, SessionQuestionType.SHORT_ANSWER)
        options = self._build_options(question)

        metadata = question.metadata or {}
        tags = metadata.get("tags") if isinstance(metadata.get("tags"), list) else []
        difficulty = metadata.get("difficulty") or metadata.get("Difficulty")
        points = self._coerce_points(metadata)
        source_component_id = (
            metadata.get("sourceComponentId")
            or metadata.get("source_component_id")
            or metadata.get("componentId")
        )

        return SessionQuestion(
            questionId=question.question_id,
            prompt=question.prompt,
            type=mapped_type,
            options=options,
            difficulty=difficulty,
            tags=[str(tag) for tag in tags],
            sourceComponentId=source_component_id,
            points=points,
        )

    @staticmethod
    def _build_options(question: ArtifactQuestion) -> List[SessionQuestionOption] | None:
        if not question.options:
            return None

        options: List[SessionQuestionOption] = []
        for index, option in enumerate(question.options, start=1):
            option_id = option.label or f"{question.question_id}-opt-{index}"
            options.append(SessionQuestionOption(optionId=option_id, text=option.text))
        return options

    @staticmethod
    def _coerce_points(metadata: Dict[str, Any]) -> float | None:
        raw = metadata.get("points") or metadata.get("pointValue")
        if raw is None:
            return None
        try:
            return float(raw)
        except (TypeError, ValueError):  # pragma: no cover - defensive guard
            return None
