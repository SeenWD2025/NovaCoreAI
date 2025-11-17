"""HTTP client for delegating quiz generation to the Intelligence service."""
from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from pydantic import ValidationError

from ..models.quiz import QuizGenerationRequest, QuizGenerationResponse, QuizResult
from ..services.prompt_builder import build_quiz_prompt
from ..utils.errors import ProviderError


class IntelligenceQuizClient:
    """Adapter that forwards quiz generation requests to Intelligence Core."""

    name = "intelligence"

    def __init__(
        self,
        base_url: str,
        timeout_seconds: float = 60.0,
        *,
        service_token: Optional[str] = None,
        default_question_count: int,
        temperature: float,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._service_token = service_token
        self._default_question_count = default_question_count
        self._temperature = temperature

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._service_token:
            headers["X-Service-Token"] = self._service_token
        return headers

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        prompt = build_quiz_prompt(
            request.note_context,
            request,
            self._temperature,
            self._default_question_count,
        )

        payload: Dict[str, Any] = {
            "prompt": prompt,
            "questionCount": request.question_count,
            "includeReflection": request.include_reflection,
            "provider": self.name,
            "temperature": self._temperature,
        }

        url = f"{self.base_url}/quiz/generate"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.post(url, json=payload, headers=self._headers())
            except httpx.HTTPError as exc:  # pragma: no cover - network failure path
                raise ProviderError(self.name, "Failed to reach intelligence service", {"detail": str(exc)}) from exc

        if response.status_code >= 500:
            raise ProviderError(self.name, "Intelligence service error", {"status": response.status_code})
        if response.status_code >= 400:
            raise ProviderError(self.name, "Invalid request to intelligence service", _safe_json(response))

        data = _safe_json(response)

        try:
            parsed = QuizGenerationResponse.model_validate(data)
        except ValidationError as exc:
            raise ProviderError(self.name, "Unexpected intelligence response", {"errors": exc.errors()}) from exc

        quiz = parsed.quiz
        if not quiz.provider:
            quiz.provider = self.name
        return quiz


def _safe_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        return response.json()
    except ValueError as exc:  # pragma: no cover - invalid JSON path
        raise ProviderError("intelligence", "Invalid JSON response from intelligence") from exc


__all__ = ["IntelligenceQuizClient"]
