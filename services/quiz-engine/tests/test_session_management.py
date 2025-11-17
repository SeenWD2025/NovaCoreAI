"""Unit tests for quiz session service logic."""
from __future__ import annotations

import pytest

from app.models.quiz_artifact import ArtifactQuestion, ArtifactQuestionOption, ArtifactReflection, QuizArtifact
from app.models.quiz_session import QuizSessionCreateRequest, SessionQuestionType
from app.services.errors import QuizArtifactNotFoundError, QuizOwnershipMismatchError
from app.services.session_management import QuizSessionService


class _StubArtifactRepository:
    def __init__(self, artifact: QuizArtifact | None) -> None:
        self._artifact = artifact
        self.requested_ids: list[str] = []

    async def get_quiz(self, quiz_id: str) -> QuizArtifact | None:
        self.requested_ids.append(quiz_id)
        if self._artifact and self._artifact.quiz_id == quiz_id:
            return self._artifact
        return None


class _StubSessionRepository:
    def __init__(self) -> None:
        self.created_records = {}

    async def create_session(self, record):  # type: ignore[override]
        self.created_records[record.session_id] = record

    async def get_session(self, session_id: str):
        return self.created_records.get(session_id)


@pytest.fixture
def quiz_artifact() -> QuizArtifact:
    return QuizArtifact(
        quizId="quiz-123",
        appId="nova-app",
        userId="user-42",
        noteId="note-7",
        provider="gemini",
        questions=[
            ArtifactQuestion(
                id="q1",
                prompt="What is AI?",
                type="multiple_choice",
                metadata={
                    "difficulty": "INTRODUCTORY",
                    "tags": ["ai", "basics"],
                    "points": 2,
                    "sourceComponentId": "comp-1",
                },
                options=[
                    ArtifactQuestionOption(label="A", text="Artificial Intelligence", isCorrect=True),
                    ArtifactQuestionOption(label="B", text="Augmented Imagination", isCorrect=False),
                ],
            )
        ],
        reflection=ArtifactReflection(prompt="Reflect on AI", guidance="Think about real-world uses."),
        metadata={"topics": ["ai"]},
    )


@pytest.mark.asyncio
async def test_create_session_masks_answers_and_persists_record(quiz_artifact: QuizArtifact):
    artifact_repo = _StubArtifactRepository(quiz_artifact)
    session_repo = _StubSessionRepository()
    service = QuizSessionService(artifact_repo, session_repo)

    payload = QuizSessionCreateRequest(quizId="quiz-123", userId="user-42", appId="nova-app")

    response = await service.create_session(payload)

    assert response.session.quiz_id == "quiz-123"
    assert response.session.status.value == "in_progress"
    assert response.session.reflection is not None

    question = response.session.questions[0]
    assert question.type is SessionQuestionType.MULTIPLE_CHOICE
    assert question.difficulty == "INTRODUCTORY"
    assert question.source_component_id == "comp-1"
    assert all(not hasattr(option, "is_correct") for option in question.options or [])

    assert session_repo.created_records, "Session should be persisted"
    stored_record = next(iter(session_repo.created_records.values()))
    assert stored_record.quiz_snapshot.questions[0].options[0].is_correct is True


@pytest.mark.asyncio
async def test_create_session_respects_quiz_ownership(quiz_artifact: QuizArtifact):
    artifact_repo = _StubArtifactRepository(quiz_artifact)
    session_repo = _StubSessionRepository()
    service = QuizSessionService(artifact_repo, session_repo)

    payload = QuizSessionCreateRequest(quizId="quiz-123", userId="wrong-user", appId="nova-app")

    with pytest.raises(QuizOwnershipMismatchError):
        await service.create_session(payload)


@pytest.mark.asyncio
async def test_create_session_handles_missing_quiz():
    artifact_repo = _StubArtifactRepository(None)
    session_repo = _StubSessionRepository()
    service = QuizSessionService(artifact_repo, session_repo)

    payload = QuizSessionCreateRequest(quizId="missing", userId="user-42", appId="nova-app")

    with pytest.raises(QuizArtifactNotFoundError):
        await service.create_session(payload)


@pytest.mark.asyncio
async def test_get_session_round_trips_created_session(quiz_artifact: QuizArtifact):
    artifact_repo = _StubArtifactRepository(quiz_artifact)
    session_repo = _StubSessionRepository()
    service = QuizSessionService(artifact_repo, session_repo)

    creation = await service.create_session(
        QuizSessionCreateRequest(quizId="quiz-123", userId="user-42", appId="nova-app")
    )

    response = await service.get_session(
        creation.session.session_id, app_id="nova-app", user_id="user-42"
    )

    assert response.session.session_id == creation.session.session_id
    assert response.session.questions[0].type is SessionQuestionType.MULTIPLE_CHOICE
    assert response.session.metadata["artifact"]["topics"] == ["ai"]


@pytest.mark.asyncio
async def test_get_session_enforces_ownership(quiz_artifact: QuizArtifact):
    artifact_repo = _StubArtifactRepository(quiz_artifact)
    session_repo = _StubSessionRepository()
    service = QuizSessionService(artifact_repo, session_repo)

    creation = await service.create_session(
        QuizSessionCreateRequest(quizId="quiz-123", userId="user-42", appId="nova-app")
    )

    with pytest.raises(QuizOwnershipMismatchError):
        await service.get_session(creation.session.session_id, app_id="nova-app", user_id="user-999")
