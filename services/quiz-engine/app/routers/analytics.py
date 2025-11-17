"""Routers exposing analytics for reflection feedback."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..dependencies import get_reflection_analytics_service
from ..models.reflection_analytics import (
    ReflectionMetricsQuery,
    ReflectionMetricsRecomputeRequest,
    ReflectionMetricsResponse,
)
from ..services.reflection_analytics import ReflectionAnalyticsService
from ..services.errors import ReflectionFeedbackValidationError

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/reflection/daily",
    response_model=ReflectionMetricsResponse,
    summary="List daily reflection metrics",
)
async def list_reflection_metrics(
    start_date: Optional[date] = Query(None, alias="startDate"),
    end_date: Optional[date] = Query(None, alias="endDate"),
    app_id: Optional[str] = Query(None, alias="appId"),
    quiz_id: Optional[str] = Query(None, alias="quizId"),
    service: ReflectionAnalyticsService = Depends(get_reflection_analytics_service),
) -> ReflectionMetricsResponse:
    query = ReflectionMetricsQuery(
        startDate=start_date,
        endDate=end_date,
        appId=app_id,
        quizId=quiz_id,
    )
    metrics = await service.list_metrics(query)
    return metrics


@router.post(
    "/reflection/daily/recompute",
    response_model=ReflectionMetricsResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Recompute daily reflection metrics over a date range",
)
async def recompute_reflection_metrics(
    request: ReflectionMetricsRecomputeRequest,
    service: ReflectionAnalyticsService = Depends(get_reflection_analytics_service),
) -> ReflectionMetricsResponse:
    try:
        return await service.recompute(request)
    except ReflectionFeedbackValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - domain error surface
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to recompute metrics") from exc
