"""Integration tests for quiz session API routes."""
from __future__ import annotations

from typing import Dict

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_quiz_session_service, get_reflection_feedback_service
from app.main import create_app
from app.models.quiz_artifact import ArtifactQuestion, ArtifactQuestionOption, QuizArtifact
from app.models.quiz_session import (
    QuizSessionRecord,
    QuizSessionStatus,
)
from app.models.reflection_feedback import ReflectionFeedbackRecord
from app.services.session_management import QuizSessionService
from app.services.reflection_feedback import ReflectionFeedbackService


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
        self.records: Dict[str, QuizSessionRecord] = {}

    async def create_session(self, record: QuizSessionRecord) -> None:  # type: ignore[override]
        self.records[record.session_id] = record.model_copy(deep=True)

    async def save_session(self, record: QuizSessionRecord) -> None:  # type: ignore[override]
        self.records[record.session_id] = record.model_copy(deep=True)

    async def get_session(self, session_id: str) -> QuizSessionRecord | None:
        stored = self.records.get(session_id)
        if stored is None:
            return None
        return stored.model_copy(deep=True)


class _StubFeedbackRepository:
    def __init__(self) -> None:
        self.records: Dict[str, ReflectionFeedbackRecord] = {}

    async def upsert_feedback(self, record: ReflectionFeedbackRecord) -> ReflectionFeedbackRecord:
        stored = record.model_copy(deep=True)
        self.records[record.session_id] = stored
        return stored

    async def get_by_session(self, session_id: str) -> ReflectionFeedbackRecord | None:
        existing = self.records.get(session_id)
        if existing is None:
            return None
        return existing.model_copy(deep=True)


def _build_client(
    artifact: QuizArtifact,
) -> tuple[TestClient, _StubSessionRepository, _StubFeedbackRepository]:
    app = create_app()
    session_repo = _StubSessionRepository()
    feedback_repo = _StubFeedbackRepository()
    session_service = QuizSessionService(_StubArtifactRepository(artifact), session_repo)
    feedback_service = ReflectionFeedbackService(session_repo, feedback_repo)
    app.dependency_overrides[get_quiz_session_service] = lambda: session_service
    app.dependency_overrides[get_reflection_feedback_service] = lambda: feedback_service
    client = TestClient(app)
    return client, session_repo, feedback_repo


def _cleanup(client: TestClient) -> None:
    client.app.dependency_overrides.clear()
    client.close()


@pytest.mark.parametrize(
    "answers_payload,expected_score",
    [
        (
            [
                {
                    "type": "MULTIPLE_CHOICE",
                    "questionId": "q1",
                    "selectedOptionIds": ["A"],
                },
                {
                    "type": "TRUE_FALSE",
                    "questionId": "q2",
                    "answer": True,
                },
            ],
            3.0,
        ),
    ],
)
@pytest.mark.parametrize("app_id,user_id", [("nova-app", "user-42")])
def test_submit_session_endpoint_grades_and_completes(answers_payload, expected_score, app_id, user_id):
    artifact = QuizArtifact(
        quizId="quiz-123",
        appId=app_id,
        userId=user_id,
        questions=[
            ArtifactQuestion(
                id="q1",
                prompt="Select the correct expansion of AI.",
                type="multiple_choice",
                metadata={"points": 2},
                options=[
                    ArtifactQuestionOption(label="A", text="Artificial Intelligence", isCorrect=True),
                    ArtifactQuestionOption(label="B", text="Automated Intuition", isCorrect=False),
                ],
            ),
            ArtifactQuestion(
                id="q2",
                prompt="AI systems can learn from data.",
                type="true_false",
                answer="true",
                metadata={"points": 1},
            ),
        ],
        metadata={"topics": ["ai"]},
    )

    client, session_repo, _ = _build_client(artifact)
    try:
        create_response = client.post(
            "/api/quiz/sessions",
            json={"quizId": "quiz-123", "userId": user_id, "appId": app_id},
        )
        assert create_response.status_code == 201
        session_id = create_response.json()["session"]["sessionId"]

        submit_response = client.post(
            f"/api/quiz/sessions/{session_id}/submit",
            json={
                "sessionId": session_id,
                "quizId": "quiz-123",
                "userId": user_id,
                "appId": app_id,
                "answers": answers_payload,
            },
        )
        assert submit_response.status_code == 200
        results = submit_response.json()["results"]
        assert pytest.approx(results["totalScore"]) == expected_score
        assert pytest.approx(results["maxScore"]) == expected_score
        assert results["requiresReview"] is False
        assert results["pendingWrittenCount"] == 0
        assert results["recommendations"] == []
        assert results["noteImprovementSuggestions"] == []

        stored_record = session_repo.records[session_id]
        assert stored_record.status is QuizSessionStatus.COMPLETED
        assert stored_record.results is not None
        assert stored_record.results.total_score == pytest.approx(expected_score)

        results_response = client.get(
            f"/api/quiz/sessions/{session_id}/results",
            params={"appId": app_id, "userId": user_id},
        )
        assert results_response.status_code == 200
        assert results_response.json()["results"] == results
    finally:
        _cleanup(client)


def test_submit_session_generates_recommendations_for_incorrect_answers():
    artifact = QuizArtifact(
        quizId="quiz-456",
        appId="nova-app",
        userId="user-9001",
        questions=[
            ArtifactQuestion(
                id="q1",
                prompt="Define AI in one sentence.",
                type="short_answer",
                answer="Artificial Intelligence",
                metadata={"points": 2, "acceptableAnswers": ["Artificial Intelligence"]},
            )
        ],
        metadata={"topics": ["ai"]},
    )

    client, session_repo, _ = _build_client(artifact)
    try:
        creation = client.post(
            "/api/quiz/sessions",
            json={"quizId": "quiz-456", "userId": "user-9001", "appId": "nova-app"},
        )
        assert creation.status_code == 201
        session_id = creation.json()["session"]["sessionId"]

        submission = client.post(
            f"/api/quiz/sessions/{session_id}/submit",
            json={
                "quizId": "quiz-456",
                "userId": "user-9001",
                "appId": "nova-app",
                "answers": [
                    {
                        "type": "SHORT_ANSWER",
                        "questionId": "q1",
                        "answer": "Automated Industry",
                    }
                ],
            },
        )
        assert submission.status_code == 200
        payload = submission.json()["results"]
        assert payload["totalScore"] == pytest.approx(0.0)
        assert payload["recommendations"]
        assert payload["noteImprovementSuggestions"]
        assert payload["metadata"]["objective"] == {"correct": 0, "total": 1}

        stored_record = session_repo.records[session_id]
        assert stored_record.status is QuizSessionStatus.COMPLETED
        assert stored_record.results is not None
        assert len(stored_record.results.recommendations) == 1
        assert len(stored_record.results.note_improvement_suggestions) == 1
    finally:
        _cleanup(client)


def test_written_response_submission_requires_review():
    artifact = QuizArtifact(
        quizId="quiz-written",
        appId="nova-app",
        userId="user-100",
        questions=[
            ArtifactQuestion(
                id="q1",
                prompt="Discuss the ethical implications of AI.",
                type="written_response",
                metadata={"points": 1},
            )
        ],
    )

    client, session_repo, _ = _build_client(artifact)
    try:
        creation = client.post(
            "/api/quiz/sessions",
            json={"quizId": "quiz-written", "userId": "user-100", "appId": "nova-app"},
        )
        assert creation.status_code == 201
        session_id = creation.json()["session"]["sessionId"]

        submission = client.post(
            f"/api/quiz/sessions/{session_id}/submit",
            json={
                "quizId": "quiz-written",
                "userId": "user-100",
                "appId": "nova-app",
                "answers": [
                    {
                        "type": "WRITTEN_RESPONSE",
                        "questionId": "q1",
                        "answer": "AI requires careful governance to ensure fairness.",
                    }
                ],
            },
        )
        assert submission.status_code == 200
        payload = submission.json()["results"]
        assert payload["requiresReview"] is True
        assert payload["pendingWrittenCount"] == 1
        assert payload["recommendations"] == []
        assert payload["noteImprovementSuggestions"] == []
        assert payload["metadata"]["objective"] == {"correct": 0, "total": 0}

        stored_record = session_repo.records[session_id]
        assert stored_record.status is QuizSessionStatus.AWAITING_REVIEW
        assert stored_record.results is not None
        assert stored_record.results.requires_review is True
        assert stored_record.results.pending_written_count == 1
    finally:
        _cleanup(client)


def test_submit_feedback_endpoint_upserts_feedback_records():
    artifact = QuizArtifact(
        quizId="quiz-feedback",
        appId="nova-app",
        userId="user-77",
        questions=[
            ArtifactQuestion(
                id="q1",
                prompt="Select AI definition",
                type="multiple_choice",
                metadata={"points": 1},
                options=[
                    ArtifactQuestionOption(label="A", text="Artificial Intelligence", isCorrect=True),
                    ArtifactQuestionOption(label="B", text="Automated Ignorance", isCorrect=False),
                ],
            )
        ],
        metadata={"topics": ["ai"]},
    )

    client, session_repo, feedback_repo = _build_client(artifact)
    try:
        creation = client.post(
            "/api/quiz/sessions",
            json={"quizId": "quiz-feedback", "userId": "user-77", "appId": "nova-app"},
        )
        assert creation.status_code == 201
        session_id = creation.json()["session"]["sessionId"]

        submission = client.post(
            f"/api/quiz/sessions/{session_id}/submit",
            json={
                "quizId": "quiz-feedback",
                "userId": "user-77",
                "appId": "nova-app",
                "answers": [
                    {
                        "type": "MULTIPLE_CHOICE",
                        "questionId": "q1",
                        "selectedOptionIds": ["A"],
                    }
                ],
            },
        )
        assert submission.status_code == 200

        first_feedback = client.post(
            f"/api/quiz/sessions/{session_id}/feedback",
            json={
                "sessionId": session_id,
                "quizId": "quiz-feedback",
                "userId": "user-77",
                "appId": "nova-app",
                "quizRating": 5,
                "recommendationRating": 4,
                "notes": "Great explanations.",
                "metadata": {"initial": True},
            },
        )
        assert first_feedback.status_code == 200
        payload = first_feedback.json()["feedback"]
        assert payload["quizRating"] == 5
        assert payload["recommendationRating"] == 4
        assert payload["metadata"] == {"initial": True}

        assert session_id in feedback_repo.records
        stored = feedback_repo.records[session_id]
        assert stored.quiz_rating == 5
        assert stored.recommendation_rating == 4
        assert stored.metadata == {"initial": True}

        second_feedback = client.post(
            f"/api/quiz/sessions/{session_id}/feedback",
            json={
                "quizId": "quiz-feedback",
                "userId": "user-77",
                "appId": "nova-app",
                "quizRating": 3,
                "recommendationRating": 2,
                "metadata": {"followup": True},
            },
        )
        assert second_feedback.status_code == 200
        updated = second_feedback.json()["feedback"]
        assert updated["quizRating"] == 3
        assert updated["recommendationRating"] == 2
        assert updated["metadata"] == {"initial": True, "followup": True}

        stored_after = feedback_repo.records[session_id]
        assert stored_after.quiz_rating == 3
        assert stored_after.recommendation_rating == 2
        assert stored_after.metadata == {"initial": True, "followup": True}
    finally:
        _cleanup(client)
