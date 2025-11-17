"""Pydantic models for reflection feedback analytics."""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DailyReflectionMetric(BaseModel):
    """Represents aggregated reflection metrics for a quiz on a given day."""

    aggregation_date: date = Field(..., alias="aggregationDate")
    app_id: str = Field(..., alias="appId")
    quiz_id: str = Field(..., alias="quizId")
    total_feedback: int = Field(..., alias="totalFeedback")
    quiz_rating_sum: int = Field(..., alias="quizRatingSum")
    recommendation_rating_sum: int = Field(..., alias="recommendationRatingSum")
    average_quiz_rating: float = Field(..., alias="averageQuizRating")
    average_recommendation_rating: float = Field(..., alias="averageRecommendationRating")
    quiz_rating_count: int = Field(..., alias="quizRatingCount")
    recommendation_rating_count: int = Field(..., alias="recommendationRatingCount")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class ReflectionMetricsResponse(BaseModel):
    """Envelope returned when metrics are retrieved."""

    metrics: List[DailyReflectionMetric]

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class ReflectionMetricsRecomputeRequest(BaseModel):
    """Payload for recomputing reflection metrics across a date range."""

    start_date: date = Field(..., alias="startDate")
    end_date: date = Field(..., alias="endDate")
    app_id: Optional[str] = Field(None, alias="appId")
    quiz_id: Optional[str] = Field(None, alias="quizId")

    model_config = ConfigDict(populate_by_name=True)


class ReflectionMetricsQuery(BaseModel):
    """Query parameters for retrieving metrics."""

    start_date: Optional[date] = Field(None, alias="startDate")
    end_date: Optional[date] = Field(None, alias="endDate")
    app_id: Optional[str] = Field(None, alias="appId")
    quiz_id: Optional[str] = Field(None, alias="quizId")

    model_config = ConfigDict(populate_by_name=True)
