"""Configuration for Reflection Worker."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Worker settings."""
    
    # Redis (for Celery broker and result backend)
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    celery_broker_url: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/2")
    celery_result_backend: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/3")
    
    # Service URLs
    memory_service_url: str = os.getenv("MEMORY_SERVICE_URL", "http://localhost:8001")
    policy_service_url: str = os.getenv("POLICY_SERVICE_URL", "http://localhost:4000")
    intelligence_service_url: str = os.getenv("INTELLIGENCE_SERVICE_URL", "http://localhost:8000")
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://noble:changeme@localhost:5432/noble_novacore")
    
    # Reflection Configuration
    reflection_questions: list = [
        "What did I attempt to accomplish in this interaction?",
        "Was my response aligned with my constitutional principles?",
        "How could I improve my response for next time?"
    ]
    
    class Config:
        env_file = ".env"


settings = Settings()
