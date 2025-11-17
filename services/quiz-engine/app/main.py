"""FastAPI application factory for the Nova Quiz Engine."""
from fastapi import FastAPI

from .config import settings
from .routers import health, sessions


def create_app() -> FastAPI:
    """Instantiate the FastAPI application."""

    app = FastAPI(title=settings.app_name, version="2025-11")
    app.include_router(health.router)
    app.include_router(sessions.router, prefix="/api/quiz", tags=["sessions"])
    return app


app = create_app()
