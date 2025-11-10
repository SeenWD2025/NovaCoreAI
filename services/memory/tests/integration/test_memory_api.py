"""
Integration tests for Memory API endpoints
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4


class TestMemoryStoreEndpoint:
    """Integration tests for /memory/store endpoint"""
    
    def test_store_memory_success(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test successful memory storage via API"""
        response = client.post(
            "/memory/store",
            json={
                "type": "conversation",
                "input_context": "What is machine learning?",
                "output_response": "ML is a subset of AI.",
                "tier": "stm",
                "tags": ["ml", "ai"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["input_context"] == "What is machine learning?"
        assert data["tier"] == "stm"
        assert "ml" in data["tags"]
    
    def test_store_memory_requires_auth(self, client: TestClient, mock_embedding_service):
        """Test that store endpoint requires authentication"""
        response = client.post(
            "/memory/store",
            json={
                "type": "conversation",
                "input_context": "Test",
                "tier": "stm"
            }
        )
        
        assert response.status_code == 401
    
    def test_store_memory_invalid_tier(self, client: TestClient, auth_headers: dict):
        """Test store with invalid tier"""
        response = client.post(
            "/memory/store",
            json={
                "type": "conversation",
                "input_context": "Test",
                "tier": "invalid_tier"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_store_memory_missing_required_fields(self, client: TestClient, auth_headers: dict):
        """Test store without required fields"""
        response = client.post(
            "/memory/store",
            json={
                "tier": "stm"
                # Missing type and input_context
            },
            headers=auth_headers
        )
        
        assert response.status_code == 422


class TestMemoryRetrieveEndpoint:
    """Integration tests for /memory/retrieve endpoint"""
    
    def test_retrieve_memory_success(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test successful memory retrieval"""
        # Store a memory first
        store_response = client.post(
            "/memory/store",
            json={
                "type": "conversation",
                "input_context": "Test retrieval",
                "tier": "stm"
            },
            headers=auth_headers
        )
        memory_id = store_response.json()["id"]
        
        # Retrieve it
        retrieve_response = client.get(
            f"/memory/retrieve/{memory_id}",
            headers=auth_headers
        )
        
        assert retrieve_response.status_code == 200
        data = retrieve_response.json()
        assert data["id"] == memory_id
        assert data["input_context"] == "Test retrieval"
    
    def test_retrieve_memory_not_found(self, client: TestClient, auth_headers: dict):
        """Test retrieving non-existent memory"""
        fake_id = str(uuid4())
        
        response = client.get(
            f"/memory/retrieve/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    def test_retrieve_memory_requires_auth(self, client: TestClient):
        """Test that retrieve requires authentication"""
        fake_id = str(uuid4())
        
        response = client.get(f"/memory/retrieve/{fake_id}")
        
        assert response.status_code == 401


class TestMemoryListEndpoint:
    """Integration tests for /memory/list endpoint"""
    
    def test_list_memories_empty(self, client: TestClient, auth_headers: dict):
        """Test listing memories when none exist"""
        response = client.get(
            "/memory/list",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "memories" in data
        assert isinstance(data["memories"], list)
    
    def test_list_memories_with_data(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test listing memories after storing some"""
        # Store multiple memories
        for i in range(3):
            client.post(
                "/memory/store",
                json={
                    "type": "conversation",
                    "input_context": f"Test memory {i}",
                    "tier": "stm"
                },
                headers=auth_headers
            )
        
        # List memories
        response = client.get(
            "/memory/list",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["memories"]) >= 3
    
    def test_list_memories_with_tier_filter(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test listing with tier filter"""
        # Store memories in different tiers
        client.post(
            "/memory/store",
            json={"type": "conversation", "input_context": "STM test", "tier": "stm"},
            headers=auth_headers
        )
        client.post(
            "/memory/store",
            json={"type": "lesson", "input_context": "LTM test", "tier": "ltm"},
            headers=auth_headers
        )
        
        # Filter by LTM
        response = client.get(
            "/memory/list?tier=ltm",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if data["memories"]:
            assert all(m["tier"] == "ltm" for m in data["memories"])
    
    def test_list_memories_pagination(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test memory listing pagination"""
        # Store 10 memories
        for i in range(10):
            client.post(
                "/memory/store",
                json={"type": "conversation", "input_context": f"Test {i}", "tier": "stm"},
                headers=auth_headers
            )
        
        # Get first page
        response1 = client.get(
            "/memory/list?limit=5&offset=0",
            headers=auth_headers
        )
        
        # Get second page
        response2 = client.get(
            "/memory/list?limit=5&offset=5",
            headers=auth_headers
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        page1 = response1.json()["memories"]
        page2 = response2.json()["memories"]
        
        assert len(page1) <= 5
        assert len(page2) <= 5


class TestMemorySearchEndpoint:
    """Integration tests for /memory/search endpoint"""
    
    def test_search_memories_success(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test successful semantic search"""
        # Store some memories
        topics = ["Python programming", "JavaScript web dev", "Database SQL"]
        for topic in topics:
            client.post(
                "/memory/store",
                json={"type": "lesson", "input_context": topic, "tier": "ltm"},
                headers=auth_headers
            )
        
        # Search
        response = client.post(
            "/memory/search",
            json={"query": "programming languages", "limit": 5},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert isinstance(data["results"], list)
    
    def test_search_memories_requires_auth(self, client: TestClient):
        """Test search requires authentication"""
        response = client.post(
            "/memory/search",
            json={"query": "test"}
        )
        
        assert response.status_code == 401
    
    def test_search_memories_with_filters(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test search with tier and confidence filters"""
        # Store memory with high confidence in LTM
        client.post(
            "/memory/store",
            json={
                "type": "lesson",
                "input_context": "Important lesson",
                "confidence_score": 0.95,
                "tier": "ltm"
            },
            headers=auth_headers
        )
        
        # Search with filters
        response = client.post(
            "/memory/search",
            json={
                "query": "lesson",
                "tier": "ltm",
                "min_confidence": 0.9,
                "limit": 5
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200


class TestMemoryUpdateEndpoint:
    """Integration tests for /memory/update endpoint"""
    
    def test_update_memory_success(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test successful memory update"""
        # Store memory
        store_response = client.post(
            "/memory/store",
            json={
                "type": "conversation",
                "input_context": "Original content",
                "tags": ["old"],
                "tier": "stm"
            },
            headers=auth_headers
        )
        memory_id = store_response.json()["id"]
        
        # Update tags
        update_response = client.patch(
            f"/memory/update/{memory_id}",
            json={"tags": ["new", "updated"]},
            headers=auth_headers
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["tags"] == ["new", "updated"]
    
    def test_update_memory_not_found(self, client: TestClient, auth_headers: dict):
        """Test updating non-existent memory"""
        fake_id = str(uuid4())
        
        response = client.patch(
            f"/memory/update/{fake_id}",
            json={"tags": ["test"]},
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestMemoryDeleteEndpoint:
    """Integration tests for /memory/delete endpoint"""
    
    def test_delete_memory_success(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test successful memory deletion"""
        # Store memory
        store_response = client.post(
            "/memory/store",
            json={"type": "conversation", "input_context": "To delete", "tier": "stm"},
            headers=auth_headers
        )
        memory_id = store_response.json()["id"]
        
        # Delete it
        delete_response = client.delete(
            f"/memory/delete/{memory_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200
        
        # Verify it's gone
        retrieve_response = client.get(
            f"/memory/retrieve/{memory_id}",
            headers=auth_headers
        )
        assert retrieve_response.status_code == 404
    
    def test_delete_memory_not_found(self, client: TestClient, auth_headers: dict):
        """Test deleting non-existent memory"""
        fake_id = str(uuid4())
        
        response = client.delete(
            f"/memory/delete/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestMemoryPromoteEndpoint:
    """Integration tests for /memory/promote endpoint"""
    
    def test_promote_memory_stm_to_ltm(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test promoting STM memory to LTM"""
        # Store STM memory
        store_response = client.post(
            "/memory/store",
            json={"type": "achievement", "input_context": "Major milestone", "tier": "stm"},
            headers=auth_headers
        )
        memory_id = store_response.json()["id"]
        
        # Promote to LTM
        promote_response = client.post(
            f"/memory/promote/{memory_id}",
            json={"target_tier": "ltm"},
            headers=auth_headers
        )
        
        assert promote_response.status_code == 200
        data = promote_response.json()
        assert data["tier"] == "ltm"
        assert data["expires_at"] is None  # LTM never expires


class TestMemoryStatsEndpoint:
    """Integration tests for /memory/stats endpoint"""
    
    def test_get_stats_empty(self, client: TestClient, auth_headers: dict):
        """Test stats when no memories exist"""
        response = client.get(
            "/memory/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_memories" in data
    
    def test_get_stats_with_memories(self, client: TestClient, auth_headers: dict, mock_embedding_service):
        """Test stats after storing memories"""
        # Store memories in different tiers
        for tier in ["stm", "itm", "ltm"]:
            client.post(
                "/memory/store",
                json={"type": "conversation", "input_context": f"Test {tier}", "tier": tier},
                headers=auth_headers
            )
        
        response = client.get(
            "/memory/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_memories"] >= 3
        assert "tier_breakdown" in data


class TestMemoryQuotaEnforcement:
    """Integration tests for storage quota enforcement"""
    
    def test_quota_warning_near_limit(self, client: TestClient, auth_headers: dict, db_session: Session, mock_embedding_service):
        """Test that quota warnings are issued near limit"""
        # This test would require mocking the usage service
        # to simulate near-quota conditions
        pass
    
    def test_quota_exceeded_rejection(self, client: TestClient, auth_headers: dict, db_session: Session, mock_embedding_service):
        """Test that storage is rejected when quota exceeded"""
        # This test would require mocking the usage service
        # to simulate quota exceeded
        pass


class TestMemoryExpiration:
    """Integration tests for memory expiration"""
    
    def test_expired_memories_not_retrieved(self, client: TestClient, auth_headers: dict, db_session: Session, mock_embedding_service):
        """Test that expired memories are not returned"""
        # This would require time manipulation to test expiration
        # For now, document the expected behavior
        pass
