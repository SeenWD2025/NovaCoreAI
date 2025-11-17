"""Provider orchestration for LLM inference."""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import AsyncGenerator, Callable, Dict, Iterable, Optional, Tuple

from app.config import settings
from app.services.providers.base import (
    BaseLLMProvider,
    ProviderError,
    ProviderResult,
    ProviderStatus,
)
from app.services.providers.gemini import GeminiProvider
from app.services.providers.local_ollama import LocalOllamaProvider
from app.services.providers.openai_provider import OpenAIProvider
from app.utils.metrics import (
    observe_provider_latency,
    record_provider_failure,
    record_provider_success,
)


class ProviderExhaustedError(ProviderError):
    """Raised when no provider could satisfy a request."""


@dataclass
class ProviderState:
    """Runtime state tracking for a provider instance."""

    provider: BaseLLMProvider
    failure_count: int = 0
    last_error: Optional[str] = None
    cooldown_until: Optional[float] = None

    def is_in_cooldown(self, current_ts: float) -> bool:
        return bool(self.cooldown_until and self.cooldown_until > current_ts)

    def reset_failures(self) -> None:
        self.failure_count = 0
        self.last_error = None
        self.cooldown_until = None

    def register_failure(
        self,
        error: str,
        cooldown_seconds: int,
        current_ts: float,
        retry_limit: int,
    ) -> None:
        self.failure_count += 1
        self.last_error = error
        if cooldown_seconds > 0 and retry_limit > 0 and self.failure_count >= retry_limit:
            self.cooldown_until = current_ts + cooldown_seconds
        else:
            self.cooldown_until = None

    def to_status(self, enabled: bool, cooling_down: bool) -> ProviderStatus:
        info = self.provider.info()
        return ProviderStatus(
            name=info.name,
            healthy=self.failure_count == 0,
            enabled=enabled,
            supports_streaming=info.supports_streaming,
            model=info.model,
            last_error=self.last_error,
            cooling_down=cooling_down,
        )


class ProviderOrchestrator:
    """Coordinate multiple LLM providers with fallback logic."""

    def __init__(
        self,
        settings_obj,
        provider_factories: Optional[Dict[str, Callable[[], BaseLLMProvider]]] = None,
    ) -> None:
        self.settings = settings_obj
        self.logger = logging.getLogger("llm-orchestrator")
        self._lock = asyncio.Lock()
        self._provider_states: Dict[str, ProviderState] = {}
        self._providers_in_priority: Tuple[str, ...] = ()

        self.provider_factories = provider_factories or {
            "ollama": lambda: LocalOllamaProvider(self.settings),
            "gemini": lambda: GeminiProvider(self.settings),
            "openai": lambda: OpenAIProvider(self.settings),
        }

        # Configure providers on instantiation
        self._configure_providers()

    # ------------------------------------------------------------------
    def _configure_providers(self) -> None:
        providers: Dict[str, ProviderState] = {}
        ordered_keys = []

        for key in self.settings.llm_provider_priority:
            factory = self.provider_factories.get(key)
            if not factory:
                self.logger.debug("Skipping unknown provider", provider=key)
                continue
            provider = factory()
            enabled = provider.is_enabled()
            configured = provider.is_configured()
            if not (enabled and configured):
                self.logger.debug(
                    "Provider disabled or misconfigured",
                    provider=key,
                    enabled=enabled,
                    configured=configured,
                )
                continue
            providers[key] = ProviderState(provider=provider)
            ordered_keys.append(key)

        self._provider_states = providers
        self._providers_in_priority = tuple(ordered_keys)
        if not self._providers_in_priority:
            self.logger.warning("No LLM providers configured; chat responses will fallback")

    # ------------------------------------------------------------------
    async def initialize(self) -> None:
        async with self._lock:
            for key in self._providers_in_priority:
                state = self._provider_states[key]
                provider = state.provider
                try:
                    await provider.initialize()
                    state.reset_failures()
                    record_provider_success(provider.name)
                    self.logger.info(
                        "Provider initialized",
                        extra={"provider": provider.name, "model": provider.model_name},
                    )
                except Exception as exc:  # pylint: disable=broad-except
                    state.register_failure(
                        str(exc),
                        self.settings.llm_provider_cooldown_sec,
                        time.time(),
                        self.settings.llm_provider_retry_limit,
                    )
                    record_provider_failure(provider.name, "init_failed")
                    self.logger.warning(
                        "Provider initialization failed",
                        extra={"provider": provider.name, "error": str(exc)},
                    )

    # ------------------------------------------------------------------
    async def ensure_ready(self) -> bool:
        for key in self._providers_in_priority:
            state = self._provider_states[key]
            provider = state.provider
            try:
                if await provider.ensure_ready():
                    state.reset_failures()
                    record_provider_success(provider.name)
                    return True
            except Exception as exc:  # pylint: disable=broad-except
                state.register_failure(
                    str(exc),
                    self.settings.llm_provider_cooldown_sec,
                    time.time(),
                    self.settings.llm_provider_retry_limit,
                )
                record_provider_failure(provider.name, "not_ready")
        return False

    # ------------------------------------------------------------------
    def _iter_available_states(self, require_streaming: bool = False) -> Iterable[ProviderState]:
        current = time.time()
        for key in self._providers_in_priority:
            state = self._provider_states.get(key)
            if not state:
                continue
            provider = state.provider
            if not (provider.is_enabled() and provider.is_configured()):
                continue
            if require_streaming and not provider.supports_streaming:
                continue
            if state.is_in_cooldown(current):
                continue
            yield state

    # ------------------------------------------------------------------
    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> ProviderResult:
        last_error: Optional[str] = None

        for state in self._iter_available_states():
            provider = state.provider
            start = time.perf_counter()
            try:
                content = await provider.generate(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                latency_ms = int((time.perf_counter() - start) * 1000)
                state.reset_failures()
                record_provider_success(provider.name)
                observe_provider_latency(
                    provider=provider.name,
                    model=provider.model_name,
                    duration_seconds=latency_ms / 1000.0,
                )
                return ProviderResult(
                    provider=provider.name,
                    model=provider.model_name,
                    content=content,
                    latency_ms=latency_ms,
                )
            except ProviderError as exc:
                last_error = str(exc)
                state.register_failure(
                    last_error,
                    self.settings.llm_provider_cooldown_sec,
                    time.time(),
                    self.settings.llm_provider_retry_limit,
                )
                record_provider_failure(provider.name, exc.__class__.__name__)
            except Exception as exc:  # pylint: disable=broad-except
                last_error = str(exc)
                state.register_failure(
                    last_error,
                    self.settings.llm_provider_cooldown_sec,
                    time.time(),
                    self.settings.llm_provider_retry_limit,
                )
                record_provider_failure(provider.name, "unexpected_error")

        raise ProviderExhaustedError(last_error or "No providers available")

    # ------------------------------------------------------------------
    async def generate_streaming_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> Tuple[str, str, AsyncGenerator[str, None]]:
        last_error: Optional[str] = None

        for state in self._iter_available_states(require_streaming=True):
            provider = state.provider
            start = time.perf_counter()
            try:
                stream = await provider.stream(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

                async def _wrapped_stream(gen: AsyncGenerator[str, None], prov=provider, st=state, started=start):
                    try:
                        async for chunk in gen:
                            yield chunk
                        latency_ms = int((time.perf_counter() - started) * 1000)
                        st.reset_failures()
                        record_provider_success(prov.name)
                        observe_provider_latency(
                            provider=prov.name,
                            model=prov.model_name,
                            duration_seconds=latency_ms / 1000.0,
                        )
                    except ProviderError as exc:
                        st.register_failure(
                            str(exc),
                            self.settings.llm_provider_cooldown_sec,
                            time.time(),
                            self.settings.llm_provider_retry_limit,
                        )
                        record_provider_failure(prov.name, exc.__class__.__name__)
                        raise
                    except Exception as exc:  # pylint: disable=broad-except
                        st.register_failure(
                            str(exc),
                            self.settings.llm_provider_cooldown_sec,
                            time.time(),
                            self.settings.llm_provider_retry_limit,
                        )
                        record_provider_failure(prov.name, "unexpected_error")
                        raise

                return (
                    provider.name,
                    provider.model_name,
                    _wrapped_stream(stream),
                )
            except ProviderError as exc:
                last_error = str(exc)
                state.register_failure(
                    last_error,
                    self.settings.llm_provider_cooldown_sec,
                    time.time(),
                    self.settings.llm_provider_retry_limit,
                )
                record_provider_failure(provider.name, exc.__class__.__name__)
            except Exception as exc:  # pylint: disable=broad-except
                last_error = str(exc)
                state.register_failure(
                    last_error,
                    self.settings.llm_provider_cooldown_sec,
                    time.time(),
                    self.settings.llm_provider_retry_limit,
                )
                record_provider_failure(provider.name, "unexpected_error")

        raise ProviderExhaustedError(last_error or "No providers available for streaming")

    # ------------------------------------------------------------------
    async def get_provider_status(self) -> Tuple[ProviderStatus, ...]:
        statuses = []
        current = time.time()
        for key in self._providers_in_priority:
            state = self._provider_states.get(key)
            if not state:
                continue
            provider = state.provider
            enabled = provider.is_enabled() and provider.is_configured()
            cooling = state.is_in_cooldown(current)
            try:
                healthy = await provider.check_health() if enabled else False
                if healthy:
                    state.reset_failures()
                    record_provider_success(provider.name)
            except Exception as exc:  # pylint: disable=broad-except
                state.register_failure(
                    str(exc),
                    self.settings.llm_provider_cooldown_sec,
                    current,
                    self.settings.llm_provider_retry_limit,
                )
                record_provider_failure(provider.name, "health_check_failed")
            statuses.append(state.to_status(enabled=enabled, cooling_down=cooling))
        return tuple(statuses)

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    def get_provider(self, name: str) -> Optional[BaseLLMProvider]:
        state = self._provider_states.get(name)
        return state.provider if state else None

    def get_primary_provider_name(self) -> Optional[str]:
        return self._providers_in_priority[0] if self._providers_in_priority else None

    def list_provider_names(self) -> Tuple[str, ...]:
        return self._providers_in_priority


# Global orchestrator instance used by the application
llm_orchestrator = ProviderOrchestrator(settings)
