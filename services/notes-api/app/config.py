"""Application configuration for the Notes API service."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class NotesAPISettings(BaseSettings):
    """Pydantic settings model for environment-driven configuration."""

    environment: str = "local"
    app_name: str = "Nova Notes API"
    host: str = "0.0.0.0"
    port: int = 8085

    database_url: str = "postgresql://noble:changeme@postgres:5432/noble_novacore"
    database_pool_size: int = 5
    database_max_overflow: int = 5

    notes_table: str = "structured_notes"
    retention_table: str = "note_retention_policies"
    audit_table: str = "note_audit_log"

    default_retention_days: int = 365
    max_retention_days: int = 1825

    instrumentation_enabled: bool = True

    model_config = SettingsConfigDict(env_prefix="NOTES_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> NotesAPISettings:
    """Return a cached instance of the service settings."""

    return NotesAPISettings()


# Expose a module-level settings instance for convenience.
settings = get_settings()
