"""Token counting utilities."""
import tiktoken
import logging

logger = logging.getLogger(__name__)


class TokenCounter:
    """Token counter using tiktoken."""
    
    def __init__(self, model: str = "gpt-3.5-turbo"):
        """Initialize token counter.
        
        Note: We use GPT-3.5 encoding as a reasonable approximation for Mistral.
        Actual token counts may vary slightly.
        """
        try:
            self.encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            # Fallback to cl100k_base encoding
            self.encoding = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        try:
            return len(self.encoding.encode(text))
        except Exception as e:
            logger.error(f"Token counting error: {e}")
            # Rough estimate: ~4 chars per token
            return len(text) // 4
    
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


# Global instance
token_counter = TokenCounter()
