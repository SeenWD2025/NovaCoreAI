"""Configuration management for Noble-Spirit Policy service."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Server
    port: int = int(os.getenv("PORT", "4000"))
    host: str = "0.0.0.0"
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://noble:changeme@localhost:5432/noble_novacore")
    
    # Policy Configuration
    policy_version: int = 1
    strict_mode: bool = os.getenv("STRICT_MODE", "false").lower() == "true"
    
    # Constitutional principles (core values)
    principles: list = [
        "truth",
        "wisdom",
        "alignment",
        "transparency",
        "accountability",
        "fairness",
        "respect",
        "beneficence"
    ]
    
    class Config:
        env_file = ".env"


settings = Settings()
