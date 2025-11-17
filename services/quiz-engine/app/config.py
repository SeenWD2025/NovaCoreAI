"""Configuration settings for Nova Quiz Engine."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class QuizEngineSettings(BaseSettings):
    """Environment-driven settings for the Quiz Engine."""

    environment: str = "local"
    app_name: str = "Nova Quiz Engine"
    host: str = "0.0.0.0"
    port: int = 8091

    database_url: str = "postgresql://noble:changeme@postgres:5432/noble_novacore"
    database_pool_size: int = 5
    database_max_overflow: int = 5
    quiz_artifacts_table: str = "study_quiz_artifacts"
    quiz_sessions_table: str = "quiz_sessions"

    study_engine_url: str = "http://study-engine:8090"
    instrumentation_enabled: bool = True

    model_config = SettingsConfigDict(env_prefix="QUIZ_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> "QuizEngineSettings":
    """Return cached settings instance."""

    return QuizEngineSettings()


settings = get_settings()
