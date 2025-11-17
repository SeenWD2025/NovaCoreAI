"""Integration tests hitting the real database-backed session routes."""
from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.db_models import QuizArtifactRecord, QuizSessionRecordORM, ReflectionFeedbackRecordORM
from app.main import create_app


@pytest.fixture(autouse=True)
def _clean_database() -> None:
    """Ensure quiz tables are truncated before and after each test."""

    artifacts_table = settings.quiz_artifacts_table
    feedback_table = settings.reflection_feedback_table
    metrics_table = settings.reflection_metrics_table
    with SessionLocal() as session:
        session.execute(text(f"TRUNCATE TABLE {artifacts_table} CASCADE"))
        session.execute(text("TRUNCATE TABLE quiz_sessions CASCADE"))
        session.execute(text(f"TRUNCATE TABLE {feedback_table} CASCADE"))
        session.execute(text(f"TRUNCATE TABLE {metrics_table}"))
        session.commit()
    yield
    with SessionLocal() as session:
        session.execute(text(f"TRUNCATE TABLE {artifacts_table} CASCADE"))
        session.execute(text("TRUNCATE TABLE quiz_sessions CASCADE"))
        session.execute(text(f"TRUNCATE TABLE {feedback_table} CASCADE"))
        session.execute(text(f"TRUNCATE TABLE {metrics_table}"))
        session.commit()


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def _seed_artifact(**overrides) -> str:
    quiz_id = overrides.get("quiz_id", f"quiz-int-{uuid4()}" )
    record = QuizArtifactRecord(
        quiz_id=quiz_id,
        provider=overrides.get("provider", "manual"),
        note_id=overrides.get("note_id", "note-seed"),
        app_id=overrides.get("app_id", "nova-app"),
        user_id=overrides.get("user_id", "user-42"),
        question_count=overrides.get("question_count"),
        question_types=overrides.get("question_types"),
        include_reflection=overrides.get("include_reflection", True),
        questions=overrides.get("questions"),
        reflection=overrides.get("reflection"),
        metadata_json=overrides.get("metadata_json", {}),
    )

    with SessionLocal() as session:
        session.add(record)
        session.commit()

    return quiz_id


def test_session_submission_persists_completed_results(client: TestClient) -> None:
    quiz_id = _seed_artifact(
        question_count=2,
        question_types=["multiple_choice", "true_false"],
        questions=[
            {
                "id": "q1",
                "prompt": "Select the correct AI expansion.",
                "type": "multiple_choice",
                "options": [
                    {"label": "A", "text": "Artificial Intelligence", "isCorrect": True},
                    {"label": "B", "text": "Automated Ignorance", "isCorrect": False},
                ],
                "answer": "A",
                "metadata": {"points": 2, "sourceComponentId": "comp-1", "tags": ["ai"]},
            },
            {
                "id": "q2",
                "prompt": "AI systems can learn from data.",
                "type": "true_false",
                "answer": "true",
                "metadata": {"points": 1, "sourceComponentId": "comp-2"},
            },
        ],
        reflection={"prompt": "Reflect on AI", "guidance": "Highlight practical uses."},
        metadata_json={"topics": ["ai"]},
    )

    creation = client.post(
        "/api/quiz/sessions",
        json={"quizId": quiz_id, "userId": "user-42", "appId": "nova-app"},
    )
    assert creation.status_code == 201
    session_id = creation.json()["session"]["sessionId"]

    submission = client.post(
        f"/api/quiz/sessions/{session_id}/submit",
        json={
            "quizId": quiz_id,
            "userId": "user-42",
            "appId": "nova-app",
            "answers": [
                {"type": "MULTIPLE_CHOICE", "questionId": "q1", "selectedOptionIds": ["A"]},
                {"type": "TRUE_FALSE", "questionId": "q2", "answer": True},
            ],
        },
    )
    assert submission.status_code == 200
    payload = submission.json()["results"]

    assert payload["totalScore"] == pytest.approx(3.0)
    assert payload["requiresReview"] is False
    assert payload["pendingWrittenCount"] == 0

    with SessionLocal() as session:
        record = session.get(QuizSessionRecordORM, session_id)
        assert record is not None
        assert record.status == "completed"
        assert record.results["totalScore"] == 3.0
        assert record.results["metadata"]["objective"] == {"correct": 2, "total": 2}

    stored = client.get(
        f"/api/quiz/sessions/{session_id}/results",
        params={"appId": "nova-app", "userId": "user-42"},
    )
    assert stored.status_code == 200
    assert stored.json()["results"] == payload


def test_session_submission_generates_recommendations_and_review(client: TestClient) -> None:
    quiz_id = _seed_artifact(
        question_count=3,
        question_types=["multiple_choice", "short_answer", "written_response"],
        questions=[
            {
                "id": "q1",
                "prompt": "Select AI definition",
                "type": "multiple_choice",
                "options": [
                    {"label": "A", "text": "Artificial Intelligence", "isCorrect": True},
                    {"label": "B", "text": "Automated Ignorance", "isCorrect": False},
                ],
                "answer": "A",
                "metadata": {"points": 2, "sourceComponentId": "comp-1"},
            },
            {
                "id": "q2",
                "prompt": "Define AI in one phrase.",
                "type": "short_answer",
                "answer": "Artificial Intelligence",
                "metadata": {
                    "points": 1,
                    "sourceComponentId": "comp-2",
                    "acceptableAnswers": ["Artificial Intelligence", "AI"],
                },
            },
            {
                "id": "q3",
                "prompt": "Describe responsible AI practices.",
                "type": "written_response",
                "metadata": {"points": 2, "sourceComponentId": "comp-3"},
            },
        ],
        reflection={"prompt": "Reflect", "guidance": "Capture key takeaways."},
        metadata_json={"topics": ["ai", "ethics"]},
    )

    creation = client.post(
        "/api/quiz/sessions",
        json={"quizId": quiz_id, "userId": "user-42", "appId": "nova-app"},
    )
    assert creation.status_code == 201
    session_id = creation.json()["session"]["sessionId"]

    submission = client.post(
        f"/api/quiz/sessions/{session_id}/submit",
        json={
            "quizId": quiz_id,
            "userId": "user-42",
            "appId": "nova-app",
            "answers": [
                {"type": "MULTIPLE_CHOICE", "questionId": "q1", "selectedOptionIds": ["B"]},
                {"type": "SHORT_ANSWER", "questionId": "q2", "answer": "Automated Intuition"},
                {"type": "WRITTEN_RESPONSE", "questionId": "q3", "answer": "We should document policies."},
            ],
        },
    )
    assert submission.status_code == 200
    payload = submission.json()["results"]

    assert payload["requiresReview"] is True
    assert payload["pendingWrittenCount"] == 1
    assert payload["metadata"]["objective"] == {"correct": 0, "total": 2}
    assert len(payload["recommendations"]) == 2
    assert len(payload["noteImprovementSuggestions"]) == 2

    with SessionLocal() as session:
        record = session.get(QuizSessionRecordORM, session_id)
        assert record is not None
        assert record.status == "awaiting_review"
        assert record.results["requiresReview"] is True
        assert record.results["pendingWrittenCount"] == 1
        assert len(record.results["recommendations"]) == 2


def test_reflection_feedback_persists_and_updates(client: TestClient) -> None:
    quiz_id = _seed_artifact(
        note_id="note-reflect",
        questions=[
            {
                "id": "q1",
                "prompt": "Select AI definition",
                "type": "multiple_choice",
                "options": [
                    {"label": "A", "text": "Artificial Intelligence", "isCorrect": True},
                    {"label": "B", "text": "Automated Ignorance", "isCorrect": False},
                ],
                "metadata": {"points": 1},
            }
        ],
        metadata_json={"topics": ["ai"]},
    )

    creation = client.post(
        "/api/quiz/sessions",
        json={"quizId": quiz_id, "userId": "user-42", "appId": "nova-app"},
    )
    assert creation.status_code == 201
    session_id = creation.json()["session"]["sessionId"]

    submission = client.post(
        f"/api/quiz/sessions/{session_id}/submit",
        json={
            "quizId": quiz_id,
            "userId": "user-42",
            "appId": "nova-app",
            "answers": [
                {"type": "MULTIPLE_CHOICE", "questionId": "q1", "selectedOptionIds": ["A"]},
            ],
        },
    )
    assert submission.status_code == 200

    feedback_response = client.post(
        f"/api/quiz/sessions/{session_id}/feedback",
        json={
            "quizId": quiz_id,
            "userId": "user-42",
            "appId": "nova-app",
            "quizRating": 4,
            "recommendationRating": 5,
            "metadata": {"initial": True},
        },
    )
    assert feedback_response.status_code == 200
    first_payload = feedback_response.json()["feedback"]
    assert first_payload["quizRating"] == 4
    assert first_payload["metadata"] == {"initial": True}

    with SessionLocal() as session:
        orm = (
            session.query(ReflectionFeedbackRecordORM)
            .filter(ReflectionFeedbackRecordORM.session_id == session_id)
            .one()
        )
        assert orm.quiz_rating == 4
        assert orm.recommendation_rating == 5
        assert orm.metadata_json == {"initial": True}
        first_feedback_id = orm.feedback_id

    update_response = client.post(
        f"/api/quiz/sessions/{session_id}/feedback",
        json={
            "quizId": quiz_id,
            "userId": "user-42",
            "appId": "nova-app",
            "quizRating": 2,
            "recommendationRating": 1,
            "metadata": {"followup": True},
        },
    )
    assert update_response.status_code == 200
    second_payload = update_response.json()["feedback"]
    assert second_payload["quizRating"] == 2
    assert second_payload["metadata"] == {"initial": True, "followup": True}

    with SessionLocal() as session:
        orm = (
            session.query(ReflectionFeedbackRecordORM)
            .filter(ReflectionFeedbackRecordORM.session_id == session_id)
            .one()
        )
        assert orm.feedback_id == first_feedback_id
        assert orm.quiz_rating == 2
        assert orm.recommendation_rating == 1
        assert orm.metadata_json == {"initial": True, "followup": True}
