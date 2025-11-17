"""OpenAI-based quiz generation client."""
from __future__ import annotations

import json
from typing import Any, Dict, Optional

import httpx

from ..config import settings
from ..models.quiz import (
    QuestionType,
    QuizGenerationRequest,
    QuizQuestion,
    QuizQuestionOption,
    QuizReflectionPrompt,
    QuizResult,
)
from ..services.prompt_builder import build_quiz_prompt
from ..utils.errors import ProviderError


class OpenAIQuizClient:
    """Client wrapping the OpenAI Chat Completions API for quiz generation."""

    name = "openai"

    def __init__(
        self,
        api_key: Optional[str],
        model: str,
        base_url: str,
        timeout_seconds: float,
        organization: Optional[str] = None,
        project: Optional[str] = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.organization = organization
        self.project = project

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        if not self.api_key:
            raise ProviderError(self.name, "API key not configured")

        prompt = build_quiz_prompt(
            request.note_context,
            request,
            settings.temperature,
            settings.default_question_count,
        )

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "temperature": settings.temperature,
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.organization:
            headers["OpenAI-Organization"] = self.organization
        if self.project:
            headers["OpenAI-Project"] = self.project

        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network failure path
                raise ProviderError(self.name, "HTTP error", {"detail": str(exc)}) from exc

        try:
            data = response.json()
        except json.JSONDecodeError as exc:  # pragma: no cover
            raise ProviderError(self.name, "Invalid JSON response") from exc

        raw_text = self._extract_text(data)
        payload_json = self._coerce_json(raw_text)
        questions_payload = payload_json.get("questions")
        if not questions_payload:
            raise ProviderError(self.name, "Missing questions in response")

        questions = [self._parse_question(question_data) for question_data in questions_payload]
        reflection_data = payload_json.get("reflection")
        reflection = QuizReflectionPrompt(**reflection_data) if reflection_data else None
        quiz_id = payload_json.get("quiz_id") or "openai-generated"
        return QuizResult(quiz_id=quiz_id, questions=questions, reflection=reflection, provider=self.name)

    def _extract_text(self, data: Dict[str, Any]) -> str:
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise ProviderError(self.name, "Unexpected response format") from exc

    def _coerce_json(self, raw_text: str) -> Dict[str, Any]:
        candidate = raw_text.strip()
        if candidate.startswith("```"):
            candidate = candidate.strip("`")
            if candidate.lower().startswith("json"):
                candidate = candidate[4:].lstrip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            raise ProviderError(self.name, "Unable to parse JSON response", {"text": raw_text[:2000]}) from exc

    def _parse_question(self, question_data: Dict[str, Any]) -> QuizQuestion:
        try:
            question_type = QuestionType(question_data.get("type", QuestionType.MULTIPLE_CHOICE))
        except ValueError as exc:
            raise ProviderError(self.name, "Unsupported question type", question_data) from exc

        options_payload = question_data.get("options") or []
        options = [QuizQuestionOption(**option) for option in options_payload] or None

        try:
            prompt = question_data["prompt"]
        except KeyError as exc:
            raise ProviderError(self.name, "Question missing prompt", question_data) from exc

        return QuizQuestion(
            id=question_data.get("id") or question_data.get("question_id") or "q1",
            prompt=prompt,
            type=question_type,
            options=options,
            answer=question_data.get("answer"),
            answer_explanation=question_data.get("answer_explanation"),
            metadata=question_data.get("metadata", {}),
        )


__all__ = ["OpenAIQuizClient"]
