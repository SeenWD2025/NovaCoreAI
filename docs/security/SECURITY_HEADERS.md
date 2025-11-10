# HTTP Security Headers Specification

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist  
**Status:** Active Security Specification

---

## Executive Summary

This document specifies HTTP security headers for NovaCoreAI services. Proper security headers protect against common web vulnerabilities including XSS, clickjacking, MIME sniffing, and protocol downgrade attacks.

---

## 1. Required Security Headers

### 1.1 Content-Security-Policy (CSP)

**Purpose:** Mitigate XSS and data injection attacks by controlling resource loading

**Severity if Missing:** HIGH (enables XSS attacks)

**Recommended Configuration:**

```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
  font-src 'self' https://fonts.gstatic.com; 
  img-src 'self' data: https:; 
  connect-src 'self' https://api.stripe.com; 
  frame-ancestors 'none'; 
  base-uri 'self'; 
  form-action 'self';
```

**Directive Breakdown:**

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Default policy: only load from same origin |
| `script-src` | `'self' 'unsafe-inline' cdn.jsdelivr.net` | Allow scripts from same origin, inline, and trusted CDN |
| `style-src` | `'self' 'unsafe-inline' fonts.googleapis.com` | Allow styles from same origin, inline, and Google Fonts |
| `font-src` | `'self' fonts.gstatic.com` | Allow fonts from same origin and Google Fonts |
| `img-src` | `'self' data: https:` | Allow images from same origin, data URIs, and HTTPS |
| `connect-src` | `'self' api.stripe.com` | Allow XHR/fetch to same origin and Stripe API |
| `frame-ancestors` | `'none'` | Prevent page from being embedded in iframe |
| `base-uri` | `'self'` | Restrict `<base>` element URLs to same origin |
| `form-action` | `'self'` | Restrict form submission to same origin |

**Implementation (Node.js/Express):**

```typescript
import helmet from 'helmet';

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.stripe.com"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"]
  }
}));
```

**Implementation (NestJS):**

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
```

**Production Best Practice:** Remove `'unsafe-inline'` for maximum security

Use nonces or hashes for inline scripts:

```html
<!-- Generate nonce in backend -->
<script nonce="random-nonce-value">
  // Inline script
</script>
```

```
Content-Security-Policy: script-src 'self' 'nonce-random-nonce-value'
```

---

### 1.2 X-Frame-Options

**Purpose:** Prevent clickjacking attacks by controlling whether page can be embedded in iframe

**Severity if Missing:** MEDIUM (enables clickjacking)

**Recommended Value:** `DENY`

**Alternative:** `SAMEORIGIN` (if iframe embedding from same origin is needed)

```
X-Frame-Options: DENY
```

**Implementation:**

```typescript
app.use(helmet.frameguard({ action: 'deny' }));
```

**Note:** CSP `frame-ancestors` directive supersedes this header, but include both for browser compatibility.

---

### 1.3 X-Content-Type-Options

**Purpose:** Prevent MIME-sniffing attacks where browser interprets files as different content type

**Severity if Missing:** MEDIUM (enables content sniffing attacks)

**Required Value:** `nosniff`

```
X-Content-Type-Options: nosniff
```

**Implementation:**

```typescript
app.use(helmet.noSniff());
```

**Why Important:** Prevents browser from treating `text/plain` as `text/html`, which could execute malicious scripts.

---

### 1.4 Strict-Transport-Security (HSTS)

**Purpose:** Force HTTPS connections, prevent protocol downgrade attacks

**Severity if Missing:** HIGH (enables MITM attacks)

**Recommended Value:**

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Directive Breakdown:**

| Directive | Value | Purpose |
|-----------|-------|---------|
| `max-age` | `31536000` | Cache HTTPS requirement for 1 year (in seconds) |
| `includeSubDomains` | (flag) | Apply to all subdomains |
| `preload` | (flag) | Allow inclusion in browser preload lists |

**Implementation:**

```typescript
app.use(helmet.hsts({
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true
}));
```

**Important:**
- Only enable after confirming HTTPS works correctly
- Start with shorter `max-age` (e.g., 300 seconds) for testing
- Increase to 31536000 once confident
- Submit domain to [HSTS Preload List](https://hstspreload.org/)

**Removal Process:** If need to disable HTTPS, must wait for max-age to expire. Use shorter max-age during testing.

---

### 1.5 X-XSS-Protection

**Purpose:** Enable browser's XSS filter (legacy protection)

**Severity if Missing:** LOW (modern CSP is better)

**Recommended Value:** `1; mode=block`

```
X-XSS-Protection: 1; mode=block
```

**Modes:**
- `0` - Disable filter (not recommended)
- `1` - Enable filter, sanitize page
- `1; mode=block` - Enable filter, block page rendering if XSS detected

**Implementation:**

```typescript
app.use(helmet.xssFilter());
```

**Note:** Deprecated in some modern browsers. CSP is preferred, but include for older browser support.

---

### 1.6 Referrer-Policy

**Purpose:** Control how much referrer information is sent with requests

**Severity if Missing:** LOW (privacy concern, not security critical)

**Recommended Value:** `strict-origin-when-cross-origin`

```
Referrer-Policy: strict-origin-when-cross-origin
```

**Policy Options:**

| Policy | Behavior |
|--------|----------|
| `no-referrer` | Never send referrer |
| `no-referrer-when-downgrade` | Send full URL unless HTTPS→HTTP |
| `origin` | Send only origin (no path) |
| `origin-when-cross-origin` | Full URL for same-origin, origin only for cross-origin |
| `same-origin` | Send referrer only for same-origin requests |
| `strict-origin` | Send origin, but not on HTTPS→HTTP |
| `strict-origin-when-cross-origin` | Full URL for same-origin, origin for cross-origin, none on downgrade |
| `unsafe-url` | Always send full URL (not recommended) |

**Implementation:**

```typescript
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
```

**Why This Policy:**
- Sends full referrer for same-origin requests (useful for analytics)
- Sends only origin for cross-origin (privacy)
- Doesn't send referrer on HTTPS→HTTP downgrade (security)

---

### 1.7 Permissions-Policy (formerly Feature-Policy)

**Purpose:** Control which browser features can be used

**Severity if Missing:** LOW (defense in depth)

**Recommended Value:**

```
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
```

**Common Features to Restrict:**

| Feature | Recommended | Reason |
|---------|-------------|---------|
| `geolocation` | `()` (disable) | Not needed for NovaCoreAI |
| `microphone` | `()` (disable) | Not needed |
| `camera` | `()` (disable) | Not needed |
| `payment` | `()` (disable) | Using Stripe, not Payment Request API |
| `usb` | `()` (disable) | Not needed |
| `autoplay` | `'self'` | Allow for same-origin |
| `fullscreen` | `'self'` | Allow for same-origin |

**Implementation:**

```typescript
app.use(helmet.permissionsPolicy({
  features: {
    geolocation: [],
    microphone: [],
    camera: [],
    payment: [],
    usb: [],
    autoplay: ["'self'"],
    fullscreen: ["'self'"]
  }
}));
```

---

### 1.8 X-Powered-By

**Purpose:** Remove server technology disclosure

**Severity if Missing:** LOW (information disclosure)

**Required Action:** Remove header

```
# Should NOT be present
X-Powered-By: Express
```

**Implementation:**

```typescript
app.disable('x-powered-by');
// or
app.use(helmet.hidePoweredBy());
```

**Why Remove:** Prevents attackers from knowing technology stack, making targeted attacks harder.

---

## 2. Complete Implementation

### 2.1 Gateway Service (Express)

**File:** `services/gateway/src/index.ts`

```typescript
import express from 'express';
import helmet from 'helmet';

const app = express();

// Apply all security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      geolocation: [],
      microphone: [],
      camera: [],
      payment: [],
      usb: []
    }
  }
}));

// Remove X-Powered-By
app.disable('x-powered-by');

// Additional custom headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rest of application...
```

### 2.2 Auth-Billing Service (NestJS)

**File:** `services/auth-billing/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply helmet security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  await app.listen(3001);
}
bootstrap();
```

### 2.3 Python Services (FastAPI)

**File:** `services/intelligence/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        
        # Content-Security-Policy
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Optional: Restrict allowed hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=['api.novacore.ai', 'localhost', '127.0.0.1']
)
```

---

## 3. Environment-Specific Configuration

### 3.1 Development Environment

**Relaxed CSP for Development:**

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      // Production CSP directives
    }
  },
  hsts: isDevelopment ? false : {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Why:** Development may need hot reloading, inline scripts, etc.

### 3.2 Production Environment

**Strict Configuration:**

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // Remove 'unsafe-inline'
      styleSrc: ["'self'"], // Remove 'unsafe-inline'
      // ... strict directives
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  // Enable all protections
}));
```

---

## 4. Testing Security Headers

### 4.1 Manual Testing

**Using cURL:**

```bash
curl -I https://api.novacore.ai
```

**Expected Output:**

```
HTTP/2 200
content-type: application/json
content-security-policy: default-src 'self'; ...
x-frame-options: DENY
x-content-type-options: nosniff
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-xss-protection: 1; mode=block
referrer-policy: strict-origin-when-cross-origin
```

### 4.2 Automated Testing

**Using securityheaders.com:**

Visit: https://securityheaders.com/?q=https://api.novacore.ai

**Target Grade:** A+ or A

**Using Mozilla Observatory:**

Visit: https://observatory.mozilla.org/analyze/api.novacore.ai

**Target Score:** 90+ / 100

### 4.3 Unit Tests

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('Security Headers', () => {
  it('should include X-Frame-Options header', async () => {
    const response = await request(app).get('/');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should include X-Content-Type-Options header', async () => {
    const response = await request(app).get('/');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include Strict-Transport-Security header', async () => {
    const response = await request(app).get('/');
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('should include Content-Security-Policy header', async () => {
    const response = await request(app).get('/');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('should not include X-Powered-By header', async () => {
    const response = await request(app).get('/');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
```

---

## 5. Monitoring and Alerts

### 5.1 Metrics

**Track Header Compliance:**

```typescript
// Middleware to track missing headers
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check required headers
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'content-security-policy',
      'strict-transport-security'
    ];
    
    for (const header of requiredHeaders) {
      if (!res.getHeader(header)) {
        console.warn(`Missing security header: ${header}`);
        metrics.increment('security_headers_missing', { header });
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});
```

### 5.2 CSP Violation Reporting

**Enable CSP Reporting:**

```typescript
contentSecurityPolicy: {
  directives: {
    // ... other directives
    reportUri: '/csp-violation-report'
  }
}
```

**Violation Report Endpoint:**

```typescript
app.post('/csp-violation-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const violation = req.body['csp-report'];
  
  console.warn('CSP Violation:', {
    documentUri: violation['document-uri'],
    violatedDirective: violation['violated-directive'],
    blockedUri: violation['blocked-uri'],
    lineNumber: violation['line-number'],
    sourceFile: violation['source-file']
  });
  
  // Send to monitoring system
  metrics.increment('csp_violations', {
    directive: violation['violated-directive']
  });
  
  res.status(204).end();
});
```

---

## 6. Common Issues and Solutions

### 6.1 CSP Blocking Legitimate Resources

**Problem:** CSP blocks CDN resources, inline styles, or third-party scripts

**Solution:** Add specific domains to allowlist

```typescript
scriptSrc: ["'self'", "https://trusted-cdn.com"]
```

**Better Solution:** Use SRI (Subresource Integrity) for CDN resources

```html
<script 
  src="https://cdn.jsdelivr.net/npm/lib@1.0.0/lib.min.js" 
  integrity="sha384-hash..." 
  crossorigin="anonymous">
</script>
```

### 6.2 HSTS Causing Issues

**Problem:** Can't access site over HTTP after enabling HSTS

**Solution:** 
1. Test with short max-age first (e.g., 300 seconds)
2. Ensure HTTPS works perfectly
3. Gradually increase max-age
4. Use Chrome's `chrome://net-internals/#hsts` to delete HSTS entry during testing

### 6.3 Frames Breaking Legitimate Use Cases

**Problem:** Need to embed content in iframe

**Solution:** Use `SAMEORIGIN` instead of `DENY`

```typescript
frameguard: { action: 'sameorigin' }
```

Or allow specific origins with CSP:

```typescript
frameAncestors: ["'self'", "https://trusted-site.com"]
```

---

## 7. Security Headers Checklist

### 7.1 Pre-Production

- [ ] All security headers configured
- [ ] CSP allows all legitimate resources
- [ ] CSP violations logged and monitored
- [ ] HSTS enabled with appropriate max-age
- [ ] X-Powered-By header removed
- [ ] Headers tested with securityheaders.com (Grade A or higher)
- [ ] Headers tested with Mozilla Observatory (Score 90+)
- [ ] Unit tests for security headers passing
- [ ] CSP violation reporting endpoint configured

### 7.2 Production

- [ ] HSTS max-age set to 31536000 (1 year)
- [ ] HSTS includeSubDomains enabled
- [ ] Domain submitted to HSTS preload list
- [ ] CSP `'unsafe-inline'` removed (if possible)
- [ ] All third-party domains explicitly allowed in CSP
- [ ] Monitoring for missing headers in place
- [ ] CSP violations tracked in monitoring system

---

## 8. References

### 8.1 Standards and Specifications

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [CSP Specification](https://www.w3.org/TR/CSP3/)
- [HSTS Specification](https://tools.ietf.org/html/rfc6797)

### 8.2 Testing Tools

- [Security Headers](https://securityheaders.com)
- [Mozilla Observatory](https://observatory.mozilla.org)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com)
- [Report URI](https://report-uri.com)

### 8.3 Related Documentation

- [INPUT_VALIDATION.md](./INPUT_VALIDATION.md) - Input validation standards
- [AUTHENTICATION_SECURITY.md](./AUTHENTICATION_SECURITY.md) - Authentication security
- [WEBHOOK_SECURITY.md](./WEBHOOK_SECURITY.md) - Webhook security

---

**Document Status:** ACTIVE - Ready for Implementation  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025

**For Questions:** Contact Cloud and Cybersecurity Specialist

---

**END OF SECURITY HEADERS SPECIFICATION**
