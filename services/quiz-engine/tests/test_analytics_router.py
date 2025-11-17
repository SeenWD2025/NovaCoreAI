"""Router tests for reflection analytics endpoints."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Dict, List

from fastapi.testclient import TestClient

from app.dependencies import get_reflection_analytics_service
from app.main import create_app
from app.models.reflection_analytics import DailyReflectionMetric
from app.services.reflection_analytics import ReflectionAnalyticsService


class _StubFeedbackRepository:
    def __init__(self) -> None:
        self.requests: List[Dict[str, object]] = []
        self.rollup_rows: List[Dict[str, object]] = []

    async def calculate_daily_rollups(self, **kwargs) -> List[Dict[str, object]]:  # type: ignore[override]
        self.requests.append(kwargs)
        return list(self.rollup_rows)


class _StubMetricsRepository:
    def __init__(self) -> None:
        self.metrics: Dict[tuple[date, str, str], DailyReflectionMetric] = {}

    async def upsert_metric(self, metric: DailyReflectionMetric) -> DailyReflectionMetric:  # type: ignore[override]
        key = (metric.aggregation_date, metric.app_id, metric.quiz_id)
        self.metrics[key] = metric
        return metric

    async def fetch_metrics(  # type: ignore[override]
        self,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        app_id: str | None = None,
        quiz_id: str | None = None,
    ) -> List[DailyReflectionMetric]:
        values = list(self.metrics.values())
        results: List[DailyReflectionMetric] = []
        for metric in values:
            if start_date and metric.aggregation_date < start_date:
                continue
            if end_date and metric.aggregation_date > end_date:
                continue
            if app_id and metric.app_id != app_id:
                continue
            if quiz_id and metric.quiz_id != quiz_id:
                continue
            results.append(metric)
        return sorted(results, key=lambda item: (item.aggregation_date, item.app_id, item.quiz_id))


def _build_client() -> tuple[TestClient, _StubFeedbackRepository, _StubMetricsRepository]:
    app = create_app()
    feedback_repo = _StubFeedbackRepository()
    metrics_repo = _StubMetricsRepository()
    service = ReflectionAnalyticsService(feedback_repo, metrics_repo)
    app.dependency_overrides[get_reflection_analytics_service] = lambda: service
    client = TestClient(app)
    return client, feedback_repo, metrics_repo


def _cleanup(client: TestClient) -> None:
    client.app.dependency_overrides.clear()
    client.close()


def test_recompute_endpoint_persists_rollup() -> None:
    client, feedback_repo, metrics_repo = _build_client()
    try:
        feedback_repo.rollup_rows = [
            {
                "aggregation_date": date(2025, 11, 15),
                "app_id": "nova-app",
                "quiz_id": "quiz-123",
                "total_feedback": 3,
                "quiz_rating_sum": 12,
                "recommendation_rating_sum": 11,
                "average_quiz_rating": 4.0,
                "average_recommendation_rating": 3.6667,
                "quiz_rating_count": 3,
                "recommendation_rating_count": 3,
            }
        ]

        response = client.post(
            "/api/quiz/analytics/reflection/daily/recompute",
            json={
                "startDate": "2025-11-15",
                "endDate": "2025-11-15",
                "appId": "nova-app",
            },
        )
        assert response.status_code == 202
        payload = response.json()
        assert payload["metrics"][0]["totalFeedback"] == 3
        assert metrics_repo.metrics
    finally:
        _cleanup(client)


def test_list_endpoint_filters_metrics() -> None:
    client, _, metrics_repo = _build_client()
    try:
        now = datetime.now(timezone.utc)
        metrics_repo.metrics[(date(2025, 11, 15), "nova-app", "quiz-123")] = DailyReflectionMetric(
            aggregationDate=date(2025, 11, 15),
            appId="nova-app",
            quizId="quiz-123",
            totalFeedback=2,
            quizRatingSum=8,
            recommendationRatingSum=7,
            averageQuizRating=4.0,
            averageRecommendationRating=3.5,
            quizRatingCount=2,
            recommendationRatingCount=2,
            createdAt=now,
            updatedAt=now,
        )

        metrics_repo.metrics[(date(2025, 11, 16), "nova-app", "quiz-999")] = DailyReflectionMetric(
            aggregationDate=date(2025, 11, 16),
            appId="nova-app",
            quizId="quiz-999",
            totalFeedback=1,
            quizRatingSum=3,
            recommendationRatingSum=4,
            averageQuizRating=3.0,
            averageRecommendationRating=4.0,
            quizRatingCount=1,
            recommendationRatingCount=1,
            createdAt=now,
            updatedAt=now,
        )

        response = client.get(
            "/api/quiz/analytics/reflection/daily",
            params={"startDate": "2025-11-16", "appId": "nova-app"},
        )
        assert response.status_code == 200
        data = response.json()["metrics"]
        assert len(data) == 1
        assert data[0]["quizId"] == "quiz-999"
    finally:
        _cleanup(client)
