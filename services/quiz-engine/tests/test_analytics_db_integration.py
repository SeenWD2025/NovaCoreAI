"""Database-backed integration tests for reflection analytics."""
from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.db_models import (
    QuizArtifactRecord,
    QuizSessionRecordORM,
    ReflectionFeedbackRecordORM,
    ReflectionMetricsDailyRecordORM,
)
from app.main import create_app


@pytest.fixture(autouse=True)
def _clean_feedback_tables() -> None:
    """Ensure feedback and metrics tables are clean between tests."""

    feedback_table = settings.reflection_feedback_table
    metrics_table = settings.reflection_metrics_table
    with SessionLocal() as session:
        session.execute(text(f"TRUNCATE TABLE {metrics_table}"))
        session.execute(text(f"TRUNCATE TABLE {feedback_table}"))
        session.commit()
    yield
    with SessionLocal() as session:
        session.execute(text(f"TRUNCATE TABLE {metrics_table}"))
        session.execute(text(f"TRUNCATE TABLE {feedback_table}"))
        session.commit()


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def _seed_feedback(
    *,
    submitted_at: datetime,
    quiz_id: str,
    app_id: str = "nova-app",
    user_id: str = "user-42",
    note_id: str | None = None,
    quiz_rating: int = 4,
    recommendation_rating: int = 5,
) -> str:
    feedback_id = f"feedback-{uuid4()}"
    session_id = f"session-{uuid4()}"

    artifact_record = QuizArtifactRecord(
        quiz_id=quiz_id,
        provider="manual",
        note_id=note_id,
        app_id=app_id,
        user_id=user_id,
        question_count=0,
        questions=[],
        reflection=None,
        metadata_json={},
    )

    session_record = QuizSessionRecordORM(
        session_id=session_id,
        quiz_id=quiz_id,
        app_id=app_id,
        user_id=user_id,
        note_id=note_id,
        status="completed",
        created_at=submitted_at,
        updated_at=submitted_at,
        is_deleted=False,
        deleted_at=None,
        metadata_json={},
        quiz_snapshot={
            "quizId": quiz_id,
            "appId": app_id,
            "userId": user_id,
            "questions": [],
            "metadata": {},
        },
        answers=[],
        results=None,
    )

    record = ReflectionFeedbackRecordORM(
        feedback_id=feedback_id,
        session_id=session_id,
        quiz_id=quiz_id,
        app_id=app_id,
        user_id=user_id,
        note_id=note_id,
        quiz_rating=quiz_rating,
        recommendation_rating=recommendation_rating,
        notes=None,
        metadata_json={},
        submitted_at=submitted_at,
        created_at=submitted_at,
        updated_at=submitted_at,
        is_deleted=False,
        deleted_at=None,
    )

    with SessionLocal() as session:
        session.merge(artifact_record)
        session.merge(session_record)
        session.add(record)
        session.commit()

    return feedback_id


def test_recompute_endpoint_populates_metrics_table(client: TestClient) -> None:
    target_date = datetime(2025, 11, 15, 15, 0, tzinfo=timezone.utc)
    _seed_feedback(submitted_at=target_date, quiz_id="quiz-123", quiz_rating=5, recommendation_rating=4)
    _seed_feedback(submitted_at=target_date, quiz_id="quiz-123", quiz_rating=4, recommendation_rating=3)

    response = client.post(
        "/api/quiz/analytics/reflection/daily/recompute",
        json={
            "startDate": "2025-11-15",
            "endDate": "2025-11-15",
            "appId": "nova-app",
            "quizId": "quiz-123",
        },
    )
    assert response.status_code == 202
    payload = response.json()["metrics"]
    assert len(payload) == 1
    metric = payload[0]
    assert metric["totalFeedback"] == 2
    assert metric["averageQuizRating"] == pytest.approx(4.5)
    assert metric["averageRecommendationRating"] == pytest.approx(3.5)

    with SessionLocal() as session:
        record = (
            session.query(ReflectionMetricsDailyRecordORM)
            .filter(ReflectionMetricsDailyRecordORM.aggregation_date == date(2025, 11, 15))
            .filter(ReflectionMetricsDailyRecordORM.app_id == "nova-app")
            .filter(ReflectionMetricsDailyRecordORM.quiz_id == "quiz-123")
            .one()
        )
        assert record.total_feedback == 2
        assert float(record.average_quiz_rating) == pytest.approx(4.5)

    get_response = client.get(
        "/api/quiz/analytics/reflection/daily",
        params={"startDate": "2025-11-15", "endDate": "2025-11-16", "appId": "nova-app"},
    )
    assert get_response.status_code == 200
    listed = get_response.json()["metrics"]
    assert listed[0]["quizId"] == "quiz-123"