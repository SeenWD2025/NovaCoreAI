# Input Validation and Sanitization Specification

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist  
**Status:** Active Security Specification

---

## Executive Summary

This document specifies input validation and sanitization requirements for NovaCoreAI. Proper input validation prevents injection attacks (XSS, SQL, command injection), data corruption, and denial of service.

**Security Principle:** Never trust user input. Validate, sanitize, and encode all data from external sources.

---

## 1. Input Validation Rules

### 1.1 Message Length Validation

**Maximum Length:** 10,000 characters

**Rationale:**
- Prevents memory exhaustion
- Limits token consumption
- Reduces database storage abuse
- Maintains reasonable conversation context

**Minimum Length:** 1 character (non-whitespace)

**Implementation (Python/FastAPI):**

```python
from fastapi import HTTPException
from pydantic import BaseModel, validator, Field

class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    
    @validator('message')
    def validate_message(cls, v):
        # Remove leading/trailing whitespace
        v = v.strip()
        
        # Check minimum length after stripping
        if len(v) < 1:
            raise ValueError('Message cannot be empty or whitespace only')
        
        # Check maximum length
        if len(v) > 10000:
            raise ValueError('Message exceeds maximum length of 10,000 characters')
        
        return v

# Usage in endpoint
@app.post("/chat")
async def chat(message: ChatMessage):
    # message.message is already validated
    pass
```

**Implementation (TypeScript/NestJS):**

```typescript
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(10000, { message: 'Message cannot exceed 10,000 characters' })
  @Transform(({ value }) => value?.trim())
  message: string;
}

// Usage in controller
@Post('chat')
async chat(@Body() chatDto: ChatMessageDto) {
  // chatDto.message is already validated and trimmed
}
```

**Error Response:**

```json
{
  "statusCode": 400,
  "message": "Message exceeds maximum length of 10,000 characters",
  "error": "Bad Request"
}
```

---

### 1.2 Request Size Limits

**Maximum Request Body Size:** 10 MB

**Rationale:**
- Prevents memory exhaustion
- Mitigates DoS attacks
- Reasonable for JSON payloads with embedded data

**Implementation (Express/Gateway):**

```typescript
import express from 'express';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
```

**Implementation (FastAPI/Python):**

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError

app = FastAPI()

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    # Get content length
    content_length = request.headers.get('content-length')
    
    if content_length:
        content_length = int(content_length)
        max_size = 10 * 1024 * 1024  # 10 MB
        
        if content_length > max_size:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "Request body too large",
                    "max_size": "10MB",
                    "received": f"{content_length / 1024 / 1024:.2f}MB"
                }
            )
    
    response = await call_next(request)
    return response
```

---

### 1.3 Email Validation

**Requirements:**
- Valid email format (RFC 5322)
- Maximum length: 254 characters
- Normalize to lowercase
- Check for disposable email domains (optional)

**Implementation:**

```typescript
import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(254, { message: 'Email exceeds maximum length' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}
```

**Python Implementation:**

```python
import re
from pydantic import BaseModel, EmailStr, validator

class RegisterRequest(BaseModel):
    email: EmailStr
    
    @validator('email')
    def validate_email(cls, v):
        v = v.lower().strip()
        
        # Check maximum length
        if len(v) > 254:
            raise ValueError('Email exceeds maximum length')
        
        # Optional: Check disposable email domains
        disposable_domains = ['tempmail.com', '10minutemail.com']
        domain = v.split('@')[1]
        if domain in disposable_domains:
            raise ValueError('Disposable email addresses not allowed')
        
        return v
```

---

### 1.4 Password Validation

**Requirements:**
- Minimum length: 8 characters
- Maximum length: 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character
- Not in common password list

**Implementation:**

```typescript
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Password must contain uppercase, lowercase, digit, and special character' }
  )
  password: string;
}
```

**Python Implementation:**

```python
import re
from pydantic import BaseModel, validator

class RegisterRequest(BaseModel):
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if len(v) > 128:
            raise ValueError('Password must not exceed 128 characters')
        
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain digit')
        if not re.search(r'[@$!%*?&]', v):
            raise ValueError('Password must contain special character')
        
        # Check common passwords
        with open('common_passwords.txt') as f:
            common_passwords = {line.strip().lower() for line in f}
        
        if v.lower() in common_passwords:
            raise ValueError('Password is too common')
        
        return v
```

---

### 1.5 Name Validation

**Requirements:**
- Minimum length: 1 character
- Maximum length: 100 characters
- Allow letters, spaces, hyphens, apostrophes
- No numbers or special characters (except - and ')

**Implementation:**

```typescript
export class ProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-']+$/, { 
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes' 
  })
  @Transform(({ value }) => value?.trim())
  name: string;
}
```

---

### 1.6 URL Validation

**Requirements:**
- Valid URL format
- HTTPS only (for external URLs)
- Domain allowlist (if applicable)

**Implementation:**

```typescript
import { IsUrl } from 'class-validator';

export class ConfigDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  webhookUrl: string;
}
```

**Python Implementation:**

```python
from pydantic import BaseModel, HttpUrl, validator

class ConfigRequest(BaseModel):
    webhook_url: HttpUrl
    
    @validator('webhook_url')
    def validate_https(cls, v):
        if not v.scheme == 'https':
            raise ValueError('URL must use HTTPS protocol')
        return v
```

---

## 2. Input Sanitization

### 2.1 XSS Prevention

**Purpose:** Remove or encode HTML/JavaScript to prevent XSS attacks

**Strategy:** Strip HTML tags from user-generated content

**Implementation (Python):**

```python
import bleach

def sanitize_html(text: str) -> str:
    """
    Remove all HTML tags and dangerous content
    """
    # Strip all HTML tags
    clean_text = bleach.clean(
        text,
        tags=[],  # No tags allowed
        attributes={},  # No attributes allowed
        strip=True  # Strip tags rather than escape
    )
    
    return clean_text

# Usage
user_message = sanitize_html(user_input)
```

**Implementation (TypeScript):**

```typescript
import * as sanitizeHtml from 'sanitize-html';

function sanitizeUserInput(text: string): string {
  // Remove all HTML tags
  return sanitizeHtml(text, {
    allowedTags: [],  // No tags allowed
    allowedAttributes: {},  // No attributes allowed
    disallowedTagsMode: 'discard'
  });
}

// Usage
const cleanMessage = sanitizeUserInput(userInput);
```

**Allow Specific Tags (Optional):**

If need to allow some formatting (e.g., in blog posts):

```python
def sanitize_rich_text(text: str) -> str:
    """
    Allow safe HTML tags for rich text
    """
    clean_text = bleach.clean(
        text,
        tags=['p', 'br', 'strong', 'em', 'u', 'a'],
        attributes={'a': ['href', 'title']},
        protocols=['http', 'https', 'mailto']
    )
    
    return clean_text
```

---

### 2.2 SQL Injection Prevention

**Strategy:** Always use parameterized queries, never string concatenation

**DO (Parameterized Query):**

```python
# Safe - using parameters
user = db.users.find_one({"email": user_email})

# Safe - SQLAlchemy ORM
user = session.query(User).filter(User.email == user_email).first()

# Safe - Raw SQL with parameters
cursor.execute("SELECT * FROM users WHERE email = %s", (user_email,))
```

**DON'T (String Concatenation):**

```python
# DANGEROUS - SQL Injection vulnerability
query = f"SELECT * FROM users WHERE email = '{user_email}'"
cursor.execute(query)

# DANGEROUS
query = "SELECT * FROM users WHERE email = '" + user_email + "'"
```

**TypeORM (TypeScript):**

```typescript
// Safe - Using query builder
const user = await userRepository.findOne({
  where: { email: userEmail }
});

// Safe - Parameterized query
const user = await userRepository
  .createQueryBuilder('user')
  .where('user.email = :email', { email: userEmail })
  .getOne();
```

---

### 2.3 NoSQL Injection Prevention

**MongoDB Injection Example:**

```javascript
// DANGEROUS - NoSQL injection
db.users.find({ email: req.body.email })

// If attacker sends: { "email": { "$ne": null } }
// Query becomes: db.users.find({ email: { "$ne": null } })
// Returns all users!
```

**Prevention:**

```typescript
import { validate } from 'class-validator';

class LoginDto {
  @IsString()
  @IsEmail()
  email: string;
  
  @IsString()
  password: string;
}

// Validate input
const loginDto = plainToClass(LoginDto, req.body);
const errors = await validate(loginDto);

if (errors.length > 0) {
  throw new BadRequestException('Invalid input');
}

// Now safe to use
const user = await db.users.findOne({ email: loginDto.email });
```

**Python/MongoDB:**

```python
from pydantic import BaseModel

class LoginRequest(BaseModel):
    email: str
    password: str

# Pydantic ensures types are correct
@app.post("/login")
async def login(data: LoginRequest):
    # email and password are guaranteed to be strings
    user = await db.users.find_one({"email": data.email})
```

---

### 2.4 Command Injection Prevention

**Avoid:** Executing shell commands with user input

**If Necessary:** Use strict validation and never shell=True

```python
import subprocess
import shlex

def safe_command_execution(user_input: str):
    # Whitelist allowed values
    allowed_commands = ['option1', 'option2', 'option3']
    
    if user_input not in allowed_commands:
        raise ValueError('Invalid option')
    
    # Use list format, not string
    # Never use shell=True with user input
    result = subprocess.run(
        ['command', user_input],  # List format
        capture_output=True,
        text=True,
        timeout=5
    )
    
    return result.stdout
```

**Better:** Avoid shell commands entirely, use native libraries

---

### 2.5 Path Traversal Prevention

**Prevent:** `../../etc/passwd` attacks

**Implementation:**

```python
import os
from pathlib import Path

def safe_file_access(filename: str, base_directory: str) -> str:
    """
    Safely access files within base directory
    """
    # Resolve to absolute path
    base_path = Path(base_directory).resolve()
    file_path = (base_path / filename).resolve()
    
    # Ensure file is within base directory
    if not file_path.is_relative_to(base_path):
        raise ValueError('Access denied: Path traversal detected')
    
    # Check file exists
    if not file_path.exists():
        raise FileNotFoundError('File not found')
    
    return str(file_path)

# Usage
try:
    safe_path = safe_file_access(user_provided_filename, '/app/uploads')
    with open(safe_path, 'r') as f:
        content = f.read()
except ValueError as e:
    # Path traversal attempt blocked
    logger.warning(f'Path traversal attempt: {user_provided_filename}')
```

**TypeScript:**

```typescript
import * as path from 'path';
import * as fs from 'fs';

function safeFileAccess(filename: string, baseDirectory: string): string {
  const basePath = path.resolve(baseDirectory);
  const filePath = path.resolve(basePath, filename);
  
  // Ensure file is within base directory
  if (!filePath.startsWith(basePath)) {
    throw new Error('Access denied: Path traversal detected');
  }
  
  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }
  
  return filePath;
}
```

---

## 3. Encoding and Escaping

### 3.1 HTML Encoding

**When to Use:** Displaying user content in HTML

```python
import html

def display_user_content(content: str) -> str:
    """
    Encode HTML entities
    """
    return html.escape(content)

# Usage in template
# <div>{{ display_user_content(user.bio) }}</div>
```

**TypeScript:**

```typescript
function escapeHtml(text: string): string {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}
```

---

### 3.2 URL Encoding

```python
from urllib.parse import quote

def build_redirect_url(user_input: str) -> str:
    base_url = "https://novacore.ai/search"
    encoded_input = quote(user_input, safe='')
    return f"{base_url}?q={encoded_input}"
```

---

### 3.3 JSON Encoding

**Prevent:** JSON injection

```typescript
// Safe - using JSON.stringify
const response = {
  message: JSON.stringify(userInput)
};

// DANGEROUS - string concatenation
const response = `{"message": "${userInput}"}`;
// If userInput = '", "admin": true, "'
// Results in: {"message": "", "admin": true, ""}
```

---

## 4. File Upload Validation

### 4.1 File Type Validation

**Whitelist Approach:** Only allow specific file types

```python
from fastapi import UploadFile
import magic

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.pdf'}
ALLOWED_MIME_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'application/pdf'
}

async def validate_file_upload(file: UploadFile):
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, 'File type not allowed')
    
    # Check MIME type (don't trust client-provided content-type)
    content = await file.read()
    mime_type = magic.from_buffer(content, mime=True)
    await file.seek(0)  # Reset file pointer
    
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f'Invalid file type: {mime_type}')
    
    # Check file size
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(400, 'File too large (max 5MB)')
    
    return file
```

### 4.2 Filename Sanitization

```python
import re
from pathlib import Path

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal
    """
    # Get base filename (remove path)
    filename = Path(filename).name
    
    # Remove non-alphanumeric characters (except . - _)
    filename = re.sub(r'[^\w\.-]', '_', filename)
    
    # Limit length
    name, ext = os.path.splitext(filename)
    if len(name) > 200:
        name = name[:200]
    
    return name + ext

# Usage
safe_filename = sanitize_filename(user_filename)
```

---

## 5. Rate Limiting

### 5.1 Endpoint-Specific Rate Limits

```typescript
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('api')
export class ApiController {
  @Post('chat')
  @UseGuards(ThrottlerGuard)
  @Throttle(10, 60) // 10 requests per 60 seconds
  async chat(@Body() message: ChatMessageDto) {
    // Handler
  }
  
  @Post('register')
  @Throttle(3, 3600) // 3 registrations per hour
  async register(@Body() data: RegisterDto) {
    // Handler
  }
}
```

**Python/FastAPI:**

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/chat")
@limiter.limit("10/minute")
async def chat(request: Request, message: ChatMessage):
    # Handler
    pass
```

---

## 6. Validation Error Responses

### 6.1 User-Friendly Error Messages

**DO:**

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

**DON'T:**

```json
{
  "error": "ValidationError: Path `email` is invalid",
  "stack": "at Model.validate (node_modules/mongoose/lib/model.js:4516:11)..."
}
```

---

## 7. Testing Input Validation

### 7.1 Test Cases

```typescript
describe('Input Validation', () => {
  describe('Message Length', () => {
    it('should accept message within limit', async () => {
      const message = 'x'.repeat(10000);
      const response = await request(app)
        .post('/chat')
        .send({ message });
      expect(response.status).toBe(200);
    });

    it('should reject message exceeding limit', async () => {
      const message = 'x'.repeat(10001);
      const response = await request(app)
        .post('/chat')
        .send({ message });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('exceeds maximum length');
    });

    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: '   ' });
      expect(response.status).toBe(400);
    });
  });

  describe('XSS Prevention', () => {
    it('should strip HTML tags', async () => {
      const malicious = '<script>alert("XSS")</script>Hello';
      const response = await request(app)
        .post('/chat')
        .send({ message: malicious });
      
      // Verify stored message has no HTML
      const storedMessage = await db.messages.findOne({ /* ... */ });
      expect(storedMessage.content).not.toContain('<script>');
      expect(storedMessage.content).toContain('Hello');
    });
  });
});
```

---

## 8. Input Validation Checklist

### 8.1 Implementation Checklist

- [ ] Message length validation (max 10,000 chars)
- [ ] Request size limits (max 10 MB)
- [ ] Email format validation
- [ ] Password strength validation
- [ ] XSS prevention (HTML sanitization)
- [ ] SQL injection prevention (parameterized queries)
- [ ] NoSQL injection prevention (type validation)
- [ ] Path traversal prevention
- [ ] File upload validation (type, size, name)
- [ ] Rate limiting on all endpoints
- [ ] User-friendly error messages
- [ ] Input validation unit tests

### 8.2 Security Review Checklist

- [ ] All user inputs validated before processing
- [ ] All database queries use parameterized queries
- [ ] No shell command execution with user input
- [ ] No file system access with user-provided paths
- [ ] All HTML content sanitized before display
- [ ] All URLs validated before redirects
- [ ] File uploads restricted to safe types
- [ ] Rate limiting prevents abuse
- [ ] Error messages don't leak sensitive information

---

## 9. References

### 9.1 Standards and Guidelines

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

### 9.2 Related Documentation

- [AUTHENTICATION_SECURITY.md](./AUTHENTICATION_SECURITY.md) - Authentication security
- [SECURITY_HEADERS.md](./SECURITY_HEADERS.md) - HTTP security headers
- [WEBHOOK_SECURITY.md](./WEBHOOK_SECURITY.md) - Webhook security

---

**Document Status:** ACTIVE - Ready for Implementation  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025

**For Questions:** Contact Cloud and Cybersecurity Specialist

---

**END OF INPUT VALIDATION SPECIFICATION**
