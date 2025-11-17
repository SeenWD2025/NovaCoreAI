"""Provider wrapper around the Intelligence Core quiz endpoint."""
from __future__ import annotations

from ..interfaces import QuizProvider
from ...clients.intelligence import IntelligenceQuizClient
from ...models.quiz import QuizGenerationRequest, QuizResult
from ...utils.errors import ProviderError


class IntelligenceProvider(QuizProvider):
    """Quiz provider backed by the Intelligence service orchestration."""

    def __init__(self, client: IntelligenceQuizClient) -> None:
        self.client = client
        self.name = client.name

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        try:
            return await self.client.generate_quiz(request)
        except ProviderError:
            raise
        except Exception as exc:  # pragma: no cover - defensive guard
            raise ProviderError(self.name, "Unexpected provider error", {"detail": str(exc)}) from exc


__all__ = ["IntelligenceProvider"]
