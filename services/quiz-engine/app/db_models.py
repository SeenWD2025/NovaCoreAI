"""SQLAlchemy ORM models for the Quiz Engine."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from .config import settings
from .database import Base


class QuizArtifactRecord(Base):
    """Quiz artifact persisted by the Study Engine."""

    __tablename__ = settings.quiz_artifacts_table

    quiz_id = Column(String, primary_key=True, nullable=False)
    provider = Column(String, nullable=True)
    note_id = Column(String, nullable=True, index=True)
    app_id = Column(String, nullable=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    question_count = Column(Integer, nullable=True)
    requested_question_count = Column(Integer, nullable=True)
    requested_question_types = Column(JSONB, nullable=True)
    question_types = Column(JSONB, nullable=True)
    include_reflection = Column(Boolean, nullable=True)
    questions = Column(JSONB, nullable=False, default=list)
    reflection = Column(JSONB, nullable=True)
    metadata_json = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class QuizSessionRecordORM(Base):
    """Quiz session stored for lifecycle management."""

    __tablename__ = settings.quiz_sessions_table

    session_id = Column(String, primary_key=True, nullable=False)
    quiz_id = Column(String, ForeignKey(f"{settings.quiz_artifacts_table}.quiz_id"), nullable=False, index=True)
    app_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    note_id = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="in_progress")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column("metadata", JSONB, nullable=False, default=dict)
    quiz_snapshot = Column(JSONB, nullable=False)
    answers = Column(JSONB, nullable=False, default=list)
    results = Column(JSONB, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"QuizSessionRecordORM(session_id={self.session_id!r}, quiz_id={self.quiz_id!r})"


class ReflectionFeedbackRecordORM(Base):
    """Stores post-quiz reflection feedback ratings."""

    __tablename__ = settings.reflection_feedback_table

    feedback_id = Column(String, primary_key=True, nullable=False)
    session_id = Column(
        String,
        ForeignKey(f"{settings.quiz_sessions_table}.session_id"),
        nullable=False,
        unique=True,
        index=True,
    )
    quiz_id = Column(String, nullable=False, index=True)
    app_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    note_id = Column(String, nullable=True, index=True)
    quiz_rating = Column(Integer, nullable=False)
    recommendation_rating = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    metadata_json = Column("metadata", JSONB, nullable=False, default=dict)
    submitted_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"ReflectionFeedbackRecordORM(session_id={self.session_id!r}, quiz_id={self.quiz_id!r})"


class ReflectionMetricsDailyRecordORM(Base):
    """Stores aggregated reflection metrics for analytics consumption."""

    __tablename__ = settings.reflection_metrics_table

    aggregation_date = Column(Date, primary_key=True, nullable=False)
    app_id = Column(String, primary_key=True, nullable=False)
    quiz_id = Column(String, primary_key=True, nullable=False)
    total_feedback = Column(Integer, nullable=False)
    quiz_rating_sum = Column(Integer, nullable=False)
    recommendation_rating_sum = Column(Integer, nullable=False)
    average_quiz_rating = Column(Numeric(5, 2), nullable=False)
    average_recommendation_rating = Column(Numeric(5, 2), nullable=False)
    quiz_rating_count = Column(Integer, nullable=False)
    recommendation_rating_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return (
            "ReflectionMetricsDailyRecordORM("
            f"aggregation_date={self.aggregation_date!r}, app_id={self.app_id!r}, quiz_id={self.quiz_id!r}"
            ")"
        )
