"""Configuration management for Cognitive Memory service."""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    # Server
    port: int = int(os.getenv("PORT", "8001"))
    host: str = "0.0.0.0"
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://noble:changeme@localhost:5432/noble_novacore")
    
    # Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_stm_db: int = int(os.getenv("REDIS_STM_DB", "0"))
    redis_itm_db: int = int(os.getenv("REDIS_ITM_DB", "1"))
    
    # Memory Configuration
    stm_ttl_seconds: int = int(os.getenv("STM_TTL_SECONDS", "3600"))  # 1 hour
    itm_ttl_seconds: int = int(os.getenv("ITM_TTL_SECONDS", "604800"))  # 7 days
    ltm_promotion_threshold: int = int(os.getenv("LTM_PROMOTION_THRESHOLD", "3"))  # access count
    
    # Memory Limits
    stm_max_size: int = int(os.getenv("STM_MAX_SIZE", "20"))  # Last N interactions
    itm_max_size: int = int(os.getenv("ITM_MAX_SIZE", "100"))  # Top N by access count
    
    # Embedding Configuration
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    embedding_dimension: int = 384
    
    # Subscription Limits
    free_tier_memory_gb: float = float(os.getenv("FREE_TIER_MEMORY_GB", "1"))
    basic_tier_memory_gb: float = float(os.getenv("BASIC_TIER_MEMORY_GB", "10"))
    pro_tier_memory_gb: float = float(os.getenv("PRO_TIER_MEMORY_GB", "-1"))  # unlimited
    
    class Config:
        env_file = ".env"


settings = Settings()
