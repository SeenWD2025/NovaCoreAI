"""PostgreSQL repository for reflection feedback persistence."""
from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, sessionmaker

from ..db_models import ReflectionFeedbackRecordORM
from ..models.reflection_feedback import ReflectionFeedbackRecord


class ReflectionFeedbackRepository:
    """Persist and retrieve reflection feedback records."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    async def _run(self, func, *args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)

    async def upsert_feedback(self, record: ReflectionFeedbackRecord) -> ReflectionFeedbackRecord:
        """Create or update feedback for a quiz session."""

        def _persist() -> ReflectionFeedbackRecord:
            session: Session = self._session_factory()
            try:
                orm_record = ReflectionFeedbackRecordORM(
                    feedback_id=record.feedback_id,
                    session_id=record.session_id,
                    quiz_id=record.quiz_id,
                    app_id=record.app_id,
                    user_id=record.user_id,
                    note_id=record.note_id,
                    quiz_rating=record.quiz_rating,
                    recommendation_rating=record.recommendation_rating,
                    notes=record.notes,
                    metadata_json=record.metadata or {},
                    submitted_at=record.submitted_at,
                    created_at=record.created_at,
                    updated_at=record.updated_at,
                    is_deleted=record.is_deleted,
                    deleted_at=record.deleted_at,
                )
                session.merge(orm_record)
                session.commit()
                refreshed = session.get(ReflectionFeedbackRecordORM, record.feedback_id)
                return self._to_model(refreshed)
            finally:
                session.close()

        return await self._run(_persist)

    async def get_by_session(self, session_id: str) -> Optional[ReflectionFeedbackRecord]:
        """Fetch feedback linked to a specific quiz session."""

        def _get() -> Optional[ReflectionFeedbackRecord]:
            session: Session = self._session_factory()
            try:
                orm_record = (
                    session.query(ReflectionFeedbackRecordORM)
                    .filter(ReflectionFeedbackRecordORM.session_id == session_id)
                    .one_or_none()
                )
                if orm_record is None:
                    return None
                return self._to_model(orm_record)
            finally:
                session.close()

        return await self._run(_get)

    async def calculate_daily_rollups(
        self,
        *,
        start_date: date,
        end_date: date,
        app_id: Optional[str] = None,
        quiz_id: Optional[str] = None,
    ) -> List[Dict[str, object]]:
        """Aggregate reflection feedback into daily rollups."""

        def _calculate() -> List[Dict[str, object]]:
            session: Session = self._session_factory()
            try:
                start_dt = datetime.combine(start_date, time.min)
                end_dt = datetime.combine(end_date + timedelta(days=1), time.min)

                trunc_day = func.date(ReflectionFeedbackRecordORM.submitted_at)

                query = (
                    session.query(
                        trunc_day.label("aggregation_date"),
                        ReflectionFeedbackRecordORM.app_id.label("app_id"),
                        ReflectionFeedbackRecordORM.quiz_id.label("quiz_id"),
                        func.count().label("total_feedback"),
                        func.sum(ReflectionFeedbackRecordORM.quiz_rating).label("quiz_rating_sum"),
                        func.sum(ReflectionFeedbackRecordORM.recommendation_rating).label(
                            "recommendation_rating_sum"
                        ),
                        func.avg(ReflectionFeedbackRecordORM.quiz_rating).label("average_quiz_rating"),
                        func.avg(ReflectionFeedbackRecordORM.recommendation_rating).label(
                            "average_recommendation_rating"
                        ),
                    )
                    .filter(ReflectionFeedbackRecordORM.submitted_at >= start_dt)
                    .filter(ReflectionFeedbackRecordORM.submitted_at < end_dt)
                    .filter(ReflectionFeedbackRecordORM.is_deleted.is_(False))
                )

                if app_id:
                    query = query.filter(ReflectionFeedbackRecordORM.app_id == app_id)
                if quiz_id:
                    query = query.filter(ReflectionFeedbackRecordORM.quiz_id == quiz_id)

                query = query.group_by(trunc_day, ReflectionFeedbackRecordORM.app_id, ReflectionFeedbackRecordORM.quiz_id)

                rows = query.all()
                results: List[Dict[str, object]] = []
                for row in rows:
                    total_feedback = int(row.total_feedback or 0)
                    quiz_sum = int(row.quiz_rating_sum or 0)
                    recommendation_sum = int(row.recommendation_rating_sum or 0)
                    avg_quiz = float(row.average_quiz_rating or 0)
                    avg_recommendation = float(row.average_recommendation_rating or 0)

                    results.append(
                        {
                            "aggregation_date": row.aggregation_date,
                            "app_id": row.app_id,
                            "quiz_id": row.quiz_id,
                            "total_feedback": total_feedback,
                            "quiz_rating_sum": quiz_sum,
                            "recommendation_rating_sum": recommendation_sum,
                            "average_quiz_rating": round(avg_quiz, 4),
                            "average_recommendation_rating": round(avg_recommendation, 4),
                            "quiz_rating_count": total_feedback,
                            "recommendation_rating_count": total_feedback,
                        }
                    )

                return results
            finally:
                session.close()

        return await self._run(_calculate)

    @staticmethod
    def _to_model(orm: ReflectionFeedbackRecordORM) -> ReflectionFeedbackRecord:
        return ReflectionFeedbackRecord(
            feedbackId=orm.feedback_id,
            sessionId=orm.session_id,
            quizId=orm.quiz_id,
            appId=orm.app_id,
            userId=orm.user_id,
            noteId=orm.note_id,
            quizRating=orm.quiz_rating,
            recommendationRating=orm.recommendation_rating,
            notes=orm.notes,
            metadata=orm.metadata_json or {},
            submittedAt=orm.submitted_at,
            createdAt=orm.created_at,
            updatedAt=orm.updated_at,
            isDeleted=orm.is_deleted,
            deletedAt=orm.deleted_at,
        )
