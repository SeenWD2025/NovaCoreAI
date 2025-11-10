"""
Tests for reflection worker tasks
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from app.tasks import process_reflection
from celery.exceptions import Retry


class TestReflectionTasks:
    """Test suite for reflection worker"""
    
    @patch('app.tasks.httpx.AsyncClient')
    def test_process_reflection_success(self, mock_client):
        """Test successful reflection processing"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "reflection": "Test reflection",
            "alignment_score": 0.85
        }
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        
        result = process_reflection.apply(args=("user-123", "session-456", "Test message")).get()
        
        assert result["status"] == "success"
        assert "reflection" in result
    
    @patch('app.tasks.httpx.AsyncClient')
    def test_process_reflection_policy_check(self, mock_client):
        """Test reflection includes policy validation"""
        mock_client.return_value.__aenter__.return_value.post.return_value.status_code = 200
        mock_client.return_value.__aenter__.return_value.post.return_value.json.return_value = {
            "valid": True,
            "alignment_score": 0.9
        }
        
        result = process_reflection.apply(args=("user-123", "session-456", "Test")).get()
        
        assert result["status"] == "success"
    
    @patch('app.tasks.httpx.AsyncClient')
    def test_process_reflection_retry_on_failure(self, mock_client):
        """Test reflection retries on failure"""
        mock_client.return_value.__aenter__.return_value.post.side_effect = Exception("Network error")
        
        with pytest.raises(Retry):
            process_reflection.apply(args=("user-123", "session-456", "Test")).get()
    
    def test_process_reflection_validates_inputs(self):
        """Test reflection validates input parameters"""
        with pytest.raises(ValueError):
            process_reflection.apply(args=("", "", "")).get()
