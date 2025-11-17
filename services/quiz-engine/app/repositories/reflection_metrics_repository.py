"""Repository for storing and retrieving daily reflection metrics."""
from __future__ import annotations

import asyncio
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session, sessionmaker

from ..db_models import ReflectionMetricsDailyRecordORM
from ..models.reflection_analytics import DailyReflectionMetric


class ReflectionMetricsRepository:
    """Manage persistence for aggregated reflection metrics."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    async def _run(self, func, *args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)

    async def upsert_metric(self, metric: DailyReflectionMetric) -> DailyReflectionMetric:
        """Insert or update a single aggregated metric row."""

        def _persist() -> DailyReflectionMetric:
            session: Session = self._session_factory()
            try:
                existing = (
                    session.query(ReflectionMetricsDailyRecordORM)
                    .filter(
                        ReflectionMetricsDailyRecordORM.aggregation_date == metric.aggregation_date,
                        ReflectionMetricsDailyRecordORM.app_id == metric.app_id,
                        ReflectionMetricsDailyRecordORM.quiz_id == metric.quiz_id,
                    )
                    .one_or_none()
                )

                if existing is None:
                    existing = ReflectionMetricsDailyRecordORM(
                        aggregation_date=metric.aggregation_date,
                        app_id=metric.app_id,
                        quiz_id=metric.quiz_id,
                        total_feedback=metric.total_feedback,
                        quiz_rating_sum=metric.quiz_rating_sum,
                        recommendation_rating_sum=metric.recommendation_rating_sum,
                        average_quiz_rating=metric.average_quiz_rating,
                        average_recommendation_rating=metric.average_recommendation_rating,
                        quiz_rating_count=metric.quiz_rating_count,
                        recommendation_rating_count=metric.recommendation_rating_count,
                        created_at=metric.created_at,
                        updated_at=metric.updated_at,
                    )
                    session.add(existing)
                else:
                    existing.total_feedback = metric.total_feedback
                    existing.quiz_rating_sum = metric.quiz_rating_sum
                    existing.recommendation_rating_sum = metric.recommendation_rating_sum
                    existing.average_quiz_rating = metric.average_quiz_rating
                    existing.average_recommendation_rating = metric.average_recommendation_rating
                    existing.quiz_rating_count = metric.quiz_rating_count
                    existing.recommendation_rating_count = metric.recommendation_rating_count
                    existing.updated_at = metric.updated_at

                session.commit()
                session.refresh(existing)
                return self._to_model(existing)
            finally:
                session.close()

        return await self._run(_persist)

    async def fetch_metrics(
        self,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        app_id: Optional[str] = None,
        quiz_id: Optional[str] = None,
    ) -> List[DailyReflectionMetric]:
        """Retrieve aggregated metrics within the requested range."""

        def _fetch() -> List[DailyReflectionMetric]:
            session: Session = self._session_factory()
            try:
                query = session.query(ReflectionMetricsDailyRecordORM)
                if start_date is not None:
                    query = query.filter(ReflectionMetricsDailyRecordORM.aggregation_date >= start_date)
                if end_date is not None:
                    query = query.filter(ReflectionMetricsDailyRecordORM.aggregation_date <= end_date)
                if app_id is not None:
                    query = query.filter(ReflectionMetricsDailyRecordORM.app_id == app_id)
                if quiz_id is not None:
                    query = query.filter(ReflectionMetricsDailyRecordORM.quiz_id == quiz_id)

                query = query.order_by(
                    ReflectionMetricsDailyRecordORM.aggregation_date.desc(),
                    ReflectionMetricsDailyRecordORM.app_id,
                    ReflectionMetricsDailyRecordORM.quiz_id,
                )

                records = query.all()
                return [self._to_model(record) for record in records]
            finally:
                session.close()

        return await self._run(_fetch)

    @staticmethod
    def _to_model(record: ReflectionMetricsDailyRecordORM) -> DailyReflectionMetric:
        return DailyReflectionMetric(
            aggregationDate=record.aggregation_date,
            appId=record.app_id,
            quizId=record.quiz_id,
            totalFeedback=record.total_feedback,
            quizRatingSum=record.quiz_rating_sum,
            recommendationRatingSum=record.recommendation_rating_sum,
            averageQuizRating=float(record.average_quiz_rating),
            averageRecommendationRating=float(record.average_recommendation_rating),
            quizRatingCount=record.quiz_rating_count,
            recommendationRatingCount=record.recommendation_rating_count,
            createdAt=record.created_at,
            updatedAt=record.updated_at,
        )
