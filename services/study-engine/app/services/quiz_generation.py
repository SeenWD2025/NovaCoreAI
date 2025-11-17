"""Core orchestration service for quiz generation."""
from collections.abc import Sequence
from typing import List, Optional, Tuple
from uuid import uuid4

from ..models.quiz import QuizGenerationRequest, QuizResult
from ..utils.errors import ProviderError, QuizGenerationError
from .interfaces import QuizProvider
from ..repositories.quiz_repository import QuizRepository


class QuizGenerationService:
    """Coordinates quiz generation across multiple providers."""

    def __init__(self, providers: Sequence[QuizProvider], repository: Optional[QuizRepository] = None):
        if not providers:
            raise ValueError("At least one provider must be configured")
        self.providers: List[QuizProvider] = list(providers)
        self.repository = repository

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        """Attempt quiz generation across providers in priority order."""

        errors: List[ProviderError] = []
        for provider in self.providers:
            try:
                quiz = await provider.generate_quiz(request)
                quiz_id, provider_quiz_id = self._assign_quiz_id(quiz)
                if self.repository:
                    await self.repository.save_quiz(request, quiz, provider_quiz_id)
                return quiz
            except ProviderError as exc:
                errors.append(exc)
        raise QuizGenerationError(errors)

    @staticmethod
    def _generate_quiz_id() -> str:
        return str(uuid4())

    def _assign_quiz_id(self, quiz: QuizResult) -> Tuple[str, str]:
        provider_quiz_id = quiz.quiz_id or ""
        sanitized = provider_quiz_id
        if not sanitized or provider_quiz_id in {"gemini-generated", "openai-generated", "baseline", "baseline-generated"}:
            sanitized = self._generate_quiz_id()
        quiz.quiz_id = sanitized
        return sanitized, provider_quiz_id
