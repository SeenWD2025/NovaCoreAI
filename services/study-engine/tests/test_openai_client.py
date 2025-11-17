"""Tests for the OpenAI quiz client."""
from __future__ import annotations

import json

import pytest
from pytest_httpx import HTTPXMock

from app.clients.openai import OpenAIQuizClient
from app.models.quiz import QuizGenerationRequest
from app.utils.errors import ProviderError


@pytest.mark.asyncio
async def test_openai_generate_quiz_success(sample_note_context, httpx_mock: HTTPXMock) -> None:
    client = OpenAIQuizClient(
        api_key="sk-test",
        model="gpt-4.1",
        base_url="https://api.openai.com/v1",
        timeout_seconds=15.0,
    )

    response_payload = {
        "quiz_id": "quiz-openai",
        "questions": [
            {
                "id": "q1",
                "type": "short_answer",
                "prompt": "Define a neural network.",
                "answer": "A computational model inspired by biological neurons.",
            }
        ],
    }

    httpx_mock.add_response(
        method="POST",
        url="https://api.openai.com/v1/chat/completions",
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(response_payload),
                    }
                }
            ]
        },
    )

    request = QuizGenerationRequest(note_context=sample_note_context, question_count=1)
    result = await client.generate_quiz(request)

    assert result.quiz_id == "quiz-openai"
    assert result.provider == "openai"
    assert result.questions[0].type.value == "short_answer"

    recorded = httpx_mock.get_requests()[0]
    assert recorded.headers["Authorization"].startswith("Bearer sk-test")
    body = json.loads(recorded.content.decode())
    assert body["response_format"]["type"] == "json_object"


@pytest.mark.asyncio
async def test_openai_generate_quiz_invalid_json(sample_note_context, httpx_mock: HTTPXMock) -> None:
    client = OpenAIQuizClient(
        api_key="sk-test",
        model="gpt-4.1",
        base_url="https://api.openai.com/v1",
        timeout_seconds=15.0,
    )

    httpx_mock.add_response(
        method="POST",
        url="https://api.openai.com/v1/chat/completions",
        json={
            "choices": [
                {
                    "message": {
                        "content": "not-json",
                    }
                }
            ]
        },
    )

    request = QuizGenerationRequest(note_context=sample_note_context)
    with pytest.raises(ProviderError):
        await client.generate_quiz(request)
