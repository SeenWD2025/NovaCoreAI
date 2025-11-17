"""Integration tests for the quiz generation API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app import app
from app.dependencies import get_notes_client, get_quiz_service
from app.models.note_context import NoteContext
from app.models.quiz import QuizGenerationResponse
from app.services.providers.local_baseline import LocalBaselineProvider
from app.services.quiz_generation import QuizGenerationService
from app.utils.errors import NotesServiceError, ProviderError


class _StubRepository:
    def __init__(self) -> None:
        self.saved = []

    async def save_quiz(self, request, quiz, provider_quiz_id):  # type: ignore[override]
        self.saved.append((request, quiz, provider_quiz_id))
        return quiz.quiz_id


class _StubNotesClient:
    def __init__(self, context: NoteContext | None) -> None:
        self._context = context

    async def get_note_context(self, note_id: str) -> NoteContext:
        if self._context is None:
            raise NotesServiceError(404, "Note not found")
        return self._context


class _FailingProvider:
    name = "failing"

    async def generate_quiz(self, request):  # type: ignore[override]
        raise ProviderError(self.name, "Forced failure")


@pytest.mark.asyncio
async def test_generate_quiz_with_baseline(sample_note_context: NoteContext) -> None:
    app.dependency_overrides[get_notes_client] = lambda: _StubNotesClient(sample_note_context)
    repository = _StubRepository()
    app.dependency_overrides[get_quiz_service] = lambda: QuizGenerationService([LocalBaselineProvider()], repository)

    try:
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/quiz/generate",
                json={"noteId": "note-1", "questionCount": 1},
            )

        assert response.status_code == 201
        data = QuizGenerationResponse.model_validate(response.json())
        assert data.quiz.provider == "baseline"
        assert repository.saved
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_generate_quiz_with_fallback(sample_note_context: NoteContext) -> None:
    repository = _StubRepository()
    service = QuizGenerationService([_FailingProvider(), LocalBaselineProvider()], repository)
    app.dependency_overrides[get_notes_client] = lambda: _StubNotesClient(sample_note_context)
    app.dependency_overrides[get_quiz_service] = lambda: service

    try:
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/quiz/generate",
                json={"noteId": "note-1", "includeReflection": False},
            )

        assert response.status_code == 201
        assert response.json()["quiz"]["provider"] == "baseline"
        assert repository.saved
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_generate_quiz_failure(sample_note_context: NoteContext) -> None:
    service = QuizGenerationService([_FailingProvider()])
    app.dependency_overrides[get_notes_client] = lambda: _StubNotesClient(sample_note_context)
    app.dependency_overrides[get_quiz_service] = lambda: service

    try:
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/quiz/generate", json={"noteId": "note-1"})

        assert response.status_code == 502
        detail = response.json()["detail"]
        assert detail[0]["provider"] == "failing"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_generate_quiz_note_missing() -> None:
    app.dependency_overrides[get_notes_client] = lambda: _StubNotesClient(None)
    app.dependency_overrides[get_quiz_service] = lambda: QuizGenerationService([LocalBaselineProvider()])

    try:
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/quiz/generate", json={"noteId": "missing"})

        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
