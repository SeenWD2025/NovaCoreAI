"""FastAPI application factory for the Nova Study Engine."""
from fastapi import FastAPI

from .config import settings
from .routers import health, quiz_generation


def create_app() -> FastAPI:
    """Instantiate the FastAPI application."""

    app = FastAPI(title=settings.app_name, version=settings.prompt_version)
    app.include_router(health.router)
    app.include_router(quiz_generation.router, prefix="/api/quiz", tags=["quiz"])
    return app


app = create_app()
