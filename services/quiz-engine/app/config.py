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
    reflection_feedback_table: str = "quiz_reflection_feedback"
    reflection_metrics_table: str = "ai_performance_metrics_daily"
    reflection_scheduler_enabled: bool = True
    reflection_scheduler_hour: int = 2
    reflection_scheduler_minute: int = 0
    reflection_trend_window_days: int = 7
    reflection_alert_threshold: float = 3.5

    study_engine_url: str = "http://study-engine:8090"
    instrumentation_enabled: bool = True

    model_config = SettingsConfigDict(env_prefix="QUIZ_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> "QuizEngineSettings":
    """Return cached settings instance."""

    return QuizEngineSettings()


settings = get_settings()
