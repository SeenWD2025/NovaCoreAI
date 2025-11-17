"""Service wiring and dependency providers for the Quiz Engine."""
from functools import lru_cache

from .database import SessionLocal
from .repositories.quiz_artifact_repository import QuizArtifactRepository
from .repositories.quiz_session_repository import QuizSessionRepository
from .services.session_management import QuizSessionService


@lru_cache
def get_quiz_artifact_repository() -> QuizArtifactRepository:
    return QuizArtifactRepository(session_factory=SessionLocal)


@lru_cache
def get_quiz_session_repository() -> QuizSessionRepository:
    return QuizSessionRepository(session_factory=SessionLocal)


def get_quiz_session_service() -> QuizSessionService:
    artifact_repository = get_quiz_artifact_repository()
    session_repository = get_quiz_session_repository()
    return QuizSessionService(artifact_repository, session_repository)
