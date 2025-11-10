"""
Unit tests for sanitization utilities
"""
import pytest
from app.utils.sanitize import sanitize_text, sanitize_message, sanitize_metadata


class TestSanitizeText:
    """Test suite for sanitize_text function"""
    
    def test_sanitize_text_with_html_tags(self):
        """Test that HTML tags are stripped"""
        input_text = "Hello <script>alert('XSS')</script> World"
        result = sanitize_text(input_text)
        
        assert "<script>" not in result
        assert "alert" not in result
        assert "Hello" in result
        assert "World" in result
    
    def test_sanitize_text_with_bold_tag(self):
        """Test that bold tags are stripped"""
        input_text = "This is <b>bold</b> text"
        result = sanitize_text(input_text)
        
        assert "<b>" not in result
        assert "</b>" not in result
        assert "bold" in result
    
    def test_sanitize_text_plain_text(self):
        """Test that plain text passes through unchanged"""
        input_text = "This is plain text"
        result = sanitize_text(input_text)
        
        assert result == input_text
    
    def test_sanitize_text_empty_string(self):
        """Test empty string handling"""
        result = sanitize_text("")
        assert result == ""
    
    def test_sanitize_text_with_link(self):
        """Test that links are handled correctly"""
        input_text = 'Click <a href="http://evil.com">here</a>'
        result = sanitize_text(input_text)
        
        assert "<a" not in result
        assert "href" not in result
        assert "Click" in result
        assert "here" in result


class TestSanitizeMessage:
    """Test suite for sanitize_message function"""
    
    def test_sanitize_message_within_limit(self):
        """Test message within length limit"""
        message = "Hello, how are you?"
        result = sanitize_message(message, max_length=1000)
        
        assert result == message
    
    def test_sanitize_message_exceeds_limit(self):
        """Test message exceeding length limit raises error"""
        message = "x" * 10001
        
        with pytest.raises(ValueError) as exc_info:
            sanitize_message(message, max_length=10000)
        
        assert "too long" in str(exc_info.value).lower()
    
    def test_sanitize_message_with_html(self):
        """Test message with HTML is sanitized"""
        message = "Hello <script>alert('xss')</script> there"
        result = sanitize_message(message, max_length=1000)
        
        assert "<script>" not in result
        assert "Hello" in result
        assert "there" in result
    
    def test_sanitize_message_with_whitespace(self):
        """Test message whitespace is trimmed"""
        message = "  Hello World  "
        result = sanitize_message(message, max_length=1000)
        
        assert result == "Hello World"
    
    def test_sanitize_message_empty(self):
        """Test empty message"""
        result = sanitize_message("", max_length=1000)
        assert result == ""


class TestSanitizeMetadata:
    """Test suite for sanitize_metadata function"""
    
    def test_sanitize_metadata_with_strings(self):
        """Test metadata with string values"""
        metadata = {
            "model": "llama2",
            "prompt": "What is <script>alert('xss')</script> AI?"
        }
        
        result = sanitize_metadata(metadata)
        
        assert result["model"] == "llama2"
        assert "<script>" not in result["prompt"]
        assert "AI" in result["prompt"]
    
    def test_sanitize_metadata_with_nested_dict(self):
        """Test metadata with nested dictionaries"""
        metadata = {
            "session": {
                "id": "123",
                "message": "Hello <b>world</b>"
            }
        }
        
        result = sanitize_metadata(metadata)
        
        assert result["session"]["id"] == "123"
        assert "<b>" not in result["session"]["message"]
        assert "world" in result["session"]["message"]
    
    def test_sanitize_metadata_with_list(self):
        """Test metadata with list values"""
        metadata = {
            "tags": ["tag1", "tag2 <script>", "tag3"]
        }
        
        result = sanitize_metadata(metadata)
        
        assert result["tags"][0] == "tag1"
        assert "<script>" not in result["tags"][1]
        assert "tag2" in result["tags"][1]
    
    def test_sanitize_metadata_with_non_string_values(self):
        """Test metadata with non-string values are preserved"""
        metadata = {
            "count": 42,
            "active": True,
            "score": 3.14
        }
        
        result = sanitize_metadata(metadata)
        
        assert result["count"] == 42
        assert result["active"] is True
        assert result["score"] == 3.14
    
    def test_sanitize_metadata_empty(self):
        """Test empty metadata"""
        result = sanitize_metadata({})
        assert result == {}
    
    def test_sanitize_metadata_none(self):
        """Test None metadata"""
        result = sanitize_metadata(None)
        assert result is None
