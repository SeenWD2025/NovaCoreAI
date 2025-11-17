"""Routers for quiz session management."""
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..dependencies import get_quiz_session_service, get_reflection_feedback_service
from ..models.quiz_session import (
    QuizSessionCreateRequest,
    QuizSessionResponse,
    QuizSubmissionRequest,
    QuizResultsResponse,
)
from ..models.reflection_feedback import (
    ReflectionFeedbackCreateRequest,
    ReflectionFeedbackResponse,
)
from ..services.errors import (
    QuizArtifactNotFoundError,
    QuizOwnershipMismatchError,
    QuizSessionNotFoundError,
    QuizSessionPersistenceError,
    QuizSessionAlreadyCompletedError,
    QuizSubmissionValidationError,
    ReflectionFeedbackPersistenceError,
    ReflectionFeedbackValidationError,
)
from ..services.session_management import QuizSessionService
from ..services.reflection_feedback import ReflectionFeedbackService

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


@router.post(
    "/{session_id}/submit",
    response_model=QuizResultsResponse,
    summary="Submit quiz answers for grading",
)
async def submit_session(
    session_id: str,
    payload: QuizSubmissionRequest,
    service: QuizSessionService = Depends(get_quiz_session_service),
) -> QuizResultsResponse:
    try:
        return await service.submit_session(session_id, payload)
    except QuizSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except QuizOwnershipMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except QuizSessionAlreadyCompletedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except QuizSubmissionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except QuizSessionPersistenceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get(
    "/{session_id}/results",
    response_model=QuizResultsResponse,
    summary="Retrieve graded results for a quiz session",
)
async def get_session_results(
    session_id: str,
    app_id: str = Query(..., alias="appId"),
    user_id: str = Query(..., alias="userId"),
    service: QuizSessionService = Depends(get_quiz_session_service),
) -> QuizResultsResponse:
    try:
        return await service.get_results(session_id, app_id=app_id, user_id=user_id)
    except QuizSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except QuizOwnershipMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except QuizSubmissionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/{session_id}/feedback",
    response_model=ReflectionFeedbackResponse,
    summary="Submit reflection feedback for a quiz session",
)
async def submit_feedback(
    session_id: str,
    payload: ReflectionFeedbackCreateRequest,
    service: ReflectionFeedbackService = Depends(get_reflection_feedback_service),
) -> ReflectionFeedbackResponse:
    try:
        return await service.submit_feedback(session_id, payload)
    except QuizSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except QuizOwnershipMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ReflectionFeedbackValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ReflectionFeedbackPersistenceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
