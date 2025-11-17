"""Unit tests for the quiz generation orchestration service."""
from __future__ import annotations

import pytest

from app.models.quiz import QuestionType, QuizGenerationRequest, QuizQuestion, QuizResult
from app.services.quiz_generation import QuizGenerationService


class _StubProvider:
    name = "stub"

    async def generate_quiz(self, request):  # type: ignore[override]
        question = QuizQuestion(id="q1", prompt="What is AI?", type=QuestionType.SHORT_ANSWER)
        return QuizResult(quiz_id="gemini-generated", questions=[question], reflection=None, provider=self.name)


class _StubRepository:
    def __init__(self) -> None:
        self.saved = []

    async def save_quiz(self, request, quiz, provider_quiz_id):  # type: ignore[override]
        self.saved.append((request, quiz, provider_quiz_id))
        return quiz.quiz_id


@pytest.mark.asyncio
async def test_quiz_generation_service_persists_and_rewrites_id(sample_note_context):
    repository = _StubRepository()
    service = QuizGenerationService([_StubProvider()], repository)
    request = QuizGenerationRequest(note_context=sample_note_context)

    result = await service.generate_quiz(request)

    assert repository.saved
    stored_request, stored_quiz, provider_quiz_id = repository.saved[0]
    assert stored_request.note_context.note_id == sample_note_context.note_id
    assert provider_quiz_id == "gemini-generated"
    assert stored_quiz.quiz_id == result.quiz_id
    assert result.quiz_id != "gemini-generated"