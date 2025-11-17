"""Nova Notes API service entry point."""
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
import uvicorn

from app.config import settings
from app.database import healthcheck
from app.dependencies import get_notes_service
from app.logging import configure_logging
from app.middleware import CorrelationIdMiddleware
from app.routers import notes
from app.services.notes_service import NotesService

logger = configure_logging("notes-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown concerns."""

    logger.info("Starting Nova Notes API", environment=settings.environment)
    if healthcheck():
        logger.info("PostgreSQL connectivity confirmed")
    else:
        logger.warning("PostgreSQL connectivity degraded")
    yield
    logger.info("Stopping Nova Notes API")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Structured notes service for NovaCore",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CorrelationIdMiddleware)

app.include_router(notes.router)

if settings.instrumentation_enabled:
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.get("/")
async def index():
    """Service landing endpoint."""

    return {
        "service": "nova-notes-api",
        "status": "operational",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.environment,
        "documentation": "/docs",
    }


@app.get("/health")
async def health(service: NotesService = Depends(get_notes_service)):
    """Health check including database connectivity."""

    repo_health = await service.healthy()
    database_health = healthcheck()
    status_text = "healthy" if repo_health and database_health else "degraded"
    return {
        "service": "nova-notes-api",
        "status": status_text,
        "components": {
            "database": database_health,
            "repository": repo_health,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    logger.info("Booting Nova Notes API", host=settings.host, port=settings.port)
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info",
    )
