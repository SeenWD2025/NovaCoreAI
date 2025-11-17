"""API routes for structured notes."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_notes_service
from app.models.note import NoteCreate, NoteResponse, NoteUpdate
from app.services.notes_service import NotesService

router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    service: NotesService = Depends(get_notes_service),
) -> NoteResponse:
    note = await service.create_note(payload)
    return NoteResponse.model_validate(note.model_dump())


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: str,
    service: NotesService = Depends(get_notes_service),
) -> NoteResponse:
    note = await service.get_note(note_id)
    if not note or note.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return NoteResponse.model_validate(note.model_dump())


@router.get("/by-user/{user_id}", response_model=List[NoteResponse])
async def list_notes_for_user(
    user_id: str,
    app_id: str | None = None,
    limit: int = 100,
    include_deleted: bool = False,
    service: NotesService = Depends(get_notes_service),
) -> List[NoteResponse]:
    notes = await service.list_notes_for_user(
        user_id=user_id,
        app_id=app_id,
        limit=limit,
        include_deleted=include_deleted,
    )
    return notes


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    payload: NoteUpdate,
    service: NotesService = Depends(get_notes_service),
) -> NoteResponse:
    note = await service.update_note(note_id=note_id, payload=payload)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return NoteResponse.model_validate(note.model_dump())


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    service: NotesService = Depends(get_notes_service),
) -> None:
    deleted = await service.delete_note(note_id=note_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")


@router.get("/{note_id}/context")
async def get_note_context(
    note_id: str,
    service: NotesService = Depends(get_notes_service),
) -> dict:
    context = await service.build_context_markdown(note_id)
    if context is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return {
        "noteId": note_id,
        "contextMarkdown": context,
    }
