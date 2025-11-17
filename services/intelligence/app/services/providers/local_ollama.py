"""Local Ollama provider implementation."""
from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator, Optional

import httpx

from app.services.providers.base import (
    BaseLLMProvider,
    ProviderError,
    ProviderNotReadyError,
    ProviderTimeoutError,
)


class LocalOllamaProvider(BaseLLMProvider):
    """Interact with a locally hosted Ollama instance."""

    name = "ollama"
    supports_streaming = True
    default_timeout_seconds = 120.0

    def __init__(self, settings) -> None:
        super().__init__(settings)
        self.base_url = settings.ollama_url.rstrip("/")
        self._model = settings.llm_model
        self._gpu_enabled = settings.gpu_enabled
        self._model_loaded = False
        self._gpu_available = False
        self._init_lock = asyncio.Lock()

    # --- Metadata --------------------------------------------------
    @property
    def model_name(self) -> str:
        return self._model

    # --- Configuration ---------------------------------------------
    def is_configured(self) -> bool:
        return bool(self.base_url)

    # --- Health ----------------------------------------------------
    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=self.get_timeout_seconds()) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.error("Ollama health check failed", exc_info=exc)
            return False

    async def check_model_loaded(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=self.get_timeout_seconds()) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("models", [])
                    prefix = self._model.split(":")[0]
                    self._model_loaded = any(
                        model.get("name", "").startswith(prefix) for model in models
                    )
                    return self._model_loaded
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.error("Model check failed", exc_info=exc)
        return False

    async def detect_gpu(self) -> bool:
        self._gpu_available = self._gpu_enabled
        return self._gpu_available

    async def pull_model(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": self._model, "stream": False},
                )
                if response.status_code == 200:
                    self._model_loaded = True
                    return True
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.error("Model pull failed", exc_info=exc)
        return False

    async def initialize(self) -> None:
        if not self.is_configured():
            self.logger.warning("Ollama provider not configured; skipping init")
            return

        self.logger.info("Initializing Ollama provider", model=self._model)
        if not await self.check_health():
            self.logger.warning("Ollama instance not available during init")
            return

        await self.detect_gpu()
        if not await self.check_model_loaded():
            self.logger.info("Model not loaded; pulling", model=self._model)
            await self.pull_model()
        else:
            self.logger.info("Model already loaded", model=self._model)

    async def ensure_ready(self) -> bool:
        if self._model_loaded:
            return True

        async with self._init_lock:
            if self._model_loaded:
                return True
            await self.initialize()
            return self._model_loaded

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        if not await self.ensure_ready():
            raise ProviderNotReadyError("Ollama model is not ready")

        prompt_text = prompt
        if system_prompt:
            prompt_text = f"{system_prompt.strip()}\n\n{prompt}" if system_prompt.strip() else prompt

        payload = {
            "model": self._model,
            "prompt": prompt_text,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }

        timeout = self.get_timeout_seconds()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(f"{self.base_url}/api/generate", json=payload)
        except httpx.ReadTimeout as exc:
            raise ProviderTimeoutError("Ollama generate timed out") from exc
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.error("Ollama generate failed", exc_info=exc)
            raise ProviderError("Ollama generate failed") from exc

        if response.status_code != 200:
            self.logger.error(
                "Ollama API error",
                status_code=response.status_code,
                body=response.text[:500],
            )
            raise ProviderError(f"Ollama returned {response.status_code}")

        data = response.json()
        return data.get("response", "")

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        if not await self.ensure_ready():
            raise ProviderNotReadyError("Ollama model is not ready")

        prompt_text = prompt
        if system_prompt:
            prompt_text = f"{system_prompt.strip()}\n\n{prompt}" if system_prompt.strip() else prompt

        payload = {
            "model": self._model,
            "prompt": prompt_text,
            "stream": True,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }

        timeout = self.get_timeout_seconds()

        async def _stream() -> AsyncGenerator[str, None]:
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/api/generate",
                        json=payload,
                    ) as response:
                        if response.status_code != 200:
                            text = await response.aread()
                            self.logger.error(
                                "Ollama streaming error",
                                status_code=response.status_code,
                                body=text.decode(errors="ignore")[:500],
                            )
                            raise ProviderError(
                                f"Streaming failed with {response.status_code}"
                            )

                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            try:
                                data = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            chunk = data.get("response")
                            if chunk:
                                yield chunk
                            if data.get("done"):
                                break
            except httpx.ReadTimeout as exc:
                raise ProviderTimeoutError("Ollama streaming timed out") from exc
            except Exception as exc:  # pylint: disable=broad-except
                self.logger.error("Ollama streaming failed", exc_info=exc)
                raise ProviderError("Ollama streaming failed") from exc

        return _stream()

    # --- Introspection -------------------------------------------------
    @property
    def is_ready(self) -> bool:
        return self._model_loaded

    @property
    def gpu_available(self) -> bool:
        return self._gpu_available
