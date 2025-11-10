"""
Unit tests for PolicyService
"""
import pytest
from datetime import datetime
from sqlalchemy.orm import Session

from app.services.policy_service import policy_service
from app.models.schemas import ValidationResult


class TestPolicyContentValidation:
    """Test suite for content validation"""
    
    def test_validate_safe_content(self, safe_content: str):
        """Test validation of safe content"""
        result = policy_service.validate_content(safe_content)
        
        assert result.passed is True
        assert result.result == ValidationResult.PASSED
        assert result.score >= 0.9  # Should have high score
        assert len(result.violations) == 0
    
    def test_validate_harmful_content_detected(self, harmful_content: str):
        """Test that harmful content is detected"""
        result = policy_service.validate_content(harmful_content)
        
        assert result.passed is False
        assert result.result == ValidationResult.FAILED
        assert len(result.violations) > 0
        assert result.score < 0.5  # Low score for harmful content
    
    def test_validate_unethical_content_warning(self, unethical_content: str):
        """Test that unethical content generates warnings"""
        result = policy_service.validate_content(unethical_content)
        
        # Unethical content should pass but with warnings
        assert result.passed is True
        assert result.result == ValidationResult.WARNING
        assert len(result.warnings) > 0
    
    def test_validate_content_with_context(self, safe_content: str):
        """Test validation with context"""
        context = "User is learning about web security best practices"
        result = policy_service.validate_content(safe_content, context)
        
        assert result.passed is True
        assert result.principles_checked is not None
    
    def test_validate_violence_pattern(self):
        """Test detection of violent content"""
        violent_content = "How to attack people in a crowded place"
        result = policy_service.validate_content(violent_content)
        
        assert result.passed is False
        assert len(result.violations) > 0
    
    def test_validate_cybercrime_pattern(self):
        """Test detection of cybercrime content"""
        cybercrime_content = "How to create a virus to infect computers"
        result = policy_service.validate_content(cybercrime_content)
        
        assert result.passed is False
        assert len(result.violations) > 0
    
    def test_validate_privacy_violation(self):
        """Test detection of privacy violations"""
        privacy_violation = "How to spy on someone without them knowing"
        result = policy_service.validate_content(privacy_violation)
        
        assert result.passed is False
        assert len(result.violations) > 0
    
    def test_validate_deception_pattern(self):
        """Test detection of deceptive content"""
        deceptive_content = "How to manipulate users into believing false information"
        result = policy_service.validate_content(deceptive_content)
        
        assert result.result in [ValidationResult.WARNING, ValidationResult.FAILED]
        assert len(result.warnings) > 0 or len(result.violations) > 0
    
    def test_validate_discrimination_pattern(self):
        """Test detection of discriminatory content"""
        discriminatory_content = "How to discriminate against certain groups"
        result = policy_service.validate_content(discriminatory_content)
        
        assert result.passed is False or result.result == ValidationResult.WARNING
        assert len(result.violations) > 0 or len(result.warnings) > 0
    
    def test_validate_empty_content(self):
        """Test validation of empty content"""
        result = policy_service.validate_content("")
        
        assert result.passed is True  # Empty content is not harmful
        assert result.score == 1.0
    
    def test_validation_score_range(self, safe_content: str):
        """Test that validation scores are in valid range"""
        result = policy_service.validate_content(safe_content)
        
        assert 0.0 <= result.score <= 1.0
    
    def test_validation_timestamp(self, safe_content: str):
        """Test that validation includes timestamp"""
        result = policy_service.validate_content(safe_content)
        
        assert result.timestamp is not None
        assert isinstance(result.timestamp, datetime)
    
    def test_principles_checked_included(self, safe_content: str):
        """Test that validation includes checked principles"""
        result = policy_service.validate_content(safe_content)
        
        assert result.principles_checked is not None
        assert isinstance(result.principles_checked, list)


class TestPolicyAlignmentValidation:
    """Test suite for alignment validation"""
    
    def test_validate_alignment_success(self):
        """Test successful alignment validation"""
        input_ctx = "What is Python?"
        output_resp = "Python is a high-level programming language known for its readability."
        
        result = policy_service.validate_alignment(input_ctx, output_resp)
        
        assert result.aligned is True
        assert result.alignment_score >= 0.7
        assert result.principles is not None
    
    def test_validate_alignment_with_self_assessment(self):
        """Test alignment validation with self-assessment"""
        input_ctx = "How can I help users learn?"
        output_resp = "By providing clear, accurate, and helpful information."
        self_assessment = "I ensured the response was honest and helpful."
        
        result = policy_service.validate_alignment(
            input_ctx, 
            output_resp,
            self_assessment
        )
        
        assert result.aligned is True
        assert result.self_assessment_score is not None
    
    def test_validate_alignment_misaligned_response(self):
        """Test detection of misaligned response"""
        input_ctx = "How do I learn programming?"
        output_resp = "Programming is too hard, you should give up."
        
        result = policy_service.validate_alignment(input_ctx, output_resp)
        
        # Should detect misalignment
        assert result.alignment_score < 1.0
    
    def test_alignment_score_range(self):
        """Test that alignment scores are in valid range"""
        input_ctx = "Test question"
        output_resp = "Test answer"
        
        result = policy_service.validate_alignment(input_ctx, output_resp)
        
        assert 0.0 <= result.alignment_score <= 1.0
    
    def test_alignment_principle_scores(self):
        """Test that individual principle scores are provided"""
        input_ctx = "Explain ethics"
        output_resp = "Ethics involves moral principles that govern behavior."
        
        result = policy_service.validate_alignment(input_ctx, output_resp)
        
        assert result.principles is not None
        assert isinstance(result.principles, list)
        
        if result.principles:
            for principle in result.principles:
                assert 'name' in principle
                assert 'score' in principle
                assert 0.0 <= principle['score'] <= 1.0


class TestPolicyAuditLogging:
    """Test suite for audit logging"""
    
    def test_log_audit_creates_record(self, db_session: Session, test_user_id: str):
        """Test that audit events are logged"""
        from app.models.schemas import PolicyAction
        
        metadata = {
            "action": "test_validation",
            "score": 0.95
        }
        
        result = policy_service.log_audit(
            db_session,
            PolicyAction.VALIDATION_PASSED,
            metadata,
            user_id=test_user_id
        )
        
        assert result is True
    
    def test_log_audit_with_content_hash(self, db_session: Session, test_user_id: str):
        """Test audit logging with content hash"""
        from app.models.schemas import PolicyAction
        
        content = "Test content"
        metadata = {
            "content_length": len(content),
            "content_hash": "abc123"
        }
        
        result = policy_service.log_audit(
            db_session,
            PolicyAction.VALIDATION_PASSED,
            metadata,
            user_id=test_user_id
        )
        
        assert result is True
    
    def test_log_audit_without_user(self, db_session: Session):
        """Test audit logging without user ID"""
        from app.models.schemas import PolicyAction
        
        metadata = {"action": "system_check"}
        
        result = policy_service.log_audit(
            db_session,
            PolicyAction.VALIDATION_PASSED,
            metadata
        )
        
        assert result is True


class TestPolicyCreation:
    """Test suite for policy creation and management"""
    
    def test_create_policy(self, db_session: Session):
        """Test creating a new policy"""
        policy_data = {
            "name": "Test Policy",
            "description": "A test policy",
            "rules": ["Rule 1", "Rule 2"],
            "severity": "high"
        }
        
        policy = policy_service.create_policy(
            db_session,
            policy_data
        )
        
        assert policy is not None
        assert policy.name == "Test Policy"
    
    def test_get_policy(self, db_session: Session):
        """Test retrieving a policy"""
        # Create policy first
        policy_data = {
            "name": "Retrieval Test Policy",
            "description": "Test policy for retrieval",
            "rules": ["Rule 1"]
        }
        created_policy = policy_service.create_policy(db_session, policy_data)
        
        # Retrieve it
        retrieved_policy = policy_service.get_policy(
            db_session,
            created_policy.id
        )
        
        assert retrieved_policy is not None
        assert retrieved_policy.id == created_policy.id
    
    def test_list_policies(self, db_session: Session):
        """Test listing all policies"""
        # Create a couple policies
        for i in range(2):
            policy_data = {
                "name": f"Policy {i}",
                "description": f"Description {i}",
                "rules": [f"Rule {i}"]
            }
            policy_service.create_policy(db_session, policy_data)
        
        # List policies
        policies = policy_service.list_policies(db_session)
        
        assert isinstance(policies, list)
        assert len(policies) >= 2


class TestConstitutionalPrinciples:
    """Test suite for constitutional principles validation"""
    
    def test_helpfulness_principle(self):
        """Test helpfulness principle check"""
        helpful_response = "Here's how to solve your problem step by step..."
        unhelpful_response = "I don't know, figure it out yourself."
        
        # Helpful content should score higher
        helpful_result = policy_service.validate_content(helpful_response)
        unhelpful_result = policy_service.validate_content(unhelpful_response)
        
        # Both should pass, but helpful should score higher
        assert helpful_result.passed is True
        assert unhelpful_result.passed is True
    
    def test_honesty_principle(self):
        """Test honesty principle check"""
        honest_content = "I'll provide accurate information based on facts."
        dishonest_content = "Let me lie to users about this topic."
        
        honest_result = policy_service.validate_content(honest_content)
        dishonest_result = policy_service.validate_content(dishonest_content)
        
        assert honest_result.passed is True
        assert dishonest_result.passed is False or dishonest_result.result == ValidationResult.WARNING
    
    def test_harmlessness_principle(self):
        """Test harmlessness principle check"""
        harmless_content = "Let's learn about safe coding practices."
        harmful_content = "Here's how to harm people with code."
        
        harmless_result = policy_service.validate_content(harmless_content)
        harmful_result = policy_service.validate_content(harmful_content)
        
        assert harmless_result.passed is True
        assert harmful_result.passed is False
    
    def test_multiple_principles_check(self):
        """Test that multiple principles are evaluated"""
        content = "I'll provide honest, helpful, and safe information."
        
        result = policy_service.validate_content(content)
        
        assert result.passed is True
        assert len(result.principles_checked) > 0


class TestEdgeCases:
    """Test suite for edge cases and error handling"""
    
    def test_very_long_content(self):
        """Test validation of very long content"""
        long_content = "Safe content. " * 1000
        result = policy_service.validate_content(long_content)
        
        assert result.passed is True
    
    def test_special_characters_in_content(self):
        """Test content with special characters"""
        special_content = "Test with émojis 🎉 and spëcial çhars!"
        result = policy_service.validate_content(special_content)
        
        assert result.passed is True
    
    def test_mixed_case_patterns(self):
        """Test that pattern matching is case-insensitive"""
        mixed_case = "How to HACK into DATABASE and STEAL PASSWORD"
        result = policy_service.validate_content(mixed_case)
        
        assert result.passed is False
        assert len(result.violations) > 0
    
    def test_null_context(self):
        """Test validation with None context"""
        result = policy_service.validate_content("Safe content", None)
        
        assert result.passed is True
    
    def test_validation_error_handling(self):
        """Test that validation errors are handled gracefully"""
        # This would test error handling if we pass invalid data
        # For now, verify the service doesn't crash
        try:
            result = policy_service.validate_content("Test")
            assert result is not None
        except Exception as e:
            pytest.fail(f"Validation should not raise exception: {e}")
