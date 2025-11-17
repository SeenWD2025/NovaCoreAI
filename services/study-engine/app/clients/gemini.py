"""Gemini client responsible for quiz generation calls."""
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
from ..utils.errors import ProviderError
from ..services.prompt_builder import build_quiz_prompt


class GeminiQuizClient:
    """Google Gemini-powered quiz generator."""

    name = "gemini"

    def __init__(
        self,
        api_key: Optional[str],
        model: str,
        base_url: str,
        timeout_seconds: float,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        """Generate quiz content via the Gemini API."""

        if not self.api_key:
            raise ProviderError(self.name, "API key not configured")

        prompt = build_quiz_prompt(
            request.note_context,
            request,
            settings.temperature,
            settings.default_question_count,
        )
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": settings.temperature,
                "maxOutputTokens": 2048,
            },
        }

        url = f"{self.base_url}/v1beta/models/{self.model}:generateContent"
        params = {"key": self.api_key}

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.post(url, params=params, json=payload)
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network failure path
                raise ProviderError(self.name, "HTTP error", {"detail": str(exc)}) from exc

        try:
            data = response.json()
        except json.JSONDecodeError as exc:  # pragma: no cover
            raise ProviderError(self.name, "Invalid JSON response") from exc

        return self._parse_response(data)

    def _parse_response(self, data: Dict[str, Any]) -> QuizResult:
        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError) as exc:
            raise ProviderError(self.name, "Unexpected response format") from exc

        text_parts = [part.get("text") for part in parts if part.get("text")]
        if not text_parts:
            raise ProviderError(self.name, "Response missing text")
        raw_text = "\n".join(text_parts)
        payload = self._coerce_json(raw_text)

        try:
            questions_payload = payload["questions"]
        except KeyError as exc:
            raise ProviderError(self.name, "Missing questions in response") from exc

        questions = [self._parse_question(question_data) for question_data in questions_payload]
        reflection_data = payload.get("reflection")
        reflection = None
        if reflection_data:
            reflection = QuizReflectionPrompt(**reflection_data)

        quiz_id = payload.get("quiz_id") or "gemini-generated"
        return QuizResult(quiz_id=quiz_id, questions=questions, reflection=reflection, provider=self.name)

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
