"""Provider wrapper for the OpenAI quiz client."""
from __future__ import annotations

from ..interfaces import QuizProvider
from ...clients.openai import OpenAIQuizClient
from ...models.quiz import QuizGenerationRequest, QuizResult
from ...utils.errors import ProviderError


class OpenAIProvider(QuizProvider):
    """Quiz provider backed by OpenAI Chat Completions."""

    def __init__(self, client: OpenAIQuizClient):
        self.client = client
        self.name = client.name

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        try:
            return await self.client.generate_quiz(request)
        except ProviderError:
            raise
        except Exception as exc:  # pragma: no cover - defensive path
            raise ProviderError(self.name, "Unexpected provider error", {"detail": str(exc)}) from exc
