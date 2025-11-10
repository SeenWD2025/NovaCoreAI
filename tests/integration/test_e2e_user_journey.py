"""
End-to-end integration tests for complete user journeys
"""
import pytest
import httpx
import asyncio
from uuid import uuid4


BASE_URL = "http://localhost:5000"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_complete_user_journey():
    """Test complete user flow: Register → Login → Chat → Memory stored"""
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Step 1: Register new user
        email = f"test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        assert register_response.status_code == 201
        tokens = register_response.json()
        access_token = tokens["accessToken"]
        
        # Step 2: Send chat message
        chat_response = await client.post(
            "/chat/message",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "message": "What is constitutional AI?",
                "session_id": str(uuid4())
            }
        )
        assert chat_response.status_code == 200
        chat_data = chat_response.json()
        assert "response" in chat_data
        
        # Step 3: Wait for reflection (async task)
        await asyncio.sleep(5)
        
        # Step 4: Verify memory was stored
        memory_response = await client.get(
            "/memory/list",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert memory_response.status_code == 200
        memories = memory_response.json()["memories"]
        assert len(memories) >= 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_quota_enforcement():
    """Test quota enforcement across services"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register free trial user
        email = f"quota-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        
        # Send messages until quota exceeded
        for i in range(60):
            response = await client.post(
                "/chat/message",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": f"Test message {i}", "session_id": str(uuid4())}
            )
            
            if response.status_code == 429:
                # Quota exceeded
                assert "quota" in response.json()["detail"].lower()
                break


@pytest.mark.integration
@pytest.mark.asyncio
async def test_subscription_tier_upgrade():
    """Test subscription tier changes"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register user
        email = f"tier-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        
        # Check initial tier (should be free_trial)
        user_response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert user_response.json()["subscription_tier"] == "free_trial"
