"""Tests for the Gemini quiz client."""
from __future__ import annotations

import json

import pytest
from pytest_httpx import HTTPXMock

from app.clients.gemini import GeminiQuizClient
from app.models.quiz import QuizGenerationRequest
from app.utils.errors import ProviderError


@pytest.mark.asyncio
async def test_generate_quiz_success(sample_note_context, httpx_mock: HTTPXMock) -> None:
    client = GeminiQuizClient(
        api_key="test-key",
        model="models/gemini-2.5-flash-preview-09-2025",
        base_url="https://generativelanguage.googleapis.com",
        timeout_seconds=10.0,
    )

    payload = {
        "quiz_id": "quiz-123",
        "questions": [
            {
                "id": "q1",
                "type": "multiple_choice",
                "prompt": "What is a neural network?",
                "options": [
                    {"label": "A", "text": "A computational model", "is_correct": True},
                    {"label": "B", "text": "A biological neuron", "is_correct": False},
                ],
                "answer": "A",
                "answer_explanation": "Neural networks are computational models.",
            }
        ],
        "reflection": {
            "prompt": "Where could you apply neural networks?",
            "guidance": "Give an example from the note.",
        },
    }

    httpx_mock.add_response(
        method="POST",
        url="https://generativelanguage.googleapis.com/v1beta/models/models/gemini-2.5-flash-preview-09-2025:generateContent?key=test-key",
        json={
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(payload),
                            }
                        ]
                    }
                }
            ]
        },
    )

    request = QuizGenerationRequest(note_context=sample_note_context, question_count=1, include_reflection=True)
    result = await client.generate_quiz(request)

    assert result.quiz_id == "quiz-123"
    assert result.provider == "gemini"
    assert result.questions[0].prompt == "What is a neural network?"

    recorded_request = httpx_mock.get_requests()[0]
    recorded_body = json.loads(recorded_request.content.decode())
    assert "Neural Networks 101" in recorded_body["contents"][0]["parts"][0]["text"]


@pytest.mark.asyncio
async def test_generate_quiz_invalid_payload(sample_note_context, httpx_mock: HTTPXMock) -> None:
    client = GeminiQuizClient(
        api_key="test-key",
        model="models/gemini-2.5-flash-preview-09-2025",
        base_url="https://generativelanguage.googleapis.com",
        timeout_seconds=10.0,
    )

    httpx_mock.add_response(
        method="POST",
        url="https://generativelanguage.googleapis.com/v1beta/models/models/gemini-2.5-flash-preview-09-2025:generateContent?key=test-key",
        json={
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": "not-json",
                            }
                        ]
                    }
                }
            ]
        },
    )

    request = QuizGenerationRequest(note_context=sample_note_context, question_count=1)
    with pytest.raises(ProviderError):
        await client.generate_quiz(request)
