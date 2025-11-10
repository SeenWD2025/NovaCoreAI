"""
Tests for distillation worker
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from app.distiller import MemoryDistiller
from datetime import datetime, timedelta


class TestMemoryDistiller:
    """Test suite for memory distillation"""
    
    @patch('app.distiller.httpx.AsyncClient')
    def test_distill_memories_success(self, mock_client):
        """Test successful memory distillation"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "memories": [
                {"id": "mem-1", "content": "Memory 1", "tier": "ITM"},
                {"id": "mem-2", "content": "Memory 2", "tier": "ITM"}
            ]
        }
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        distiller = MemoryDistiller()
        result = distiller.run_distillation()
        
        assert result["status"] == "success"
        assert "distilled_count" in result
    
    def test_memory_promotion_logic(self):
        """Test ITM to LTM promotion logic"""
        distiller = MemoryDistiller()
        
        # Memory accessed frequently should promote
        memory = {
            "id": "mem-1",
            "tier": "ITM",
            "access_count": 10,
            "created_at": (datetime.now() - timedelta(days=7)).isoformat()
        }
        
        should_promote = distiller.should_promote_to_ltm(memory)
        assert should_promote is True
    
    def test_expired_memory_cleanup(self):
        """Test cleanup of expired memories"""
        distiller = MemoryDistiller()
        
        # Old STM should be cleaned
        old_memory = {
            "tier": "STM",
            "created_at": (datetime.now() - timedelta(days=2)).isoformat()
        }
        
        should_delete = distiller.should_delete_memory(old_memory)
        assert should_delete is True
    
    @patch('app.distiller.httpx.AsyncClient')
    def test_distillation_aggregates_by_topic(self, mock_client):
        """Test memories are aggregated by topic"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "memories": [
                {"id": "1", "topic": "AI", "content": "Content 1"},
                {"id": "2", "topic": "AI", "content": "Content 2"},
                {"id": "3", "topic": "Python", "content": "Content 3"}
            ]
        }
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        distiller = MemoryDistiller()
        grouped = distiller.group_by_topic(mock_response.json()["memories"])
        
        assert "AI" in grouped
        assert len(grouped["AI"]) == 2
