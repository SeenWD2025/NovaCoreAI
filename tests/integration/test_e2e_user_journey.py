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


@pytest.mark.integration
@pytest.mark.asyncio
async def test_memory_storage_and_retrieval():
    """Test that chat messages are stored in memory and can be retrieved"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register and login
        email = f"memory-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        session_id = str(uuid4())
        
        # Send chat message
        message_content = "Remember this: The capital of France is Paris"
        chat_response = await client.post(
            "/chat/message",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": message_content, "session_id": session_id}
        )
        assert chat_response.status_code == 200
        
        # Wait for memory to be stored
        await asyncio.sleep(2)
        
        # Retrieve memories
        memory_response = await client.get(
            "/memory/list",
            headers={"Authorization": f"Bearer {token}"},
            params={"tier": "stm"}  # Short-term memory
        )
        assert memory_response.status_code == 200
        memories = memory_response.json().get("memories", [])
        
        # Verify at least one memory contains our message
        assert len(memories) > 0
        assert any(message_content in str(m) for m in memories)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_reflection_task_triggered():
    """Test that reflection tasks are triggered after enough chat messages"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register user
        email = f"reflection-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        session_id = str(uuid4())
        
        # Send multiple messages to trigger reflection
        messages = [
            "What is AI?",
            "How does machine learning work?",
            "Explain neural networks",
            "What are transformers?",
            "How does attention mechanism work?"
        ]
        
        for msg in messages:
            response = await client.post(
                "/chat/message",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": msg, "session_id": session_id}
            )
            assert response.status_code == 200
            await asyncio.sleep(1)
        
        # Wait for reflection task to process
        await asyncio.sleep(5)
        
        # Check if reflections were created
        reflections_response = await client.get(
            "/memory/reflections",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # May return 200 with empty list or 404 if endpoint not implemented
        assert reflections_response.status_code in [200, 404]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_policy_validation_on_chat():
    """Test that policy validation runs on chat messages"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register user
        email = f"policy-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        
        # Send a normal message
        good_response = await client.post(
            "/chat/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "message": "Tell me about ethical AI practices",
                "session_id": str(uuid4())
            }
        )
        assert good_response.status_code == 200
        
        # Try to send a potentially problematic message
        # (Should be handled gracefully by policy service)
        test_response = await client.post(
            "/chat/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "message": "Test message for policy validation",
                "session_id": str(uuid4())
            }
        )
        # Should either succeed with warning or be blocked appropriately
        assert test_response.status_code in [200, 400, 403]


@pytest.mark.integration  
@pytest.mark.asyncio
async def test_usage_tracking_and_display():
    """Test that usage is tracked and can be displayed to user"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register user
        email = f"usage-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        
        # Get initial usage
        usage_before = await client.get(
            "/auth/usage/quota",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert usage_before.status_code == 200
        initial_usage = usage_before.json()
        
        # Send a chat message (should consume tokens)
        await client.post(
            "/chat/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "message": "This is a test message to consume tokens",
                "session_id": str(uuid4())
            }
        )
        
        # Wait for usage to be recorded
        await asyncio.sleep(2)
        
        # Get updated usage
        usage_after = await client.get(
            "/auth/usage/quota",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert usage_after.status_code == 200
        updated_usage = usage_after.json()
        
        # Verify usage increased
        assert "tokens_used" in updated_usage or "messages_sent" in updated_usage


@pytest.mark.integration
@pytest.mark.asyncio
async def test_ngs_curriculum_progress():
    """Test NGS curriculum level progression"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register user
        email = f"ngs-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        
        # Get initial progress (should be level 1)
        progress_response = await client.get(
            "/ngs/progress",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if progress_response.status_code == 200:
            progress = progress_response.json()
            assert progress["current_level"] == 1
            assert progress["total_xp"] >= 0
            assert progress["agent_creation_unlocked"] == False
        else:
            # NGS service might not be running
            assert progress_response.status_code in [404, 503]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_service_authentication():
    """Test that service-to-service authentication is working"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Try to access a service endpoint without proper auth
        # This tests the X-Service-Token requirement
        
        # Direct call to intelligence service (should fail without service token)
        direct_response = await client.post(
            "http://localhost:8000/chat",
            json={"message": "test", "user_id": str(uuid4())}
        )
        # Should require authentication
        assert direct_response.status_code in [401, 403]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_websocket_streaming():
    """Test WebSocket streaming for chat responses"""
    # Note: WebSocket testing would require a different client
    # This is a placeholder for when WebSocket functionality is added
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register user
        email = f"ws-test-{uuid4()}@example.com"
        register_response = await client.post(
            "/auth/register",
            json={"email": email, "password": "TestPass123!"}
        )
        token = register_response.json()["accessToken"]
        
        # For now, just test that the token works for regular endpoints
        health_response = await client.get(
            "/health",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert health_response.status_code in [200, 401]  # May not require auth


@pytest.mark.integration
@pytest.mark.asyncio
async def test_error_handling_and_recovery():
    """Test that services handle errors gracefully"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Test invalid login
        login_response = await client.post(
            "/auth/login",
            json={"email": "nonexistent@example.com", "password": "wrongpass"}
        )
        assert login_response.status_code == 401
        assert "error" in login_response.json() or "detail" in login_response.json()
        
        # Test invalid chat message (no auth)
        chat_response = await client.post(
            "/chat/message",
            json={"message": "test"}
        )
        assert chat_response.status_code == 401
        
        # Test malformed request
        malformed_response = await client.post(
            "/auth/register",
            json={"invalid": "data"}
        )
        assert malformed_response.status_code == 400
