"""Pytest configuration for the Study Engine service."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.models.note_context import NoteComponent, NoteContext, NoteSection  # noqa: E402


@pytest.fixture
def sample_note_context() -> NoteContext:
    component = NoteComponent(id="component-1", type="HEADER", text="Neural networks are computational models.")
    section = NoteSection(
        id="section-1",
        heading="Neural Networks",
        summary="Overview of neural network fundamentals.",
        keywords=["neural networks", "ai"],
        components=[component],
    )
    return NoteContext(
        id="note-1",
        user_id="user-1",
        app_id="nova-app",
        session_id="session-1",
        title="Neural Networks 101",
        summary="Introduction to neural networks",
        topics=["machine learning"],
        tags=["ai", "ml"],
        difficulty="intermediate",
        sections=[section],
        rawText="Neural networks ...",
        metadata={"course": "CS101"},
    )
