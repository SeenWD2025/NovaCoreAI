"""Reflection Worker - Celery worker entry point."""
import logging
from app.celery_app import celery_app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("🤔 Starting Reflection Worker")
    celery_app.worker_main([
        "worker",
        "--loglevel=info",
        "--concurrency=2",
        "--pool=solo"  # Use solo pool for simplicity
    ])
