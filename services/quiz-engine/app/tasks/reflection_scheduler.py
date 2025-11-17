"""Background job for refreshing reflection metrics and publishing alerts."""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, Optional

from ..config import settings
from ..dependencies import get_reflection_analytics_service
from ..models.reflection_analytics import ReflectionMetricsQuery, ReflectionMetricsRecomputeRequest
from ..services.reflection_analytics import ReflectionAnalyticsService
from ..utils.alerts import publish_trend_alert

logger = logging.getLogger(__name__)


async def start_reflection_metrics_scheduler(app) -> None:
    """Schedule the nightly reflection metrics refresh if enabled."""

    if not settings.reflection_scheduler_enabled:
        logger.info("Reflection metrics scheduler disabled by configuration")
        return

    service = get_reflection_analytics_service()
    task = asyncio.create_task(_scheduler_loop(service))
    tasks = getattr(app.state, "background_tasks", [])
    tasks.append(task)
    app.state.background_tasks = tasks


async def _scheduler_loop(service: ReflectionAnalyticsService) -> None:
    while True:
        wait_seconds = _seconds_until_next_run(
            settings.reflection_scheduler_hour,
            settings.reflection_scheduler_minute,
        )
        logger.debug("Reflection metrics scheduler sleeping", extra={"seconds": wait_seconds})
        await asyncio.sleep(wait_seconds)
        try:
            await _run_once(service)
        except Exception as exc:  # pragma: no cover - defensive catch to prevent loop exit
            logger.exception("Reflection metrics scheduler run failed", exc_info=exc)


async def _run_once(service: ReflectionAnalyticsService) -> None:
    window_days = max(settings.reflection_trend_window_days, 1)
    threshold = settings.reflection_alert_threshold

    today = datetime.now(timezone.utc).date()
    end_date = today - timedelta(days=1)
    start_date = end_date - timedelta(days=window_days - 1)

    logger.info(
        "Executing reflection metrics recompute",
        extra={"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
    )

    request = ReflectionMetricsRecomputeRequest(startDate=start_date, endDate=end_date)
    await service.recompute(request)

    metrics_response = await service.list_metrics(
        ReflectionMetricsQuery(startDate=start_date, endDate=end_date)
    )
    summary = _summarize_metrics(metrics_response.metrics)

    if summary is None:
        logger.info("No reflection feedback metrics available for trend analysis")
        return

    logger.info(
        "Reflection metrics refreshed",
        extra={
            "windowDays": window_days,
            "averageRecommendation": summary["weightedRecommendationAverage"],
            "averageQuiz": summary["weightedQuizAverage"],
            "lowestRecommendationDay": summary["lowestRecommendation"],
        },
    )

    weighted_avg = summary["weightedRecommendationAverage"]
    if weighted_avg is None:
        return

    if weighted_avg < threshold:
        lowest = summary.get("lowestRecommendation")
        context = {
            "windowDays": window_days,
            "weightedRecommendationAverage": weighted_avg,
        }
        if lowest:
            context.update(
                {
                    "lowestDay": lowest.get("aggregationDate"),
                    "lowestQuizId": lowest.get("quizId"),
                    "lowestAverage": lowest.get("average"),
                }
            )
        publish_trend_alert(
            message=(
                "Learner recommendation ratings dipped below threshold; consider prompt or content adjustments"
            ),
            context=context,
        )


def _seconds_until_next_run(hour: int, minute: int) -> float:
    now = datetime.now(timezone.utc)
    target = datetime.combine(now.date(), time(hour=hour, minute=minute, tzinfo=timezone.utc))
    if target <= now:
        target += timedelta(days=1)
    delta = target - now
    return max(delta.total_seconds(), 60.0)


def _summarize_metrics(metrics: Iterable) -> Optional[dict]:
    metrics_list = list(metrics)
    if not metrics_list:
        return None

    total_rec_sum = 0.0
    total_rec_count = 0
    total_quiz_sum = 0.0
    total_quiz_count = 0

    lowest_metric = None
    lowest_value = None

    for metric in metrics_list:
        rec_sum = getattr(metric, "recommendation_rating_sum", 0) or 0
        rec_count = getattr(metric, "recommendation_rating_count", 0) or 0
        quiz_sum = getattr(metric, "quiz_rating_sum", 0) or 0
        quiz_count = getattr(metric, "quiz_rating_count", 0) or 0

        total_rec_sum += rec_sum
        total_rec_count += rec_count
        total_quiz_sum += quiz_sum
        total_quiz_count += quiz_count

        avg = getattr(metric, "average_recommendation_rating", None)
        if avg is None and rec_count:
            avg = rec_sum / rec_count
        if avg is not None:
            if lowest_value is None or avg < lowest_value:
                lowest_value = avg
                lowest_metric = {
                    "aggregationDate": getattr(metric, "aggregation_date", None),
                    "quizId": getattr(metric, "quiz_id", None),
                    "average": float(avg),
                }

    weighted_recommendation = (
        float(total_rec_sum) / total_rec_count if total_rec_count else None
    )
    weighted_quiz = (
        float(total_quiz_sum) / total_quiz_count if total_quiz_count else None
    )

    return {
        "weightedRecommendationAverage": weighted_recommendation,
        "weightedQuizAverage": weighted_quiz,
        "lowestRecommendation": lowest_metric,
    }


__all__ = ["start_reflection_metrics_scheduler", "_summarize_metrics", "_seconds_until_next_run"]
