"""Noble-Spirit Policy Service - Main Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
import uvicorn
import logging
import structlog
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import settings
from app.database import test_connection
from app.routers import policy
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
logger = structlog.get_logger("noble-spirit-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("⚖️  Starting Noble-Spirit Policy Service")
    
    # Test database connection
    db_ok = test_connection()
    logger.info("Database connection status", db_healthy=db_ok)
    
    logger.info("Policy configuration", 
                policy_version=settings.policy_version,
                principles_count=len(settings.principles))
    logger.info("Service ready", port=settings.port)
    
    yield
    
    # Shutdown
    logger.info("Shutting down Noble-Spirit Policy Service")


# Create FastAPI application
app = FastAPI(
    title="Noble-Spirit Policy Service",
    description="Constitutional AI validation and ethical filtering",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
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
app.include_router(policy.router)

# Add Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.get("/")
async def root():
    """Service information."""
    return {
        "service": "noble-spirit-policy",
        "version": "1.0.0",
        "phase": 6,
        "status": "operational",
        "description": "Constitutional AI validation and ethical filtering",
        "principles": settings.principles,
        "features": [
            "Content validation against constitutional policies",
            "Alignment scoring with ethical principles",
            "Immutable policy management with cryptographic signatures",
            "Audit logging for all validation events",
            "Pattern-based harmful content detection"
        ],
        "endpoints": [
            "POST /policy/validate - Validate content",
            "POST /policy/validate-alignment - Check alignment",
            "POST /policy/create - Create new policy",
            "GET /policy/active - Get active policies",
            "GET /policy/principles - Get constitutional principles"
        ]
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    # Check database
    db_ok = test_connection()
    
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "noble-spirit-policy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_ok,
        "policy_version": settings.policy_version,
        "principles_count": len(settings.principles)
    }


if __name__ == "__main__":
    logger.info(f"⚖️  Starting Noble-Spirit Policy Service on port {settings.port}")
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )
