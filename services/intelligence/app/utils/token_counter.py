"""Token counting utilities."""
import logging

logger = logging.getLogger(__name__)


class TokenCounter:
    """Token counter using tiktoken with lazy initialization."""
    
    def __init__(self, model: str = "gpt-3.5-turbo"):
        """Initialize token counter.
        
        Note: We use GPT-3.5 encoding as a reasonable approximation for Mistral.
        Actual token counts may vary slightly.
        """
        self.model = model
        self._encoding = None
        self._use_fallback = False
    
    def _get_encoding(self):
        """Lazy load encoding on first use."""
        if self._encoding is None and not self._use_fallback:
            try:
                import tiktoken
                self._encoding = tiktoken.encoding_for_model(self.model)
                logger.info("tiktoken encoding loaded successfully")
            except ImportError:
                logger.warning("tiktoken not available, using character-based estimation")
                self._use_fallback = True
            except Exception as e:
                logger.warning(f"Failed to load tiktoken encoding: {e}. Using character-based estimation")
                self._use_fallback = True
        return self._encoding
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if self._use_fallback:
            # Rough estimate: ~4 chars per token
            return max(len(text) // 4, 1)
        
        try:
            encoding = self._get_encoding()
            if encoding:
                return len(encoding.encode(text))
            else:
                return max(len(text) // 4, 1)
        except Exception as e:
            logger.error(f"Token counting error: {e}")
            # Rough estimate: ~4 chars per token
            return max(len(text) // 4, 1)
    
    def count_conversation_tokens(self, messages: list) -> int:
        """Count tokens in a conversation.
        
        Args:
            messages: List of dicts with 'role' and 'content' keys
        """
        total = 0
        for message in messages:
            # Add tokens for role
            total += self.count_tokens(message.get("role", ""))
            # Add tokens for content
            total += self.count_tokens(message.get("content", ""))
            # Add overhead per message (formatting)
            total += 4
        # Add overhead for conversation
        total += 3
        return total


# Global instance - encoding will be loaded on first use
token_counter = TokenCounter()
