"""Tests for the Notes API client adapter."""
from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from app.clients.notes import NotesApiClient
from app.utils.errors import NotesServiceError


@pytest.mark.asyncio
async def test_get_note_context(httpx_mock: HTTPXMock) -> None:
    client = NotesApiClient(base_url="http://notes-api:8085", timeout_seconds=5.0)

    note_response = {
        "noteId": "note-1",
        "userId": "user-123",
        "appId": "nova-app",
        "sessionId": "session-456",
        "title": "Calculus Basics",
        "components": [
            {
                "componentId": "comp-1",
                "componentType": "HEADER",
                "content": "Limits and derivatives",
                "metadata": {"heading": "Limits", "keywords": ["limits"]},
            }
        ],
        "tags": ["math"],
        "metadata": {"extra": {"topics": ["calculus"]}},
    }

    httpx_mock.add_response(
        method="GET",
        url="http://notes-api:8085/notes/note-1",
        json=note_response,
    )
    httpx_mock.add_response(
        method="GET",
        url="http://notes-api:8085/notes/note-1/context",
        json={"noteId": "note-1", "contextMarkdown": "# Calculus"},
    )

    context = await client.get_note_context("note-1")
    assert context.note_id == "note-1"
    assert context.sections[0].components[0].text == "Limits and derivatives"
    assert context.raw_text == "# Calculus"
    assert context.topics == ["calculus"]
    assert context.user_id == "user-123"
    assert context.app_id == "nova-app"
    assert context.session_id == "session-456"


@pytest.mark.asyncio
async def test_get_note_context_not_found(httpx_mock: HTTPXMock) -> None:
    client = NotesApiClient(base_url="http://notes-api:8085", timeout_seconds=5.0)

    httpx_mock.add_response(
        method="GET",
        url="http://notes-api:8085/notes/missing",
        status_code=404,
        json={"detail": "Not found"},
    )

    with pytest.raises(NotesServiceError) as exc:
        await client.get_note_context("missing")
    assert exc.value.status_code == 404
