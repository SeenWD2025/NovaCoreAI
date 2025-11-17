"""Alerting helpers for the Quiz Engine."""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger("quiz_engine.alerts")


def publish_trend_alert(message: str, *, context: Dict[str, Any] | None = None, level: int = logging.WARNING) -> None:
    """Publish a trend alert; currently routed through structured logging."""

    payload = {"message": message}
    if context:
        payload["context"] = context
    logger.log(level, "quiz_reflection_trend_alert", extra={"alert": payload})


__all__ = ["publish_trend_alert"]
