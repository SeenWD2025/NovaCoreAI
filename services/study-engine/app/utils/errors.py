"""Custom error types for the Study Engine."""
from typing import Any, Dict, Optional


class ProviderError(Exception):
    """Raised when a provider fails to generate quiz content."""

    def __init__(self, provider: str, message: str, details: Optional[Dict[str, Any]] = None):
        self.provider = provider
        self.details = details or {}
        super().__init__(f"{provider}: {message}")


class QuizGenerationError(Exception):
    """Raised when all providers fail to generate a quiz."""

    def __init__(self, errors: list[ProviderError]):
        self.errors = errors
        message = "; ".join(str(error) for error in errors) or "No providers available"
        super().__init__(message)


class NotesServiceError(Exception):
    """Raised when retrieving data from the Notes API fails."""

    def __init__(self, status_code: int, detail: str | None = None):
        self.status_code = status_code
        message = detail or f"Notes API error ({status_code})"
        super().__init__(message)
