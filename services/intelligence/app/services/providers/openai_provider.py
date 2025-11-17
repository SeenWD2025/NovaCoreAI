"""OpenAI provider implementation."""
from __future__ import annotations

import json
from typing import AsyncGenerator, Optional

import httpx

from app.services.providers.base import (
    BaseLLMProvider,
    ProviderConfigurationError,
    ProviderError,
    ProviderTimeoutError,
)


class OpenAIProvider(BaseLLMProvider):
    """Interact with OpenAI chat completion models."""

    name = "openai"
    supports_streaming = True
    default_timeout_seconds = 60.0

    def __init__(self, settings) -> None:
        super().__init__(settings)
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")
        self.organization = settings.openai_organization
        self.project = settings.openai_project

    # --- Configuration ---------------------------------------------
    def is_enabled(self) -> bool:
        return bool(self.api_key)

    def is_configured(self) -> bool:
        return bool(self.api_key and self.model and self.base_url)

    @property
    def model_name(self) -> str:
        return self.model

    def _build_headers(self) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.organization:
            headers["OpenAI-Organization"] = self.organization
        if self.project:
            headers["OpenAI-Project"] = self.project
        return headers

    def _build_messages(self, prompt: str, system_prompt: Optional[str]) -> list:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt.strip()})
        messages.append({"role": "user", "content": prompt})
        return messages

    # --- Inference --------------------------------------------------
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        if not self.is_configured():
            raise ProviderConfigurationError("OpenAI provider is not configured")

        payload = {
            "model": self.model,
            "messages": self._build_messages(prompt, system_prompt),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        endpoint = f"{self.base_url}/chat/completions"
        timeout = self.get_timeout_seconds()

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(endpoint, headers=self._build_headers(), json=payload)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("OpenAI request timed out") from exc
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.error("OpenAI request failed", exc_info=exc)
            raise ProviderError("OpenAI request failed") from exc

        if response.status_code != 200:
            self.logger.error(
                "OpenAI API error",
                status_code=response.status_code,
                body=response.text[:500],
            )
            raise ProviderError(f"OpenAI returned {response.status_code}")

        payload = response.json()
        choices = payload.get("choices", [])
        if not choices:
            return ""

        message = choices[0].get("message", {})
        return message.get("content", "").strip()

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        if not self.is_configured():
            raise ProviderConfigurationError("OpenAI provider is not configured")

        payload = {
            "model": self.model,
            "messages": self._build_messages(prompt, system_prompt),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        endpoint = f"{self.base_url}/chat/completions"
        timeout = self.get_timeout_seconds()

        async def _stream() -> AsyncGenerator[str, None]:
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream(
                        "POST",
                        endpoint,
                        headers=self._build_headers(),
                        json=payload,
                    ) as response:
                        if response.status_code != 200:
                            text = await response.aread()
                            self.logger.error(
                                "OpenAI streaming error",
                                status_code=response.status_code,
                                body=text.decode(errors="ignore")[:500],
                            )
                            raise ProviderError(
                                f"OpenAI streaming failed with {response.status_code}"
                            )

                        async for raw_line in response.aiter_lines():
                            if not raw_line or not raw_line.startswith("data:"):
                                continue
                            data = raw_line.split("data:", 1)[1].strip()
                            if data == "[DONE]":
                                break
                            try:
                                payload = json.loads(data)
                            except json.JSONDecodeError:
                                continue
                            for choice in payload.get("choices", []):
                                delta = choice.get("delta", {})
                                chunk = delta.get("content")
                                if chunk:
                                    yield chunk
            except httpx.TimeoutException as exc:
                raise ProviderTimeoutError("OpenAI streaming timed out") from exc
            except Exception as exc:  # pylint: disable=broad-except
                self.logger.error("OpenAI streaming failed", exc_info=exc)
                raise ProviderError("OpenAI streaming failed") from exc

        return _stream()
