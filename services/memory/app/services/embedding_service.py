"""Embedding service for semantic search."""
from sentence_transformers import SentenceTransformer
from typing import List, Optional
import numpy as np
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text embeddings."""
    
    def __init__(self):
        """Initialize the embedding model."""
        self.model = None
        self.model_loaded = False
        self._load_model()
    
    def _load_model(self):
        """Load the sentence transformer model."""
        try:
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            self.model = SentenceTransformer(settings.embedding_model)
            self.model_loaded = True
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self.model_loaded = False
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding vector for text.
        
        Args:
            text: Input text to embed
            
        Returns:
            384-dimensional embedding vector or None on failure
        """
        if not self.model_loaded:
            logger.warning("Embedding model not loaded, attempting to reload...")
            self._load_model()
            
            if not self.model_loaded:
                logger.error("Cannot generate embedding: model not available")
                return None
        
        try:
            # Generate embedding
            embedding = self.model.encode(text, convert_to_numpy=True)
            
            # Convert to list and ensure correct dimension
            embedding_list = embedding.tolist()
            
            if len(embedding_list) != settings.embedding_dimension:
                logger.error(
                    f"Unexpected embedding dimension: {len(embedding_list)}, "
                    f"expected {settings.embedding_dimension}"
                )
                return None
            
            return embedding_list
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return None
    
    def generate_embeddings_batch(self, texts: List[str]) -> Optional[List[List[float]]]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors or None on failure
        """
        if not self.model_loaded:
            logger.warning("Embedding model not loaded, attempting to reload...")
            self._load_model()
            
            if not self.model_loaded:
                logger.error("Cannot generate embeddings: model not available")
                return None
        
        try:
            # Generate embeddings
            embeddings = self.model.encode(texts, convert_to_numpy=True)
            
            # Convert to list
            embeddings_list = [emb.tolist() for emb in embeddings]
            
            return embeddings_list
            
        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            return None
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First embedding vector
            vec2: Second embedding vector
            
        Returns:
            Similarity score between 0 and 1
        """
        try:
            # Convert to numpy arrays
            a = np.array(vec1)
            b = np.array(vec2)
            
            # Calculate cosine similarity
            similarity = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
            
            # Normalize to 0-1 range (cosine similarity is -1 to 1)
            normalized = (similarity + 1) / 2
            
            return float(normalized)
            
        except Exception as e:
            logger.error(f"Failed to calculate similarity: {e}")
            return 0.0
    
    def health_check(self) -> dict:
        """Check embedding service health."""
        return {
            "model_loaded": self.model_loaded,
            "model_name": settings.embedding_model,
            "embedding_dimension": settings.embedding_dimension
        }


# Global instance
embedding_service = EmbeddingService()
