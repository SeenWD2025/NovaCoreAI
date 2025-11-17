"""Background job that refreshes prompt adjustments from quiz analytics."""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from ..config import settings
from ..services.prompt_adjustments import (
    build_guidance_message,
    get_prompt_adjustment_state,
)

logger = logging.getLogger(__name__)


async def start_prompt_adjustment_scheduler(app) -> None:
    """Register the prompt adjustment scheduler if enabled."""

    if not settings.prompt_adjustments_enabled:
        logger.info("Prompt adjustment scheduler disabled by configuration")
        return

    task = asyncio.create_task(_scheduler_loop())
    tasks = getattr(app.state, "background_tasks", [])
    tasks.append(task)
    app.state.background_tasks = tasks


async def _scheduler_loop() -> None:
    while True:
        wait_seconds = _seconds_until_next_run(
            settings.prompt_adjustment_scheduler_hour,
            settings.prompt_adjustment_scheduler_minute,
        )
        logger.debug("Prompt adjustment scheduler sleeping", extra={"seconds": wait_seconds})
        await asyncio.sleep(wait_seconds)
        try:
            await _run_once()
        except Exception as exc:  # pragma: no cover - defensive catch
            logger.exception("Prompt adjustment scheduler run failed", exc_info=exc)


async def _run_once() -> None:
    window_days = max(settings.prompt_adjustment_trend_days, 1)
    threshold = settings.prompt_adjustment_threshold

    today = datetime.now(timezone.utc).date()
    end_date = today
    start_date = end_date - timedelta(days=window_days - 1)

    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
    }

    url = f"{settings.quiz_engine_base_url.rstrip('/')}/analytics/reflection/daily"

    logger.info(
        "Fetching reflection metrics for prompt adjustments",
        extra={"url": url, "params": params},
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
    except httpx.HTTPError as exc:  # pragma: no cover - network failure path
        logger.warning("Unable to fetch reflection metrics", exc_info=exc)
        return

    payload = response.json()
    metrics = payload.get("metrics") or []
    guidance_payload = _derive_guidance(metrics, window_days, threshold)
    state = get_prompt_adjustment_state()

    if guidance_payload is None:
        state.clear()
        logger.info("Prompt adjustments cleared; metrics within healthy thresholds")
        return

    message, metadata = guidance_payload
    state.apply(guidance=message, reason="low_recommendation_trend", metadata=metadata)
    logger.info("Prompt adjustments updated from reflection metrics", extra=metadata)


def _derive_guidance(
    metrics: List[Dict[str, Any]],
    window_days: int,
    threshold: float,
) -> Optional[tuple[str, Dict[str, Any]]]:
    if not metrics:
        return None

    lowest_metric: Optional[Dict[str, Any]] = None
    lowest_value: Optional[float] = None
    total_sum = 0.0
    total_count = 0.0

    for metric in metrics:
        avg = metric.get("averageRecommendationRating")
        if avg is None:
            rec_sum = metric.get("recommendationRatingSum")
            rec_count = metric.get("recommendationRatingCount")
            if rec_sum is not None and rec_count:
                avg = rec_sum / rec_count
        if avg is None:
            continue
        rec_sum = metric.get("recommendationRatingSum")
        rec_count = metric.get("recommendationRatingCount")
        if rec_sum is not None and rec_count:
            total_sum += float(rec_sum)
            total_count += float(rec_count)
        else:
            total_sum += float(avg)
            total_count += 1.0
        if lowest_value is None or avg < lowest_value:
            lowest_value = float(avg)
            lowest_metric = metric

    if total_count <= 0:
        return None

    weighted_average = total_sum / total_count

    if weighted_average >= threshold:
        return None

    quiz_id = lowest_metric.get("quizId") if lowest_metric else None
    average_value = float(
        lowest_metric.get("averageRecommendationRating", weighted_average)
        if lowest_metric
        else weighted_average
    )

    guidance = build_guidance_message(
        quiz_id=quiz_id,
        average=float(average_value),
        window_days=window_days,
    )
    metadata = {
        "quizId": quiz_id,
        "windowDays": window_days,
        "weightedAverage": weighted_average,
        "threshold": threshold,
        "lowestAverage": average_value,
    }
    return guidance, metadata


def _seconds_until_next_run(hour: int, minute: int) -> float:
    now = datetime.now(timezone.utc)
    target = datetime.combine(now.date(), time(hour=hour, minute=minute, tzinfo=timezone.utc))
    if target <= now:
        target += timedelta(days=1)
    return max((target - now).total_seconds(), 60.0)


__all__ = [
    "start_prompt_adjustment_scheduler",
    "_derive_guidance",
    "_seconds_until_next_run",
]
