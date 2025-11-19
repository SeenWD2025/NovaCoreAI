"""Intelligence Core Service - Main Application."""
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import structlog
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.config import settings
from app.database import test_connection
from app.services.llm_router import llm_orchestrator
from app.routers import chat, quiz, educator
from app.models.schemas import HealthResponse, LLMProviderStatus
from app.middleware import CorrelationIdMiddleware

# Configure structured logging with structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.contextvars.merge_contextvars,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger("intelligence-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("🧠 Intelligence Core starting up")
    
    # Test database connection
    db_ok = test_connection()
    logger.info("Database connection status", db_healthy=db_ok)
    
    # Initialize LLM providers
    await llm_orchestrator.initialize()
    is_ready = await llm_orchestrator.ensure_ready()
    logger.info(
        "LLM providers initialized",
        providers=llm_orchestrator.list_provider_names(),
        any_ready=is_ready,
    )
    
    logger.info("🚀 Intelligence Core ready", port=settings.port)
    
    yield
    
    # Shutdown
    logger.info("🛑 Intelligence Core shutting down")


# Create FastAPI app
app = FastAPI(
    title="Intelligence Core",
    description="AI Intelligence Service with Ollama/Mistral 7B integration",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add correlation ID middleware
app.add_middleware(CorrelationIdMiddleware)

# Include routers
app.include_router(chat.router)
app.include_router(quiz.router)
app.include_router(educator.router)

# Add Prometheus metrics with custom metrics
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/metrics"],
    env_var_name="ENABLE_METRICS",
    inprogress_name="inprogress",
    inprogress_labels=True,
)

instrumentator.instrument(app)


@app.get("/metrics")
async def metrics() -> Response:
    """Expose Prometheus metrics for the intelligence service."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    db_healthy = test_connection()
    provider_statuses = await llm_orchestrator.get_provider_status()
    provider_payload = [LLMProviderStatus(**status.__dict__) for status in provider_statuses]
    ollama_status = next((status for status in provider_statuses if status.name == "ollama"), None)
    ollama_healthy = bool(ollama_status and ollama_status.enabled and ollama_status.healthy)
    model_loaded = any(status.enabled and status.healthy for status in provider_statuses)

    # Attempt to surface GPU availability when local provider is present
    ollama_provider = llm_orchestrator.get_provider("ollama")
    gpu_available = getattr(ollama_provider, "gpu_available", False) if ollama_provider else False
    
    return HealthResponse(
        status="healthy" if db_healthy and ollama_healthy else "degraded",
        service="intelligence-core",
        database=db_healthy,
        ollama=ollama_healthy,
        model_loaded=model_loaded,
        gpu_available=gpu_available,
        providers=provider_payload,
    )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Intelligence Core",
        "version": "1.0.0",
        "status": "Phase 4 - Complete",
        "endpoints": {
            "health": "/health",
            "chat": "/chat/message",
            "stream": "/chat/stream",
            "sessions": "/chat/sessions",
            "history": "/chat/history/{session_id}",
            "quiz": "/quiz/generate",
            "educator_generate": "/educator/generate",
            "educator_chat": "/educator/chat/message",
        }
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )
