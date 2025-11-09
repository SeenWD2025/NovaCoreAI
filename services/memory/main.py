"""Cognitive Memory Service - Main Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
import uvicorn
import logging

from app.config import settings
from app.database import test_connection
from app.redis_client import redis_client
from app.services.embedding_service import embedding_service
from app.routers import memory

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("🧠 Starting Cognitive Memory Service")
    
    # Test database connection
    db_ok = test_connection()
    logger.info(f"Database connection: {'✓' if db_ok else '✗'}")
    
    # Test Redis connections
    redis_health = redis_client.test_connection()
    logger.info(f"Redis STM: {'✓' if redis_health['stm'] else '✗'}")
    logger.info(f"Redis ITM: {'✓' if redis_health['itm'] else '✗'}")
    
    # Check embedding service
    embedding_health = embedding_service.health_check()
    logger.info(f"Embedding model: {'✓' if embedding_health['model_loaded'] else '✗'}")
    
    logger.info(f"Service ready on port {settings.port}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Cognitive Memory Service")


# Create FastAPI application
app = FastAPI(
    title="Cognitive Memory Service",
    description="Three-tier memory system with STM, ITM, and LTM",
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

# Include routers
app.include_router(memory.router)


@app.get("/")
async def root():
    """Service information."""
    return {
        "service": "cognitive-memory",
        "version": "1.0.0",
        "phase": 5,
        "status": "operational",
        "description": "Three-tier memory system with semantic search",
        "memory_tiers": {
            "stm": "Short-Term Memory (1 hour TTL)",
            "itm": "Intermediate-Term Memory (7 days TTL)",
            "ltm": "Long-Term Memory (permanent)"
        },
        "features": [
            "Vector embeddings for semantic search",
            "Redis-backed STM/ITM",
            "PostgreSQL + pgvector for LTM",
            "Memory tier promotion",
            "Access count tracking",
            "Context retrieval for LLM prompts"
        ],
        "endpoints": [
            "POST /memory/store - Store new memory",
            "GET /memory/retrieve/{id} - Get memory by ID",
            "GET /memory/list - List memories",
            "POST /memory/search - Semantic search",
            "PATCH /memory/update/{id} - Update memory",
            "DELETE /memory/delete/{id} - Delete memory",
            "POST /memory/promote/{id} - Promote to higher tier",
            "GET /memory/stats - Get usage statistics",
            "POST /memory/stm/store - Store STM interaction",
            "GET /memory/stm/retrieve/{session_id} - Get STM",
            "GET /memory/itm/retrieve - Get ITM references",
            "GET /memory/context - Get context for prompts"
        ]
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    # Check database
    db_ok = test_connection()
    
    # Check Redis
    redis_health = redis_client.health_check()
    
    # Check embedding service
    embedding_health = embedding_service.health_check()
    
    # Overall status
    all_ok = (
        db_ok and
        redis_health.get("stm_healthy", False) and
        redis_health.get("itm_healthy", False) and
        embedding_health.get("model_loaded", False)
    )
    
    return {
        "status": "healthy" if all_ok else "degraded",
        "service": "cognitive-memory",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "database": db_ok,
            "redis_stm": redis_health.get("stm_healthy", False),
            "redis_itm": redis_health.get("itm_healthy", False),
            "embedding_model": embedding_health.get("model_loaded", False)
        },
        "redis_stats": {
            "stm_sessions": redis_health.get("stm_sessions", 0),
            "itm_users": redis_health.get("itm_users", 0)
        },
        "embedding": {
            "model": settings.embedding_model,
            "dimension": settings.embedding_dimension
        }
    }


if __name__ == "__main__":
    logger.info(f"🧠 Starting Cognitive Memory Service on port {settings.port}")
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )
