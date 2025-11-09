"""Distillation Worker - Main Entry Point."""
import logging
from app.scheduler import start_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("🧪 Starting Memory Distillation Worker")
    logger.info("This service runs nightly memory distillation and promotion")
    start_scheduler()
