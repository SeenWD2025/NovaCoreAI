"""FastAPI dependencies and service wiring."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from .clients.intelligence import IntelligenceQuizClient
from .clients.notes import NotesApiClient
from .config import settings
from .database import SessionLocal
from .repositories.quiz_repository import QuizRepository
from .services.interfaces import QuizProvider
from .services.providers.intelligence_provider import IntelligenceProvider
from .services.providers.local_baseline import LocalBaselineProvider
from .services.quiz_generation import QuizGenerationService
from .utils.service_auth import generate_service_token


@lru_cache
def _build_quiz_providers() -> List[QuizProvider]:
    service_token: str | None = None
    try:
        service_token = generate_service_token(settings.service_name)
    except Exception:  # pragma: no cover - token generation optional in dev
        service_token = None

    providers: List[QuizProvider] = []
    intelligence_client = IntelligenceQuizClient(
        base_url=settings.intelligence_service_url,
        timeout_seconds=settings.intelligence_timeout_seconds,
        service_token=service_token,
        default_question_count=settings.default_question_count,
        temperature=settings.temperature,
    )
    providers.append(IntelligenceProvider(intelligence_client))
    providers.append(LocalBaselineProvider())
    return providers


def get_quiz_service() -> QuizGenerationService:
    providers = _build_quiz_providers()
    repository = _get_quiz_repository()
    return QuizGenerationService(providers, repository)


@lru_cache
def get_notes_client() -> NotesApiClient:
    return NotesApiClient(
        base_url=settings.notes_service_url,
        timeout_seconds=settings.notes_client_timeout_seconds,
    )


@lru_cache
def _get_quiz_repository() -> QuizRepository:
    return QuizRepository(session_factory=SessionLocal)
