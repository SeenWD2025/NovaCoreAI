"""Scheduler for memory distillation."""
import schedule
import time
import logging
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.distiller import MemoryDistiller

logger = logging.getLogger(__name__)

# Create database engine
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def run_distillation_job():
    """Run the distillation job."""
    logger.info("=" * 60)
    logger.info(f"Starting scheduled distillation job at {datetime.utcnow()}")
    logger.info("=" * 60)
    
    db = SessionLocal()
    try:
        distiller = MemoryDistiller(db)
        result = distiller.run_distillation()
        
        logger.info("Distillation job completed")
        logger.info(f"Summary: {result}")
        
    except Exception as e:
        logger.error(f"Distillation job failed: {e}")
    finally:
        db.close()
    
    logger.info("=" * 60)


def start_scheduler():
    """Start the scheduler."""
    logger.info("🧪 Starting Memory Distillation Scheduler")
    logger.info(f"Scheduled to run daily at {settings.schedule_hour}:00 UTC")
    
    # Schedule job to run daily at specified hour
    schedule.every().day.at(f"{settings.schedule_hour:02d}:00").do(run_distillation_job)
    
    # Also allow manual trigger via environment variable
    if settings.database_url:
        logger.info("Running initial distillation on startup...")
        run_distillation_job()
    
    logger.info("Scheduler started. Waiting for scheduled time...")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    start_scheduler()
