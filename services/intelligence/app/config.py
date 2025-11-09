"""Configuration management for Intelligence Core service."""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    # Server
    port: int = int(os.getenv("PORT", "8000"))
    host: str = "0.0.0.0"
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://noble:changeme@localhost:5432/noble_novacore")
    
    # LLM Configuration
    llm_model: str = os.getenv("LLM_MODEL", "mistral:7b-instruct-q4")
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    gpu_enabled: bool = os.getenv("GPU_ENABLED", "false").lower() == "true"
    
    # Token Limits
    free_tier_tokens_day: int = int(os.getenv("FREE_TIER_TOKENS_DAY", "1000"))
    basic_tier_tokens_day: int = int(os.getenv("BASIC_TIER_TOKENS_DAY", "50000"))
    pro_tier_tokens_day: int = int(os.getenv("PRO_TIER_TOKENS_DAY", "-1"))
    
    # Memory Service
    memory_service_url: str = os.getenv("MEMORY_SERVICE_URL", "http://localhost:8001")
    
    # Reflection Worker (Celery)
    celery_broker_url: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/2")
    enable_reflection: bool = os.getenv("ENABLE_REFLECTION", "true").lower() == "true"
    
    class Config:
        env_file = ".env"


settings = Settings()
