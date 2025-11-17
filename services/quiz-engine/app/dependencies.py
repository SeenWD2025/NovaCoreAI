"""Service wiring and dependency providers for the Quiz Engine."""
from functools import lru_cache

from .database import SessionLocal
from .repositories.quiz_artifact_repository import QuizArtifactRepository
from .repositories.quiz_session_repository import QuizSessionRepository
from .repositories.reflection_feedback_repository import ReflectionFeedbackRepository
from .repositories.reflection_metrics_repository import ReflectionMetricsRepository
from .services.session_management import QuizSessionService
from .services.reflection_feedback import ReflectionFeedbackService
from .services.reflection_analytics import ReflectionAnalyticsService


@lru_cache
def get_quiz_artifact_repository() -> QuizArtifactRepository:
    return QuizArtifactRepository(session_factory=SessionLocal)


@lru_cache
def get_quiz_session_repository() -> QuizSessionRepository:
    return QuizSessionRepository(session_factory=SessionLocal)


@lru_cache
def get_reflection_feedback_repository() -> ReflectionFeedbackRepository:
    return ReflectionFeedbackRepository(session_factory=SessionLocal)


@lru_cache
def get_reflection_metrics_repository() -> ReflectionMetricsRepository:
    return ReflectionMetricsRepository(session_factory=SessionLocal)


def get_quiz_session_service() -> QuizSessionService:
    artifact_repository = get_quiz_artifact_repository()
    session_repository = get_quiz_session_repository()
    return QuizSessionService(artifact_repository, session_repository)


def get_reflection_feedback_service() -> ReflectionFeedbackService:
    session_repository = get_quiz_session_repository()
    feedback_repository = get_reflection_feedback_repository()
    return ReflectionFeedbackService(session_repository, feedback_repository)


def get_reflection_analytics_service() -> ReflectionAnalyticsService:
    feedback_repository = get_reflection_feedback_repository()
    metrics_repository = get_reflection_metrics_repository()
    return ReflectionAnalyticsService(feedback_repository, metrics_repository)
