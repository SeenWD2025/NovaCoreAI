"""Structured logging configuration for the Notes API service."""
import logging
from typing import Any, Dict

import structlog


def configure_logging(service_name: str = "notes-service") -> structlog.stdlib.BoundLogger:
    """Configure structlog for the service and return a bound logger."""

    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.contextvars.merge_contextvars,
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )

    # Bridge standard logging to structlog so third-party libs align.
    logging.basicConfig(level=logging.INFO)
    return structlog.get_logger(service_name)


def serialize_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Utility to coerce complex values before logging."""

    safe_event: Dict[str, Any] = {}
    for key, value in event.items():
        if isinstance(value, set):
            safe_event[key] = list(value)
        else:
            safe_event[key] = value
    return safe_event
