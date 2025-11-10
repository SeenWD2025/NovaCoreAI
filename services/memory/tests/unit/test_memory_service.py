"""
Unit tests for MemoryService
"""
import pytest
from uuid import uuid4
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from unittest.mock import patch, Mock

from app.services.memory_service import memory_service
from app.models.schemas import (
    StoreMemoryRequest,
    MemoryTier,
    MemoryType,
    Outcome
)


class TestMemoryServiceStore:
    """Test suite for memory storage operations"""
    
    def test_store_memory_stm_success(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test successful STM memory storage"""
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="What is Python?",
            output_response="Python is a programming language.",
            outcome=Outcome.SUCCESS,
            emotional_weight=0.5,
            confidence_score=0.9,
            tags=["programming", "python"],
            tier=MemoryTier.STM
        )
        
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        assert memory is not None
        assert memory.user_id == test_user_id
        assert memory.type == MemoryType.CONVERSATION
        assert memory.input_context == "What is Python?"
        assert memory.tier == MemoryTier.STM
        assert memory.tags == ["programming", "python"]
    
    def test_store_memory_itm_success(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test successful ITM memory storage"""
        request = StoreMemoryRequest(
            type=MemoryType.LESSON,
            input_context="Learn about recursion",
            output_response="Recursion is when a function calls itself.",
            tier=MemoryTier.ITM
        )
        
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        assert memory is not None
        assert memory.tier == MemoryTier.ITM
        assert memory.expires_at is not None  # ITM has expiry
    
    def test_store_memory_ltm_no_expiry(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test LTM memory has no expiry"""
        request = StoreMemoryRequest(
            type=MemoryType.ACHIEVEMENT,
            input_context="Completed Python course",
            tier=MemoryTier.LTM
        )
        
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        assert memory is not None
        assert memory.tier == MemoryTier.LTM
        assert memory.expires_at is None  # LTM never expires
    
    def test_store_memory_with_session_id(self, db_session: Session, test_user_id: str, test_session_id: str, mock_embedding_service):
        """Test memory storage with session ID"""
        request = StoreMemoryRequest(
            session_id=test_session_id,
            type=MemoryType.CONVERSATION,
            input_context="Hello",
            tier=MemoryTier.STM
        )
        
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        assert memory is not None
        assert memory.session_id == test_session_id
    
    def test_store_memory_emotional_weight_bounds(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test emotional weight validation"""
        request = StoreMemoryRequest(
            type=MemoryType.ERROR,
            input_context="Failed operation",
            emotional_weight=-0.8,
            tier=MemoryTier.STM
        )
        
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        assert memory is not None
        assert memory.emotional_weight == -0.8
    
    def test_store_memory_without_embedding(self, db_session: Session, test_user_id: str):
        """Test memory storage when embedding generation fails"""
        with patch('app.services.embedding_service.embedding_service') as mock_embed:
            mock_embed.generate_embedding.return_value = None
            
            request = StoreMemoryRequest(
                type=MemoryType.CONVERSATION,
                input_context="Test",
                tier=MemoryTier.STM
            )
            
            memory = memory_service.store_memory(db_session, test_user_id, request)
            
            # Should still create memory without embedding
            assert memory is not None


class TestMemoryServiceRetrieval:
    """Test suite for memory retrieval operations"""
    
    def test_get_memory_success(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test successful memory retrieval"""
        # Store a memory first
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="Test query",
            tier=MemoryTier.STM
        )
        stored_memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Retrieve it
        retrieved_memory = memory_service.get_memory(db_session, test_user_id, stored_memory.id)
        
        assert retrieved_memory is not None
        assert retrieved_memory.id == stored_memory.id
        assert retrieved_memory.input_context == "Test query"
    
    def test_get_memory_not_found(self, db_session: Session, test_user_id: str):
        """Test retrieval of non-existent memory"""
        fake_id = str(uuid4())
        memory = memory_service.get_memory(db_session, test_user_id, fake_id)
        
        assert memory is None
    
    def test_get_memory_wrong_user(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test that users can only access their own memories"""
        # Store memory for user 1
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="Private data",
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Try to access with different user
        other_user_id = str(uuid4())
        retrieved = memory_service.get_memory(db_session, other_user_id, memory.id)
        
        assert retrieved is None  # Should not access other user's memory
    
    def test_list_memories_empty(self, db_session: Session, test_user_id: str):
        """Test listing memories when none exist"""
        memories = memory_service.list_memories(db_session, test_user_id)
        
        assert memories == []
    
    def test_list_memories_with_data(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test listing memories after storing some"""
        # Store multiple memories
        for i in range(3):
            request = StoreMemoryRequest(
                type=MemoryType.CONVERSATION,
                input_context=f"Query {i}",
                tier=MemoryTier.STM
            )
            memory_service.store_memory(db_session, test_user_id, request)
        
        memories = memory_service.list_memories(db_session, test_user_id)
        
        assert len(memories) == 3
    
    def test_list_memories_filtered_by_tier(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test listing memories filtered by tier"""
        # Store memories in different tiers
        for tier in [MemoryTier.STM, MemoryTier.ITM, MemoryTier.LTM]:
            request = StoreMemoryRequest(
                type=MemoryType.CONVERSATION,
                input_context=f"Test {tier.value}",
                tier=tier
            )
            memory_service.store_memory(db_session, test_user_id, request)
        
        # Filter by STM
        stm_memories = memory_service.list_memories(db_session, test_user_id, tier=MemoryTier.STM)
        
        assert len(stm_memories) == 1
        assert stm_memories[0].tier == MemoryTier.STM
    
    def test_list_memories_pagination(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test memory listing pagination"""
        # Store 10 memories
        for i in range(10):
            request = StoreMemoryRequest(
                type=MemoryType.CONVERSATION,
                input_context=f"Query {i}",
                tier=MemoryTier.STM
            )
            memory_service.store_memory(db_session, test_user_id, request)
        
        # Get first page (5 items)
        page1 = memory_service.list_memories(db_session, test_user_id, limit=5, offset=0)
        
        # Get second page (5 items)
        page2 = memory_service.list_memories(db_session, test_user_id, limit=5, offset=5)
        
        assert len(page1) == 5
        assert len(page2) == 5
        assert page1[0].id != page2[0].id  # Different memories


class TestMemoryServiceSearch:
    """Test suite for semantic search operations"""
    
    def test_search_memories_success(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test successful semantic search"""
        # Store some memories
        contexts = [
            "Python is a programming language",
            "JavaScript is used for web development",
            "SQL is for databases"
        ]
        
        for context in contexts:
            request = StoreMemoryRequest(
                type=MemoryType.LESSON,
                input_context=context,
                tier=MemoryTier.LTM
            )
            memory_service.store_memory(db_session, test_user_id, request)
        
        # Search
        results = memory_service.search_memories(
            db_session,
            test_user_id,
            "programming languages",
            limit=2
        )
        
        assert len(results) <= 2
        # Results should have similarity scores
        if results:
            assert hasattr(results[0], 'similarity_score')
    
    def test_search_memories_empty_result(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test search with no matching memories"""
        results = memory_service.search_memories(
            db_session,
            test_user_id,
            "nonexistent topic"
        )
        
        assert results == []
    
    def test_search_memories_with_tier_filter(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test search filtered by tier"""
        # Store memory in LTM
        request = StoreMemoryRequest(
            type=MemoryType.LESSON,
            input_context="Important lesson",
            tier=MemoryTier.LTM
        )
        memory_service.store_memory(db_session, test_user_id, request)
        
        # Search only in LTM
        results = memory_service.search_memories(
            db_session,
            test_user_id,
            "lesson",
            tier=MemoryTier.LTM
        )
        
        if results:
            assert all(m.tier == MemoryTier.LTM for m in results)
    
    def test_search_memories_with_confidence_filter(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test search with minimum confidence score"""
        # Store memory with high confidence
        request = StoreMemoryRequest(
            type=MemoryType.LESSON,
            input_context="High confidence lesson",
            confidence_score=0.95,
            tier=MemoryTier.LTM
        )
        memory_service.store_memory(db_session, test_user_id, request)
        
        # Search with confidence filter
        results = memory_service.search_memories(
            db_session,
            test_user_id,
            "lesson",
            min_confidence=0.9
        )
        
        if results:
            assert all(m.confidence_score >= 0.9 for m in results if m.confidence_score)
    
    def test_search_without_embedding_returns_empty(self, db_session: Session, test_user_id: str):
        """Test search when embedding generation fails"""
        with patch('app.services.embedding_service.embedding_service') as mock_embed:
            mock_embed.generate_embedding.return_value = None
            
            results = memory_service.search_memories(
                db_session,
                test_user_id,
                "test query"
            )
            
            assert results == []


class TestMemoryServiceUpdate:
    """Test suite for memory update operations"""
    
    def test_update_memory_tags(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test updating memory tags"""
        # Store memory
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="Test",
            tags=["old-tag"],
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Update tags
        updated = memory_service.update_memory(
            db_session,
            test_user_id,
            memory.id,
            {"tags": ["new-tag", "another-tag"]}
        )
        
        assert updated is not None
        assert updated.tags == ["new-tag", "another-tag"]
    
    def test_update_memory_confidence(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test updating confidence score"""
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="Test",
            confidence_score=0.5,
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Update confidence
        updated = memory_service.update_memory(
            db_session,
            test_user_id,
            memory.id,
            {"confidence_score": 0.9}
        )
        
        assert updated is not None
        assert updated.confidence_score == 0.9
    
    def test_update_memory_no_changes(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test update with no actual changes"""
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="Test",
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Update with empty dict
        updated = memory_service.update_memory(
            db_session,
            test_user_id,
            memory.id,
            {}
        )
        
        assert updated is not None
        assert updated.id == memory.id


class TestMemoryServiceDelete:
    """Test suite for memory deletion operations"""
    
    def test_delete_memory_success(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test successful memory deletion"""
        # Store memory
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="To be deleted",
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Delete it
        result = memory_service.delete_memory(db_session, test_user_id, memory.id)
        
        assert result is True
        
        # Verify it's no longer accessible
        retrieved = memory_service.get_memory(db_session, test_user_id, memory.id)
        assert retrieved is None
    
    def test_delete_memory_not_found(self, db_session: Session, test_user_id: str):
        """Test deleting non-existent memory"""
        fake_id = str(uuid4())
        result = memory_service.delete_memory(db_session, test_user_id, fake_id)
        
        assert result is False
    
    def test_delete_memory_wrong_user(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test that users cannot delete other users' memories"""
        # Store memory for user 1
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="Protected data",
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Try to delete with different user
        other_user_id = str(uuid4())
        result = memory_service.delete_memory(db_session, other_user_id, memory.id)
        
        assert result is False


class TestMemoryServicePromotion:
    """Test suite for memory tier promotion"""
    
    def test_promote_stm_to_itm(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test promoting STM to ITM"""
        # Store STM memory
        request = StoreMemoryRequest(
            type=MemoryType.CONVERSATION,
            input_context="Important conversation",
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Promote to ITM
        promoted = memory_service.promote_memory(
            db_session,
            test_user_id,
            memory.id,
            MemoryTier.ITM
        )
        
        assert promoted is not None
        assert promoted.tier == MemoryTier.ITM
        assert promoted.expires_at is not None  # ITM has expiry
    
    def test_promote_itm_to_ltm(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test promoting ITM to LTM"""
        # Store ITM memory
        request = StoreMemoryRequest(
            type=MemoryType.LESSON,
            input_context="Valuable lesson",
            tier=MemoryTier.ITM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Promote to LTM
        promoted = memory_service.promote_memory(
            db_session,
            test_user_id,
            memory.id,
            MemoryTier.LTM
        )
        
        assert promoted is not None
        assert promoted.tier == MemoryTier.LTM
        assert promoted.expires_at is None  # LTM never expires
    
    def test_promote_stm_to_ltm_directly(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test promoting STM directly to LTM"""
        # Store STM memory
        request = StoreMemoryRequest(
            type=MemoryType.ACHIEVEMENT,
            input_context="Major achievement",
            tier=MemoryTier.STM
        )
        memory = memory_service.store_memory(db_session, test_user_id, request)
        
        # Promote directly to LTM
        promoted = memory_service.promote_memory(
            db_session,
            test_user_id,
            memory.id,
            MemoryTier.LTM
        )
        
        assert promoted is not None
        assert promoted.tier == MemoryTier.LTM


class TestMemoryServiceStats:
    """Test suite for memory statistics"""
    
    def test_get_stats_empty(self, db_session: Session, test_user_id: str):
        """Test getting stats when no memories exist"""
        stats = memory_service.get_memory_stats(db_session, test_user_id)
        
        assert stats is not None
        assert stats.get("total_memories", 0) == 0
    
    def test_get_stats_with_memories(self, db_session: Session, test_user_id: str, mock_embedding_service):
        """Test getting stats after storing memories"""
        # Store memories in different tiers
        for tier in [MemoryTier.STM, MemoryTier.ITM, MemoryTier.LTM]:
            request = StoreMemoryRequest(
                type=MemoryType.CONVERSATION,
                input_context=f"Memory in {tier.value}",
                tier=tier
            )
            memory_service.store_memory(db_session, test_user_id, request)
        
        stats = memory_service.get_memory_stats(db_session, test_user_id)
        
        assert stats is not None
        assert stats.get("total_memories", 0) >= 3
