"""Configuration management for Intelligence Core service."""
import os
import json
from typing import Any, Dict, Iterable, List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings


def _normalize_priority(items: Iterable[Any]) -> List[str]:
    normalized: List[str] = []
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        normalized.append(text.lower())
    return normalized or ["ollama"]


def _coerce_priority(value: Any) -> List[str]:
    if value is None:
        return ["ollama"]

    if isinstance(value, (list, tuple, set)):
        return _normalize_priority(value)

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return ["ollama"]

        if text.startswith("[") or text.startswith("("):
            try:
                parsed = json.loads(text.replace("(", "[", 1).replace(")", "]", 1))
                if isinstance(parsed, (list, tuple)):
                    return _normalize_priority(parsed)
            except json.JSONDecodeError:
                pass

        if text.startswith("{"):
            try:
                parsed_obj = json.loads(text)
                if isinstance(parsed_obj, dict):
                    return _normalize_priority(parsed_obj.keys())
            except json.JSONDecodeError:
                pass

        parts = [part.strip() for part in text.split(",")]
        return _normalize_priority(parts)

    return ["ollama"]


def _coerce_timeouts(value: Any) -> Dict[str, float]:
    if isinstance(value, dict):
        return {str(k).strip().lower(): float(v) for k, v in value.items() if str(k).strip()}
    mapping: Dict[str, float] = {}
    if isinstance(value, str):
        entries = [item.strip() for item in value.split(",") if item.strip()]
        if value.strip().startswith("{"):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    return {
                        str(k).strip().lower(): float(v)
                        for k, v in parsed.items()
                        if str(k).strip()
                    }
            except (json.JSONDecodeError, TypeError, ValueError):
                entries = [item.strip() for item in value.split(",") if item.strip()]
        for entry in entries:
            if ":" not in entry:
                continue
            provider, timeout = entry.split(":", 1)
            provider = provider.strip().lower()
            try:
                mapping[provider] = float(timeout.strip())
            except ValueError:
                continue
    return mapping


class Settings(BaseSettings):
    """Application settings."""
    
    # Server
    port: int = int(os.getenv("PORT", "8000"))
    host: str = "0.0.0.0"
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://noble:changeme@localhost:5432/noble_novacore")
    
    # LLM Configuration
    llm_model: str = os.getenv("LLM_MODEL", "mistral:instruct")
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    gpu_enabled: bool = os.getenv("GPU_ENABLED", "false").lower() == "true"

    # LLM provider orchestration
    llm_provider_priority: List[str] | str | None = Field(default=None)
    llm_provider_timeouts: Dict[str, float] | str | None = Field(default=None)
    llm_provider_cooldown_sec: int = int(os.getenv("LLM_PROVIDER_COOLDOWN_SEC", "60"))
    llm_provider_retry_limit: int = int(os.getenv("LLM_PROVIDER_RETRY_LIMIT", "3"))

    # Gemini configuration
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    gemini_model: str = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash-preview-09-2025")
    gemini_api_url: str = os.getenv(
        "GEMINI_API_URL",
        "https://generativelanguage.googleapis.com"
    )

    # OpenAI configuration
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4.1")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_organization: Optional[str] = os.getenv("OPENAI_ORGANIZATION")
    openai_project: Optional[str] = os.getenv("OPENAI_PROJECT")
    
    # Token Limits
    free_tier_tokens_day: int = int(os.getenv("FREE_TIER_TOKENS_DAY", "1000"))
    basic_tier_tokens_day: int = int(os.getenv("BASIC_TIER_TOKENS_DAY", "50000"))
    pro_tier_tokens_day: int = int(os.getenv("PRO_TIER_TOKENS_DAY", "-1"))
    
    # Service URLs
    memory_service_url: str = os.getenv("MEMORY_SERVICE_URL", "http://localhost:8001")
    auth_service_url: str = os.getenv("AUTH_SERVICE_URL", "http://localhost:3001")
    
    # Reflection Worker (Celery)
    celery_broker_url: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/2")
    enable_reflection: bool = os.getenv("ENABLE_REFLECTION", "true").lower() == "true"
    
    class Config:
        env_file = ".env"
    def model_post_init__(self, __context: Any) -> None:
        object.__setattr__(self, "llm_provider_priority", _coerce_priority(self.llm_provider_priority))
        object.__setattr__(self, "llm_provider_timeouts", _coerce_timeouts(self.llm_provider_timeouts))


settings = Settings()
