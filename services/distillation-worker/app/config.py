"""Configuration for Memory Distillation Worker."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Worker settings."""
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://noble:changeme@localhost:5432/noble_novacore")
    
    # Service URLs
    memory_service_url: str = os.getenv("MEMORY_SERVICE_URL", "http://localhost:8001")
    policy_service_url: str = os.getenv("POLICY_SERVICE_URL", "http://localhost:4000")
    
    # Distillation Configuration
    promotion_access_threshold: int = int(os.getenv("LTM_PROMOTION_THRESHOLD", "3"))
    emotional_weight_threshold: float = 0.3  # |emotional_weight| > 0.3
    confidence_threshold: float = 0.7  # confidence_score > 0.7
    batch_size: int = 100
    
    # Schedule (cron format)
    schedule_hour: int = 2  # Run at 2 AM UTC
    
    class Config:
        env_file = ".env"


settings = Settings()
