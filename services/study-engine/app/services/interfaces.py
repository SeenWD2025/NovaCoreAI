"""Protocols describing quiz generation providers."""
from typing import Protocol

from ..models.quiz import QuizGenerationRequest, QuizResult


class QuizProvider(Protocol):
    """Protocol for quiz generation providers."""

    name: str

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        """Generate a quiz for the given request."""
