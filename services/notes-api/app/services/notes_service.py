"""Business logic for structured notes operations."""
from typing import List, Optional

from app.models.note import NoteCreate, NoteInDB, NoteResponse, NoteUpdate
from app.repositories.notes_repository import NotesRepository
from app.utils.context_builder import build_markdown_from_components


class NotesService:
    """Coordinate note operations while enforcing invariants."""

    def __init__(self, repository: NotesRepository) -> None:
        self._repository = repository

    async def create_note(self, payload: NoteCreate) -> NoteInDB:
        return await self._repository.create(payload)

    async def get_note(self, note_id: str) -> Optional[NoteInDB]:
        return await self._repository.get(note_id)

    async def list_notes_for_user(
        self,
        user_id: str,
        app_id: Optional[str] = None,
        limit: int = 100,
        include_deleted: bool = False,
    ) -> List[NoteResponse]:
        return await self._repository.list_by_user(
            user_id=user_id,
            app_id=app_id,
            limit=limit,
            include_deleted=include_deleted,
        )

    async def update_note(self, note_id: str, payload: NoteUpdate) -> Optional[NoteInDB]:
        return await self._repository.update(note_id=note_id, update=payload)

    async def delete_note(self, note_id: str) -> bool:
        return await self._repository.delete(note_id)

    async def build_context_markdown(self, note_id: str) -> Optional[str]:
        note = await self._repository.get(note_id)
        if not note or note.is_deleted:
            return None
        return build_markdown_from_components(note.components)

    async def healthy(self) -> bool:
        return await self._repository.health()
