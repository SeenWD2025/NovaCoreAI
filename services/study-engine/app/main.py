"""FastAPI application factory for the Nova Study Engine."""
from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI

from .config import settings
from .routers import health, quiz_generation
from .tasks.prompt_adjustment_scheduler import start_prompt_adjustment_scheduler

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Instantiate the FastAPI application."""

    app = FastAPI(title=settings.app_name, version=settings.prompt_version)
    app.state.background_tasks = []
    app.include_router(health.router)
    app.include_router(quiz_generation.router, prefix="/api/quiz", tags=["quiz"])
    _register_lifecycle_handlers(app)
    return app


def _register_lifecycle_handlers(app: FastAPI) -> None:
    @app.on_event("startup")
    async def _startup_scheduler() -> None:
        await start_prompt_adjustment_scheduler(app)

    @app.on_event("shutdown")
    async def _shutdown_background_tasks() -> None:
        tasks = getattr(app.state, "background_tasks", [])
        for task in tasks:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:  # pragma: no cover - expected path
                    pass
                except Exception as exc:  # pragma: no cover - defensive guard
                    logger.exception("Background task shutdown failure", exc_info=exc)


app = create_app()
