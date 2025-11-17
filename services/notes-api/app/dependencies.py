"""Dependency wiring for FastAPI routes."""
from functools import lru_cache

from app.database import SessionLocal
from app.repositories.notes_repository import NotesRepository
from app.services.notes_service import NotesService


@lru_cache
def _get_repository() -> NotesRepository:
    return NotesRepository(session_factory=SessionLocal)


def get_notes_service() -> NotesService:
    repository = _get_repository()
    return NotesService(repository=repository)
