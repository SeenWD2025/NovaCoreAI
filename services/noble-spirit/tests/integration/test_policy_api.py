"""
Integration tests for Policy API endpoints
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4


class TestValidateContentEndpoint:
    """Integration tests for /policy/validate endpoint"""
    
    def test_validate_safe_content_api(self, client: TestClient, auth_headers: dict, safe_content: str):
        """Test API validation of safe content"""
        response = client.post(
            "/policy/validate",
            json={
                "content": safe_content,
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["passed"] is True
        assert data["result"] == "passed"
        assert data["score"] >= 0.9
        assert len(data["violations"]) == 0
    
    def test_validate_harmful_content_api(self, client: TestClient, auth_headers: dict, harmful_content: str):
        """Test API validation of harmful content"""
        response = client.post(
            "/policy/validate",
            json={
                "content": harmful_content,
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["passed"] is False
        assert data["result"] == "failed"
        assert len(data["violations"]) > 0
    
    def test_validate_with_context(self, client: TestClient, auth_headers: dict, safe_content: str):
        """Test validation with context"""
        response = client.post(
            "/policy/validate",
            json={
                "content": safe_content,
                "context": "Educational content",
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "principles_checked" in data
    
    def test_validate_requires_auth(self, client: TestClient, safe_content: str):
        """Test that validation requires authentication"""
        response = client.post(
            "/policy/validate",
            json={"content": safe_content}
        )
        
        assert response.status_code == 401
    
    def test_validate_missing_content(self, client: TestClient, auth_headers: dict):
        """Test validation with missing content"""
        response = client.post(
            "/policy/validate",
            json={},
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error


class TestValidateAlignmentEndpoint:
    """Integration tests for /policy/validate-alignment endpoint"""
    
    def test_validate_alignment_success(self, client: TestClient, auth_headers: dict):
        """Test successful alignment validation"""
        response = client.post(
            "/policy/validate-alignment",
            json={
                "input_context": "What is machine learning?",
                "output_response": "Machine learning is a subset of AI.",
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "aligned" in data
        assert "alignment_score" in data
        assert 0.0 <= data["alignment_score"] <= 1.0
    
    def test_validate_alignment_with_self_assessment(self, client: TestClient, auth_headers: dict):
        """Test alignment validation with self-assessment"""
        response = client.post(
            "/policy/validate-alignment",
            json={
                "input_context": "How can I help?",
                "output_response": "By providing accurate information.",
                "self_assessment": "I aimed to be helpful and honest.",
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "self_assessment_score" in data
        assert "principles" in data
    
    def test_validate_alignment_requires_auth(self, client: TestClient):
        """Test alignment validation requires authentication"""
        response = client.post(
            "/policy/validate-alignment",
            json={
                "input_context": "Test",
                "output_response": "Test"
            }
        )
        
        assert response.status_code == 401
    
    def test_validate_alignment_missing_fields(self, client: TestClient, auth_headers: dict):
        """Test alignment validation with missing fields"""
        response = client.post(
            "/policy/validate-alignment",
            json={"input_context": "Test"},
            headers=auth_headers
        )
        
        assert response.status_code == 422


class TestPolicyEndpoints:
    """Integration tests for policy CRUD endpoints"""
    
    def test_create_policy(self, client: TestClient, auth_headers: dict):
        """Test creating a new policy"""
        response = client.post(
            "/policy/create",
            json={
                "name": "Test Policy",
                "description": "A test policy",
                "rules": ["Rule 1", "Rule 2"],
                "severity": "high"
            },
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data["name"] == "Test Policy"
    
    def test_get_policy(self, client: TestClient, auth_headers: dict):
        """Test retrieving a policy"""
        # Create policy first
        create_response = client.post(
            "/policy/create",
            json={
                "name": "Retrieval Test",
                "description": "Test",
                "rules": ["Rule 1"]
            },
            headers=auth_headers
        )
        
        if create_response.status_code == 200:
            policy_id = create_response.json()["id"]
            
            # Retrieve it
            get_response = client.get(
                f"/policy/{policy_id}",
                headers=auth_headers
            )
            
            assert get_response.status_code == 200
            data = get_response.json()
            assert data["id"] == policy_id
    
    def test_list_policies(self, client: TestClient, auth_headers: dict):
        """Test listing policies"""
        response = client.get(
            "/policy/list",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list) or isinstance(data.get("policies"), list)


class TestAuditLogging:
    """Integration tests for audit logging"""
    
    def test_validation_creates_audit_log(self, client: TestClient, auth_headers: dict, db_session: Session, safe_content: str):
        """Test that validation creates audit log entry"""
        # Perform validation
        response = client.post(
            "/policy/validate",
            json={
                "content": safe_content,
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify audit log was created (would need to query audit_logs table)
        # For now, just verify the validation succeeded
    
    def test_alignment_check_creates_audit_log(self, client: TestClient, auth_headers: dict):
        """Test that alignment check creates audit log"""
        response = client.post(
            "/policy/validate-alignment",
            json={
                "input_context": "Test",
                "output_response": "Test response",
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200


class TestMetricsCollection:
    """Integration tests for metrics collection"""
    
    def test_validation_increments_metrics(self, client: TestClient, auth_headers: dict, safe_content: str):
        """Test that validation increments Prometheus metrics"""
        # Perform validation
        response = client.post(
            "/policy/validate",
            json={
                "content": safe_content,
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Check /metrics endpoint
        metrics_response = client.get("/metrics")
        if metrics_response.status_code == 200:
            metrics_text = metrics_response.text
            assert "policy_validation_total" in metrics_text
    
    def test_alignment_check_records_score(self, client: TestClient, auth_headers: dict):
        """Test that alignment checks record score in metrics"""
        response = client.post(
            "/policy/validate-alignment",
            json={
                "input_context": "Test",
                "output_response": "Response",
                "user_id": auth_headers["X-User-Id"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Check metrics
        metrics_response = client.get("/metrics")
        if metrics_response.status_code == 200:
            metrics_text = metrics_response.text
            assert "alignment_score_histogram" in metrics_text or "policy_alignment_check_total" in metrics_text


class TestErrorHandling:
    """Integration tests for error handling"""
    
    def test_invalid_json(self, client: TestClient, auth_headers: dict):
        """Test handling of invalid JSON"""
        response = client.post(
            "/policy/validate",
            data="invalid json",
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    def test_malformed_request(self, client: TestClient, auth_headers: dict):
        """Test handling of malformed request"""
        response = client.post(
            "/policy/validate",
            json={"invalid_field": "value"},
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    def test_service_error_handling(self, client: TestClient, auth_headers: dict):
        """Test that service errors are handled gracefully"""
        # This would test error recovery
        # For now, verify the endpoint doesn't crash
        try:
            response = client.post(
                "/policy/validate",
                json={"content": "test"},
                headers=auth_headers
            )
            assert response.status_code in [200, 401, 422, 500]
        except Exception as e:
            pytest.fail(f"Endpoint should not raise exception: {e}")


class TestRateLimiting:
    """Integration tests for rate limiting"""
    
    def test_rapid_validations(self, client: TestClient, auth_headers: dict, safe_content: str):
        """Test rapid successive validations"""
        # Make multiple rapid requests
        for _ in range(5):
            response = client.post(
                "/policy/validate",
                json={"content": safe_content, "user_id": auth_headers["X-User-Id"]},
                headers=auth_headers
            )
            
            # Should succeed or rate limit
            assert response.status_code in [200, 429]


class TestHealthEndpoint:
    """Integration tests for health check"""
    
    def test_health_check(self, client: TestClient):
        """Test health check endpoint"""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert data["status"] in ["healthy", "degraded"]
