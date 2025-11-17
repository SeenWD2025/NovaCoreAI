"""Unit tests for reflection metrics scheduler helpers."""
from __future__ import annotations

from datetime import date, datetime, timezone

from app.models.reflection_analytics import DailyReflectionMetric
from app.tasks.reflection_scheduler import _seconds_until_next_run, _summarize_metrics


def test_summarize_metrics_calculates_weighted_averages() -> None:
    now = datetime.now(timezone.utc)
    metrics = [
        DailyReflectionMetric(
            aggregationDate=date(2025, 11, 10),
            appId="nova-app",
            quizId="quiz-1",
            totalFeedback=2,
            quizRatingSum=8,
            recommendationRatingSum=7,
            averageQuizRating=4.0,
            averageRecommendationRating=3.5,
            quizRatingCount=2,
            recommendationRatingCount=2,
            createdAt=now,
            updatedAt=now,
        ),
        DailyReflectionMetric(
            aggregationDate=date(2025, 11, 11),
            appId="nova-app",
            quizId="quiz-2",
            totalFeedback=3,
            quizRatingSum=15,
            recommendationRatingSum=9,
            averageQuizRating=5.0,
            averageRecommendationRating=3.0,
            quizRatingCount=3,
            recommendationRatingCount=3,
            createdAt=now,
            updatedAt=now,
        ),
    ]

    summary = _summarize_metrics(metrics)
    assert summary is not None
    assert summary["weightedRecommendationAverage"] == (7 + 9) / (2 + 3)
    assert summary["weightedQuizAverage"] == (8 + 15) / (2 + 3)
    assert summary["lowestRecommendation"]["quizId"] == "quiz-2"


def test_seconds_until_next_run_in_future() -> None:
    seconds = _seconds_until_next_run(23, 59)
    assert seconds > 0
    # Bound to within a day
    assert seconds <= 24 * 60 * 60
