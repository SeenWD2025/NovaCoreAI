"""Service for aggregating and exposing reflection feedback analytics."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from ..models.reflection_analytics import (
    DailyReflectionMetric,
    ReflectionMetricsQuery,
    ReflectionMetricsRecomputeRequest,
    ReflectionMetricsResponse,
)
from ..repositories.reflection_feedback_repository import ReflectionFeedbackRepository
from ..repositories.reflection_metrics_repository import ReflectionMetricsRepository
from .errors import ReflectionFeedbackValidationError


class ReflectionAnalyticsService:
    """Compute and expose reflection metrics for downstream consumers."""

    def __init__(
        self,
        feedback_repository: ReflectionFeedbackRepository,
        metrics_repository: ReflectionMetricsRepository,
    ) -> None:
        self._feedback_repository = feedback_repository
        self._metrics_repository = metrics_repository

    async def recompute(self, request: ReflectionMetricsRecomputeRequest) -> ReflectionMetricsResponse:
        if request.start_date > request.end_date:
            raise ReflectionFeedbackValidationError("startDate must be on or before endDate")

        rows = await self._feedback_repository.calculate_daily_rollups(
            start_date=request.start_date,
            end_date=request.end_date,
            app_id=request.app_id,
            quiz_id=request.quiz_id,
        )

        now = datetime.now(timezone.utc)
        persisted_metrics: list[DailyReflectionMetric] = []
        for row in rows:
            metric = DailyReflectionMetric(
                aggregationDate=row["aggregation_date"],
                appId=row["app_id"],
                quizId=row["quiz_id"],
                totalFeedback=row["total_feedback"],
                quizRatingSum=row["quiz_rating_sum"],
                recommendationRatingSum=row["recommendation_rating_sum"],
                averageQuizRating=row["average_quiz_rating"],
                averageRecommendationRating=row["average_recommendation_rating"],
                quizRatingCount=row["quiz_rating_count"],
                recommendationRatingCount=row["recommendation_rating_count"],
                createdAt=now,
                updatedAt=now,
            )
            stored = await self._metrics_repository.upsert_metric(metric)
            persisted_metrics.append(stored)

        # Fetch persisted metrics for the requested window regardless of whether new rows were generated.
        metrics = await self._metrics_repository.fetch_metrics(
            start_date=request.start_date,
            end_date=request.end_date,
            app_id=request.app_id,
            quiz_id=request.quiz_id,
        )

        return ReflectionMetricsResponse(metrics=metrics)

    async def list_metrics(self, query: ReflectionMetricsQuery) -> ReflectionMetricsResponse:
        metrics = await self._metrics_repository.fetch_metrics(
            start_date=query.start_date,
            end_date=query.end_date,
            app_id=query.app_id,
            quiz_id=query.quiz_id,
        )
        return ReflectionMetricsResponse(metrics=metrics)
