"""
Unit tests for UsageService
"""
import pytest
from uuid import uuid4
from datetime import datetime
from sqlalchemy.orm import Session

from app.services.usage_service import UsageService


class TestUsageService:
    """Test suite for UsageService"""
    
    def test_record_usage_success(self, db_session: Session):
        """Test successful usage recording"""
        user_id = uuid4()
        
        result = UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=100,
            metadata={"model": "llama2", "session_id": str(uuid4())}
        )
        
        assert result is True
    
    def test_get_today_usage_no_usage(self, db_session: Session):
        """Test getting usage when no usage exists"""
        user_id = uuid4()
        
        usage = UsageService.get_today_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens"
        )
        
        assert usage == 0
    
    def test_get_today_usage_with_usage(self, db_session: Session):
        """Test getting today's usage after recording"""
        user_id = uuid4()
        
        # Record some usage
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=100
        )
        
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=50
        )
        
        usage = UsageService.get_today_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens"
        )
        
        assert usage == 150
    
    def test_check_quota_free_trial_under_limit(self, db_session: Session):
        """Test quota check for free trial user under limit"""
        user_id = uuid4()
        
        # Record some usage (under limit of 1000)
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=500
        )
        
        has_quota, message = UsageService.check_quota(
            db=db_session,
            user_id=user_id,
            tier="free_trial",
            resource_type="llm_tokens",
            requested_amount=400
        )
        
        assert has_quota is True
        assert "available" in message.lower()
    
    def test_check_quota_free_trial_over_limit(self, db_session: Session):
        """Test quota check for free trial user over limit"""
        user_id = uuid4()
        
        # Record usage near limit
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=900
        )
        
        has_quota, message = UsageService.check_quota(
            db=db_session,
            user_id=user_id,
            tier="free_trial",
            resource_type="llm_tokens",
            requested_amount=200  # Would exceed 1000
        )
        
        assert has_quota is False
        assert "exceeded" in message.lower()
    
    def test_check_quota_pro_unlimited(self, db_session: Session):
        """Test quota check for pro tier (unlimited)"""
        user_id = uuid4()
        
        # Record large usage
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=100000
        )
        
        has_quota, message = UsageService.check_quota(
            db=db_session,
            user_id=user_id,
            tier="pro",
            resource_type="llm_tokens",
            requested_amount=50000
        )
        
        assert has_quota is True
        assert "unlimited" in message.lower()
    
    def test_get_usage_stats_empty(self, db_session: Session):
        """Test getting usage stats with no data"""
        user_id = uuid4()
        
        stats = UsageService.get_usage_stats(
            db=db_session,
            user_id=user_id,
            days=30
        )
        
        assert stats == {}
    
    def test_get_usage_stats_with_data(self, db_session: Session):
        """Test getting usage stats with data"""
        user_id = uuid4()
        
        # Record some usage
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="llm_tokens",
            amount=100
        )
        
        UsageService.record_usage(
            db=db_session,
            user_id=user_id,
            resource_type="messages",
            amount=5
        )
        
        stats = UsageService.get_usage_stats(
            db=db_session,
            user_id=user_id,
            days=30
        )
        
        # Should have data for both resource types
        assert "llm_tokens" in stats or "messages" in stats
