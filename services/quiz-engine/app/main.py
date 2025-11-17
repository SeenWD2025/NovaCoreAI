"""FastAPI application factory for the Nova Quiz Engine."""
from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI

from .config import settings
from .routers import analytics, health, sessions
from .tasks.reflection_scheduler import start_reflection_metrics_scheduler

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Instantiate the FastAPI application."""

    app = FastAPI(title=settings.app_name, version="2025-11")
    app.state.background_tasks = []

    app.include_router(health.router)
    app.include_router(sessions.router, prefix="/api/quiz", tags=["sessions"])
    app.include_router(analytics.router, prefix="/api/quiz", tags=["analytics"])

    _register_lifecycle_handlers(app)
    return app


def _register_lifecycle_handlers(app: FastAPI) -> None:
    @app.on_event("startup")
    async def _startup_scheduler() -> None:
        await start_reflection_metrics_scheduler(app)

    @app.on_event("shutdown")
    async def _shutdown_background_tasks() -> None:
        tasks = getattr(app.state, "background_tasks", [])
        for task in tasks:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:  # pragma: no cover - expected cancel path
                    pass
                except Exception as exc:  # pragma: no cover - defensive guard
                    logger.exception("Background task shutdown failure", exc_info=exc)


app = create_app()
