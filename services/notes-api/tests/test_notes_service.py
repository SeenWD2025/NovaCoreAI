"""Tests for NotesService orchestration logic."""
from datetime import datetime

import pytest

from app.models.note import NoteInDB
from app.services.notes_service import NotesService


class FakeRepository:
    """Simple in-memory repository stub for service tests."""

    def __init__(self, note=None):
        self.note = note
        self.list_params = None

    async def get(self, note_id: str):  # pragma: no cover - signature compatibility
        return self.note

    async def list_by_user(self, **kwargs):  # pragma: no cover - signature compatibility
        self.list_params = kwargs
        return []

    async def create(self, payload):  # pragma: no cover - not used in tests
        return payload

    async def update(self, note_id, update):  # pragma: no cover - not used in tests
        return None

    async def delete(self, note_id):  # pragma: no cover - not used in tests
        return False

    async def health(self):  # pragma: no cover - not used
        return True


def _build_note(is_deleted: bool = False):
    now = datetime.utcnow()
    payload = {
        "noteId": "note-1",
        "userId": "user-123",
        "appId": "nova-app",
        "sessionId": "session-456",
        "title": "Physics Fundamentals",
        "components": [
            {
                "componentId": "cmp-1",
                "componentType": "HEADER",
                "content": "Physics Fundamentals",
                "sequence": 0,
            },
            {
                "componentId": "cmp-2",
                "componentType": "EXPLANATION",
                "content": "Energy cannot be created or destroyed.",
                "sequence": 1,
            },
        ],
        "tags": ["physics"],
        "retentionPolicyDays": 365,
        "quizGenerationRequested": False,
        "metadata": {
            "source": "note-builder",
            "courseId": "phys-101",
            "curriculumPath": "module-1",
            "extra": {},
        },
        "isDeleted": is_deleted,
        "deletedAt": None,
        "createdAt": now,
        "updatedAt": now,
    }
    return NoteInDB.model_validate(payload)


@pytest.mark.asyncio
async def test_build_context_markdown_returns_value_for_active_note():
    note = _build_note()
    repository = FakeRepository(note=note)
    service = NotesService(repository=repository)

    context = await service.build_context_markdown("note-1")

    assert context.startswith("# Physics Fundamentals")
    assert "Energy cannot be created or destroyed." in context


@pytest.mark.asyncio
async def test_build_context_markdown_returns_none_for_deleted_note():
    note = _build_note(is_deleted=True)
    repository = FakeRepository(note=note)
    service = NotesService(repository=repository)

    context = await service.build_context_markdown("note-1")

    assert context is None


@pytest.mark.asyncio
async def test_list_notes_for_user_forwards_parameters():
    repository = FakeRepository()
    service = NotesService(repository=repository)

    await service.list_notes_for_user("user-123", app_id="nova-app", limit=10, include_deleted=True)

    assert repository.list_params == {
        "user_id": "user-123",
        "app_id": "nova-app",
        "limit": 10,
        "include_deleted": True,
    }
