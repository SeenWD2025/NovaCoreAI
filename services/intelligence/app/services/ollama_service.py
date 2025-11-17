"""Ollama LLM integration service."""
import asyncio
import httpx
import logging
from typing import AsyncGenerator, Optional, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    """Service for interacting with Ollama LLM."""
    
    def __init__(self):
        self.base_url = settings.ollama_url
        self.model = settings.llm_model
        self.gpu_enabled = settings.gpu_enabled
        self._model_loaded = False
        self._gpu_available = False
        self._init_lock = asyncio.Lock()
    
    async def check_health(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False
    
    async def check_model_loaded(self) -> bool:
        """Check if the model is loaded."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("models", [])
                    self._model_loaded = any(m.get("name", "").startswith(self.model.split(":")[0]) for m in models)
                    return self._model_loaded
        except Exception as e:
            logger.error(f"Model check failed: {e}")
        return False
    
    async def detect_gpu(self) -> bool:
        """Detect if GPU is available."""
        # In a real implementation, this would check for CUDA/GPU availability
        # For now, we use the configuration setting
        self._gpu_available = self.gpu_enabled
        return self._gpu_available
    
    async def pull_model(self) -> bool:
        """Pull the model if not available."""
        try:
            logger.info(f"Pulling model {self.model}...")
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": self.model, "stream": False}
                )
                if response.status_code == 200:
                    logger.info(f"Model {self.model} pulled successfully")
                    self._model_loaded = True
                    return True
        except Exception as e:
            logger.error(f"Model pull failed: {e}")
        return False
    
    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """Generate a non-streaming response."""
        try:
            prompt_text = prompt
            if system_prompt:
                # Embed system prompt directly to avoid Ollama hanging on the separate system field
                prompt_text = f"{system_prompt.strip()}\n\n{prompt}"

            payload = {
                "model": self.model,
                "prompt": prompt_text,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens
                }
            }
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("response", "")
                else:
                    logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                    return ""
        except Exception as e:
            logger.exception("Generate response failed")
            return ""
    
    async def generate_streaming_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response."""
        try:
            prompt_text = prompt
            if system_prompt:
                prompt_text = f"{system_prompt.strip()}\n\n{prompt}"

            payload = {
                "model": self.model,
                "prompt": prompt_text,
                "stream": True,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens
                }
            }
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        logger.error(f"Ollama API error: {response.status_code}")
                        yield ""
                        return
                    
                    async for chunk in response.aiter_lines():
                        if chunk:
                            try:
                                import json
                                data = json.loads(chunk)
                                if "response" in data:
                                    yield data["response"]
                                if data.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Streaming response failed: {e}")
            yield ""
    
    async def initialize(self):
        """Initialize the Ollama service."""
        logger.info("Initializing Ollama service...")
        
        # Check if Ollama is available
        if not await self.check_health():
            logger.warning("Ollama is not available")
            return
        
        # Detect GPU
        await self.detect_gpu()
        logger.info(f"GPU available: {self._gpu_available}")
        
        # Check if model is loaded
        if not await self.check_model_loaded():
            logger.info(f"Model {self.model} not found, attempting to pull...")
            await self.pull_model()
        else:
            logger.info(f"Model {self.model} is loaded")
    
    @property
    def is_ready(self) -> bool:
        """Check if service is ready."""
        return self._model_loaded

    async def ensure_ready(self) -> bool:
        """Ensure the Ollama model is loaded before serving requests."""
        if self.is_ready:
            return True

        async with self._init_lock:
            if self.is_ready:
                return True

            await self.initialize()
            return self.is_ready
    
    @property
    def gpu_available(self) -> bool:
        """Check if GPU is available."""
        return self._gpu_available


# Global instance
ollama_service = OllamaService()
