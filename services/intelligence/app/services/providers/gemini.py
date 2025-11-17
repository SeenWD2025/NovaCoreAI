"""Google Gemini provider implementation."""
from __future__ import annotations

import json
from typing import Optional

import httpx

from app.services.providers.base import (
    BaseLLMProvider,
    ProviderConfigurationError,
    ProviderError,
    ProviderTimeoutError,
)


class GeminiProvider(BaseLLMProvider):
    """Integrate with Google2s Gemini API."""

    name = "gemini"
    supports_streaming = False
    default_timeout_seconds = 30.0

    def __init__(self, settings) -> None:
        super().__init__(settings)
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.api_url = settings.gemini_api_url.rstrip("/")

    # --- Configuration ---------------------------------------------
    def is_enabled(self) -> bool:
        return bool(self.api_key)

    def is_configured(self) -> bool:
        return bool(self.api_key and self.model and self.api_url)

    @property
    def model_name(self) -> str:
        return self.model

    # --- Inference --------------------------------------------------
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        if not self.is_configured():
            raise ProviderConfigurationError("Gemini provider is not configured")

        endpoint = f"{self.api_url}/v1beta/models/{self.model}:generateContent"
        params = {"key": self.api_key}
        headers = {"Content-Type": "application/json"}

        contents = []
        if system_prompt:
            contents.append({
                "role": "user",
                "parts": [{"text": system_prompt.strip()}]
            })
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        body = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        timeout = self.get_timeout_seconds()

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(endpoint, params=params, json=body)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("Gemini request timed out") from exc
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.error("Gemini request failed", exc_info=exc)
            raise ProviderError("Gemini request failed") from exc

        if response.status_code != 200:
            self.logger.error(
                "Gemini API error",
                status_code=response.status_code,
                body=response.text[:500],
            )
            raise ProviderError(f"Gemini returned {response.status_code}")

        payload = response.json()
        candidates = payload.get("candidates", [])
        if not candidates:
            return ""

        first = candidates[0]
        content = first.get("content", {})
        parts = content.get("parts", [])
        texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        return "".join(texts).strip()
