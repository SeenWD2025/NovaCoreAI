"""Routers for quiz session management."""
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..dependencies import get_quiz_session_service
from ..models.quiz_session import QuizSessionCreateRequest, QuizSessionResponse
from ..services.errors import (
    QuizArtifactNotFoundError,
    QuizOwnershipMismatchError,
    QuizSessionNotFoundError,
    QuizSessionPersistenceError,
)
from ..services.session_management import QuizSessionService

router = APIRouter(prefix="/sessions")


@router.post(
    "",
    response_model=QuizSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new quiz session",
)
async def create_session(
    payload: QuizSessionCreateRequest,
    service: QuizSessionService = Depends(get_quiz_session_service),
) -> QuizSessionResponse:
    try:
        return await service.create_session(payload)
    except QuizArtifactNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except QuizOwnershipMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except QuizSessionPersistenceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get(
    "/{session_id}",
    response_model=QuizSessionResponse,
    summary="Retrieve an existing quiz session",
)
async def get_session(
    session_id: str,
    app_id: str = Query(..., alias="appId"),
    user_id: str = Query(..., alias="userId"),
    service: QuizSessionService = Depends(get_quiz_session_service),
) -> QuizSessionResponse:
    try:
        return await service.get_session(session_id, app_id=app_id, user_id=user_id)
    except QuizSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except QuizOwnershipMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
