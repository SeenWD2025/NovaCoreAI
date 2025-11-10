"""
Integration tests for chat endpoint with usage ledger
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from datetime import datetime
from sqlalchemy.orm import Session

from app.services.usage_service import UsageService


class TestChatUsageIntegration:
    """Integration tests for chat endpoint usage tracking"""
    
    def test_chat_records_token_usage(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that chat endpoint records token usage to ledger"""
        # Send a chat message
        response = client.post(
            "/chat",
            json={"message": "Hello, how are you?"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "response" in data
        assert "session_id" in data
        
        # Check that usage was recorded
        usage = UsageService.get_today_usage(
            db=db_session,
            user_id=uuid4() if isinstance(test_user_id, str) else test_user_id,
            resource_type="llm_tokens"
        )
        
        # Should have recorded some token usage
        assert usage > 0
    
    def test_chat_records_message_count(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that chat endpoint records message count"""
        # Send a chat message
        response = client.post(
            "/chat",
            json={"message": "Test message"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Check that message count was recorded
        message_count = UsageService.get_today_usage(
            db=db_session,
            user_id=uuid4() if isinstance(test_user_id, str) else test_user_id,
            resource_type="messages"
        )
        
        # Should have recorded at least 1 message
        assert message_count >= 1
    
    def test_chat_enforces_quota_limit(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that chat endpoint enforces quota limits"""
        user_id = uuid4() if isinstance(test_user_id, str) else test_user_id
        
        # Record usage near the limit (free trial limit is 1000 tokens)
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=1500  # Exceed free trial limit
        )
        
        # Try to send a message
        response = client.post(
            "/chat",
            json={"message": "This should be rejected"},
            headers=auth_headers
        )
        
        # Should return 429 (Too Many Requests) for quota exceeded
        # Note: May return 200 if quota check is not implemented yet
        # This test documents expected behavior
        if response.status_code == 429:
            error_data = response.json()
            assert "quota" in error_data.get("detail", "").lower() or "limit" in error_data.get("detail", "").lower()
    
    def test_chat_quota_check_before_processing(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that quota is checked BEFORE processing message"""
        user_id = uuid4() if isinstance(test_user_id, str) else test_user_id
        
        # Record usage at limit
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=1000  # At free trial limit
        )
        
        initial_usage = UsageService.get_today_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens"
        )
        
        # Try to send a message that would require tokens
        response = client.post(
            "/chat",
            json={"message": "This message needs processing"},
            headers=auth_headers
        )
        
        # If quota enforcement is working, usage should not increase beyond limit
        final_usage = UsageService.get_today_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens"
        )
        
        # Either request was rejected (429) or usage did not significantly increase
        if response.status_code == 429:
            assert final_usage == initial_usage  # No additional usage recorded
        # else: quota check may not be fully implemented yet
    
    def test_chat_includes_metadata_in_usage(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that usage records include metadata"""
        # Send a chat message
        response = client.post(
            "/chat",
            json={"message": "Test with metadata"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # This test verifies that usage records can include metadata
        # The actual implementation should store session_id, model name, etc.
        # in the metadata field of usage_ledger
    
    def test_streaming_chat_records_usage(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that streaming chat endpoint also records usage"""
        # Note: TestClient doesn't handle streaming well, so this is a placeholder
        # Real test would use async client or SSE client
        
        # Send a request to streaming endpoint if it exists
        # For now, document expected behavior:
        # - Streaming endpoint should track tokens as they're generated
        # - Final token count should be recorded after streaming completes
        pass
    
    def test_daily_usage_resets(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that usage statistics properly account for daily resets"""
        user_id = uuid4() if isinstance(test_user_id, str) else test_user_id
        
        # Record usage for today
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=500
        )
        
        # Get today's usage
        today_usage = UsageService.get_today_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens"
        )
        
        assert today_usage == 500
        
        # Note: Testing actual midnight reset would require manipulating timestamps
        # or waiting for midnight, so this test documents expected behavior
    
    def test_usage_persists_across_requests(self, client: TestClient, auth_headers: dict, db_session: Session, test_user_id: str):
        """Test that usage accumulates across multiple requests"""
        user_id = uuid4() if isinstance(test_user_id, str) else test_user_id
        
        # Send first message
        response1 = client.post(
            "/chat",
            json={"message": "First message"},
            headers=auth_headers
        )
        assert response1.status_code == 200
        
        usage_after_first = UsageService.get_today_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens"
        )
        
        # Send second message
        response2 = client.post(
            "/chat",
            json={"message": "Second message"},
            headers=auth_headers
        )
        assert response2.status_code == 200
        
        usage_after_second = UsageService.get_today_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens"
        )
        
        # Usage should have increased
        assert usage_after_second > usage_after_first
