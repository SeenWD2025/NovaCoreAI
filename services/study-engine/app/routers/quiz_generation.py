"""Quiz generation endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status

from ..clients.notes import NotesApiClient
from ..dependencies import get_notes_client, get_quiz_service
from ..models.note_context import NoteContext
from ..models.quiz import (
    QuizGenerationInput,
    QuizGenerationRequest,
    QuizGenerationResponse,
)
from ..services.quiz_generation import QuizGenerationService
from ..utils.errors import NotesServiceError, QuizGenerationError

router = APIRouter()


@router.post(
    "/generate",
    response_model=QuizGenerationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a study quiz from structured note context",
)
async def generate_quiz(
    payload: QuizGenerationInput,
    service: QuizGenerationService = Depends(get_quiz_service),
    notes_client: NotesApiClient = Depends(get_notes_client),
) -> QuizGenerationResponse:
    note_context: NoteContext
    if payload.note_context is not None:
        note_context = payload.note_context
    else:
        assert payload.note_id is not None  # for type checkers
        try:
            note_context = await notes_client.get_note_context(payload.note_id)
        except NotesServiceError as exc:
            status_code = exc.status_code if 400 <= exc.status_code < 500 else status.HTTP_502_BAD_GATEWAY
            raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    request = QuizGenerationRequest(
        note_context=note_context,
        question_count=payload.question_count,
        question_types=payload.question_types,
        include_reflection=payload.include_reflection,
    )

    try:
        quiz = await service.generate_quiz(request)
        return QuizGenerationResponse(quiz=quiz)
    except QuizGenerationError as exc:
        detail = [
            {"provider": error.provider, "message": str(error), "details": error.details}
            for error in exc.errors
        ]
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
