"""
Unit tests for EmbeddingService
"""
import pytest
from unittest.mock import patch, Mock
import numpy as np

from app.services.embedding_service import EmbeddingService


class TestEmbeddingService:
    """Test suite for EmbeddingService"""
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_init_loads_model(self, mock_transformer):
        """Test that service initializes and loads model"""
        mock_model = Mock()
        mock_transformer.return_value = mock_model
        
        service = EmbeddingService()
        
        assert service.model_loaded is True
        assert service.model is not None
        mock_transformer.assert_called_once()
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_init_handles_model_load_failure(self, mock_transformer):
        """Test service handles model loading failure gracefully"""
        mock_transformer.side_effect = Exception("Model not found")
        
        service = EmbeddingService()
        
        assert service.model_loaded is False
    
    def test_generate_embedding_success(self, mock_embedding_service):
        """Test successful embedding generation"""
        text = "Test text for embedding"
        
        embedding = mock_embedding_service.generate_embedding(text)
        
        assert embedding is not None
        assert len(embedding) == 384
        assert all(isinstance(val, float) for val in embedding)
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_generate_embedding_model_not_loaded(self, mock_transformer):
        """Test embedding generation when model fails to load"""
        mock_transformer.side_effect = Exception("Model error")
        service = EmbeddingService()
        
        embedding = service.generate_embedding("test")
        
        assert embedding is None
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_generate_embedding_correct_dimensions(self, mock_transformer):
        """Test embedding has correct dimensions"""
        mock_model = Mock()
        mock_model.encode.return_value = np.array([0.1] * 384)
        mock_transformer.return_value = mock_model
        
        service = EmbeddingService()
        embedding = service.generate_embedding("test")
        
        assert len(embedding) == 384
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_generate_embeddings_batch_success(self, mock_transformer):
        """Test batch embedding generation"""
        mock_model = Mock()
        mock_model.encode.return_value = np.array([[0.1] * 384, [0.2] * 384])
        mock_transformer.return_value = mock_model
        
        service = EmbeddingService()
        texts = ["text 1", "text 2"]
        embeddings = service.generate_embeddings_batch(texts)
        
        assert embeddings is not None
        assert len(embeddings) == 2
        assert all(len(emb) == 384 for emb in embeddings)
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_cosine_similarity(self, mock_transformer):
        """Test cosine similarity calculation"""
        mock_model = Mock()
        mock_transformer.return_value = mock_model
        
        service = EmbeddingService()
        
        # Identical vectors should have similarity of 1.0
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        
        similarity = service.cosine_similarity(vec1, vec2)
        
        assert similarity is not None
        assert 0.99 <= similarity <= 1.01  # Allow for floating point errors
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_health_check_healthy(self, mock_transformer):
        """Test health check when model is loaded"""
        mock_model = Mock()
        mock_transformer.return_value = mock_model
        
        service = EmbeddingService()
        health = service.health_check()
        
        assert health["model_loaded"] is True
        assert "model_name" in health
    
    @patch('app.services.embedding_service.SentenceTransformer')
    def test_health_check_unhealthy(self, mock_transformer):
        """Test health check when model fails to load"""
        mock_transformer.side_effect = Exception("Model error")
        
        service = EmbeddingService()
        health = service.health_check()
        
        assert health["model_loaded"] is False
