# Integration Tests

## End-to-End User Journey Tests

### TODO: Implement Tests

### Test Scenarios Needed

#### 1. User Registration & Authentication Flow
```python
# test_user_journey.py
def test_complete_user_registration_flow():
    # 1. Register new user
    # 2. Verify email sent
    # 3. Confirm email
    # 4. Login
    # 5. Get JWT token
    # 6. Access protected resources
```

#### 2. Chat & Memory Flow
```python
def test_chat_creates_memory():
    # 1. Login
    # 2. Send chat message
    # 3. Verify response
    # 4. Check memory stored in STM
    # 5. Verify quota updated
```

#### 3. Memory Promotion Flow
```python
def test_memory_promotion_after_distillation():
    # 1. Create multiple STM memories
    # 2. Trigger distillation worker
    # 3. Verify STM→ITM promotion
    # 4. Access ITM memories
    # 5. Trigger second distillation
    # 6. Verify ITM→LTM promotion
```

#### 4. Quota Enforcement Flow
```python
def test_cross_service_quota_enforcement():
    # 1. Use tokens near quota limit
    # 2. Store memories near storage limit
    # 3. Verify quota warnings
    # 4. Exceed quota
    # 5. Verify request rejection
```

#### 5. Reflection Task Flow
```python
def test_reflection_task_execution():
    # 1. Trigger reflection
    # 2. Verify task queued
    # 3. Worker processes task
    # 4. Self-assessment created
    # 5. Policy validation runs
    # 6. Result stored
```

#### 6. Subscription Tier Changes
```python
def test_subscription_tier_change():
    # 1. User on free_trial
    # 2. Upgrade to pro
    # 3. Verify quota increased
    # 4. Access premium features
    # 5. Downgrade to free
    # 6. Verify quota reduced
```

### Setup Requirements

**Docker Compose Test Environment**
```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_DB: novacore_test
      
  redis-test:
    image: redis:7
    
  # All services in test mode
```

**Run Integration Tests**
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
cd tests/integration
pytest -v --tb=short

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Test Tools
- `pytest` - Test framework
- `pytest-asyncio` - Async support
- `requests` - HTTP client
- `websocket-client` - WebSocket testing
- `docker` - Container management

### Coverage Target
**Critical user paths: 100% coverage**

### Priority Order
1. ✅ HIGH: User registration → Login → Chat
2. ✅ HIGH: Memory storage and retrieval
3. ✅ HIGH: Quota enforcement
4. ⚠️ MEDIUM: Memory promotion
5. ⚠️ MEDIUM: Reflection tasks
6. ⚠️ LOW: Subscription changes
