"""Quiz generation endpoints served by Intelligence Core."""
from __future__ import annotations

import json
import logging
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.services.llm_router import llm_orchestrator, ProviderExhaustedError, ProviderError
from app.utils.service_auth import verify_service_token_dependency, ServiceTokenPayload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quiz", tags=["quiz"])

DEFAULT_SYSTEM_PROMPT = (
    "You are Nova Intelligence, responsible for generating structured study quizzes "
    "for the Nova Study Engine. Always respond with strictly valid JSON."
)


async def _invoke_llm(prompt: str, temperature: float) -> Dict[str, Any]:
    try:
        provider_result = await llm_orchestrator.generate_response(
            prompt=prompt,
            system_prompt=DEFAULT_SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=2048,
        )
    except ProviderExhaustedError as exc:  # pragma: no cover - defensive guard
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="All LLM providers failed") from exc
    except ProviderError as exc:  # pragma: no cover - surface provider issues
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - unknown error path
        logger.exception("Quiz generation request failed", exc_info=exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Quiz generation failed") from exc

    payload = _parse_quiz_payload(provider_result.content)
    quiz_id = payload.get("quizId") or payload.get("quiz_id")
    payload["quizId"] = quiz_id or _generate_quiz_id()
    payload["provider"] = provider_result.provider
    if "questions" not in payload or not isinstance(payload["questions"], list):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Quiz response missing questions")
    return {"quiz": payload}


def _parse_quiz_payload(raw_text: str) -> Dict[str, Any]:
    try:
        return _coerce_json(raw_text)
    except ValueError as exc:
        logger.error("Failed to parse quiz JSON", extra={"preview": raw_text[:200]})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid quiz response format") from exc


def _coerce_json(raw_text: str) -> Dict[str, Any]:
    candidate = raw_text.strip()
    if candidate.startswith("```"):
        candidate = candidate.strip("`")
        if candidate.lower().startswith("json"):
            candidate = candidate[4:].lstrip()
    return json.loads(candidate)


def _generate_quiz_id() -> str:
    return f"intelligence-{uuid4()}"


@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_quiz(
    payload: Dict[str, Any],
    service: ServiceTokenPayload = Depends(verify_service_token_dependency),
) -> Dict[str, Any]:
    """Generate a quiz using Intelligence LLM orchestration."""

    prompt = payload.get("prompt")
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prompt is required")

    temperature = payload.get("temperature")
    if not isinstance(temperature, (int, float)):
        temperature = 0.4

    logger.info(
        "Quiz generation request received",
        extra={"service": service.service_name, "temperature": temperature},
    )

    response = await _invoke_llm(prompt, float(temperature))
    return response
