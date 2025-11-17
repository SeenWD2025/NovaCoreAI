"""Base classes and utilities for LLM providers."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncGenerator, Optional


@dataclass
class ProviderInfo:
    """Metadata describing a provider."""

    name: str
    model: str
    supports_streaming: bool


@dataclass
class ProviderResult:
    """Result returned by a provider invocation."""

    provider: str
    model: str
    content: str
    latency_ms: int


@dataclass
class ProviderStatus:
    """Health status for a provider."""

    name: str
    healthy: bool
    enabled: bool
    supports_streaming: bool
    model: str
    last_error: Optional[str] = None
    cooling_down: bool = False


class ProviderError(Exception):
    """Base exception for provider failures."""


class ProviderConfigurationError(ProviderError):
    """Raised when a provider is not properly configured."""


class ProviderTimeoutError(ProviderError):
    """Raised when a provider call times out."""


class ProviderNotReadyError(ProviderError):
    """Raised when a provider is temporarily unavailable."""


class BaseLLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    name: str = "base"
    supports_streaming: bool = False
    default_timeout_seconds: float = 60.0

    def __init__(self, settings) -> None:
        self.settings = settings
        self.logger = logging.getLogger(f"llm-provider.{self.name}")

    # --- Lifecycle -----------------------------------------------------
    async def initialize(self) -> None:
        """Optional async initialization hook."""

    async def shutdown(self) -> None:
        """Optional async shutdown hook."""

    # --- Configuration -------------------------------------------------
    def is_enabled(self) -> bool:
        """Return True if the provider is enabled via configuration."""
        return True

    def is_configured(self) -> bool:
        """Return True if the provider has the required configuration."""
        return True

    # --- Health --------------------------------------------------------
    async def ensure_ready(self) -> bool:
        """Ensure the provider is ready to serve traffic."""
        return True

    async def check_health(self) -> bool:
        """Perform a lightweight health check."""
        return True

    # --- Metadata ------------------------------------------------------
    @property
    def model_name(self) -> str:
        """Return the underlying model identifier."""
        return "unknown"

    def get_timeout_seconds(self) -> float:
        """Resolve timeout for the provider using settings overrides."""
        mapping = getattr(self.settings, "llm_provider_timeouts", {}) or {}
        return float(mapping.get(self.name, self.default_timeout_seconds))

    def info(self) -> ProviderInfo:
        """Return descriptive metadata for this provider."""
        return ProviderInfo(
            name=self.name,
            model=self.model_name,
            supports_streaming=self.supports_streaming,
        )

    # --- Inference -----------------------------------------------------
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """Generate a non-streaming completion."""

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        """Default streaming implementation that yields a single chunk."""

        async def _single_chunk() -> AsyncGenerator[str, None]:
            content = await self.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            yield content

        return _single_chunk()
