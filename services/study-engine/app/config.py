"""Configuration settings for Nova Study Engine."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class StudyEngineSettings(BaseSettings):
    """Environment-driven settings for the Study Engine."""

    environment: str = "local"
    app_name: str = "Nova Study Engine"
    host: str = "0.0.0.0"
    port: int = 8090

    # Gateway -> Intelligence integration
    intelligence_service_url: str = Field(default="http://gateway:5000/internal/intelligence")
    intelligence_timeout_seconds: float = 60.0
    service_name: str = Field(default="study-engine")

    # Generation options
    default_question_count: int = 8
    max_question_count: int = 50
    prompt_version: str = "2025-09"
    temperature: float = 0.4

    # HTTP client configuration
    notes_client_timeout_seconds: float = 30.0

    instrumentation_enabled: bool = True

    notes_service_url: str = "http://notes-api:8085"
    quiz_engine_base_url: str = "http://quiz-engine:8091/api/quiz"
    database_url: str = "postgresql://noble:changeme@postgres:5432/noble_novacore"
    database_pool_size: int = 5
    database_max_overflow: int = 5
    quiz_artifacts_table: str = "study_quiz_artifacts"
    prompt_adjustments_enabled: bool = True
    prompt_adjustment_threshold: float = 3.4
    prompt_adjustment_trend_days: int = 7
    prompt_adjustment_scheduler_hour: int = 4
    prompt_adjustment_scheduler_minute: int = 15

    model_config = SettingsConfigDict(env_prefix="STUDY_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> StudyEngineSettings:
    """Return cached settings instance."""

    return StudyEngineSettings()


settings = get_settings()
