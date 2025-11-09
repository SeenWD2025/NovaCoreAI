"""Intelligence Core Service - Main Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import settings
from app.database import test_connection
from app.services.ollama_service import ollama_service
from app.routers import chat
from app.models.schemas import HealthResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("🧠 Intelligence Core starting up...")
    
    # Test database connection
    if test_connection():
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")
    
    # Initialize Ollama service
    await ollama_service.initialize()
    
    if ollama_service.is_ready:
        logger.info("✅ Ollama service ready")
    else:
        logger.warning("⚠️  Ollama service not ready - will operate in degraded mode")
    
    logger.info(f"🚀 Intelligence Core ready on port {settings.port}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Intelligence Core shutting down...")


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

# Include routers
app.include_router(chat.router)

# Add Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    db_healthy = test_connection()
    ollama_healthy = await ollama_service.check_health()
    
    return HealthResponse(
        status="healthy" if db_healthy and ollama_healthy else "degraded",
        service="intelligence-core",
        database=db_healthy,
        ollama=ollama_healthy,
        model_loaded=ollama_service.is_ready,
        gpu_available=ollama_service.gpu_available
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
            "history": "/chat/history/{session_id}"
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
