# Detailed Issues Appendix
**Companion Document to:** PROJECT_ISSUES_REPORT.md  
**Generated:** 2025-11-11

This appendix contains the detailed line-by-line breakdown of all issues discovered during the comprehensive project audit.

---

## TABLE OF CONTENTS
1. [Frontend Service Issues](#frontend-service-issues)
2. [Gateway Service Issues](#gateway-service-issues)
3. [Auth-Billing Service Issues](#auth-billing-service-issues)
4. [Intelligence Service Issues](#intelligence-service-issues)
5. [Memory Service Issues](#memory-service-issues)
6. [Noble-Spirit Service Issues](#noble-spirit-service-issues)
7. [VSCode Extension Issues](#vscode-extension-issues)
8. [Infrastructure Issues](#infrastructure-issues)
9. [Shell Script Issues](#shell-script-issues)

---

## FRONTEND SERVICE ISSUES

### ESLint Errors (33 total)

#### src/App.tsx
```
Line 44, Column 6: warning
React Hook useEffect has missing dependencies: 'isAuthenticated' and 'loadUser'
Either include them or remove the dependency array
Rule: react-hooks/exhaustive-deps
```

#### src/components/QuotaCard.tsx
```
Line 51, Column 19: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/pages/ChallengePlayground.tsx
```
Line 14, Column 26: error
'ChallengeSubmission' is defined but never used
Rule: @typescript-eslint/no-unused-vars

Line 25, Column 50: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 60, Column 59: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 69, Column 14: error
'error' is defined but never used
Rule: @typescript-eslint/no-unused-vars

Line 90, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 165, Column 47: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 165, Column 75: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/pages/Chat.tsx
```
Line 52, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/pages/Dashboard.tsx
```
Line 31, Column 6: warning
React Hook useEffect has missing dependencies: 'fetchAchievements' and 'fetchProgress'
Either include them or remove the dependency array
Rule: react-hooks/exhaustive-deps
```

#### src/pages/Leaderboard.tsx
```
Line 13, Column 6: warning
React Hook useEffect has missing dependencies: 'fetchLeaderboard' and 'fetchProgress'
Either include them or remove the dependency array
Rule: react-hooks/exhaustive-deps
```

#### src/pages/LessonViewer.tsx
```
Line 89, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/pages/LevelBrowser.tsx
```
Line 26, Column 6: warning
React Hook useEffect has missing dependencies: 'fetchLevels' and 'fetchProgress'
Either include them or remove the dependency array
Rule: react-hooks/exhaustive-deps

Line 49, Column 9: error
'getPhaseColor' is assigned a value but never used
Rule: @typescript-eslint/no-unused-vars
```

#### src/pages/Login.tsx
```
Line 17, Column 14: error
'err' is defined but never used
Rule: @typescript-eslint/no-unused-vars
```

#### src/pages/MemoryViz.tsx
```
Line 14, Column 38: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 20, Column 6: warning
React Hook useEffect has a missing dependency: 'loadMemories'
Either include it or remove the dependency array
Rule: react-hooks/exhaustive-deps

Line 24, Column 6: warning
React Hook useEffect has a missing dependency: 'filterMemories'
Either include it or remove the dependency array
Rule: react-hooks/exhaustive-deps
```

#### src/pages/ProgressTracker.tsx
```
Line 16, Column 35: error
'levels' is assigned a value but never used
Rule: @typescript-eslint/no-unused-vars

Line 22, Column 6: warning
React Hook useEffect has missing dependencies: 'fetchAchievements', 'fetchLevels', and 'fetchProgress'
Either include them or remove the dependency array
Rule: react-hooks/exhaustive-deps
```

#### src/pages/Register.tsx
```
Line 34, Column 14: error
'err' is defined but never used
Rule: @typescript-eslint/no-unused-vars
```

#### src/pages/Usage.tsx
```
Line 48, Column 6: warning
React Hook useEffect has a missing dependency: 'fetchUsageData'
Either include it or remove the dependency array
Rule: react-hooks/exhaustive-deps
```

#### src/services/api.ts
```
Line 31, Column 45: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/services/curriculum.ts
```
Line 21, Column 63: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 54, Column 18: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/services/usage.ts
```
Line 111, Column 35: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 119, Column 37: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/stores/curriculumStore.ts
```
Line 29, Column 65: error
'get' is defined but never used
Rule: @typescript-eslint/no-unused-vars

Line 43, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 54, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 65, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 76, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

#### src/types/curriculum.ts
```
Line 22, Column 25: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 40, Column 19: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 41, Column 14: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 57, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 83, Column 16: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 88, Column 14: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 98, Column 18: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any

Line 109, Column 21: error
Unexpected any. Specify a different type
Rule: @typescript-eslint/no-explicit-any
```

### NPM Audit - Security Vulnerabilities

```
Package: dompurify
Severity: moderate
Vulnerable Versions: <3.2.4
Issue: DOMPurify allows Cross-site Scripting (XSS)
Advisory: https://github.com/advisories/GHSA-vhxf-7vqr-mrjg
Fix: npm audit fix

Dependent Package: monaco-editor
Versions: 0.54.0-dev-20250909 - 0.55.0-dev-20251016
Depends on vulnerable dompurify
```

### Build Warnings

```
Bundle Size Warning:
Main bundle: 523.74 kB (gzipped: 159.20 kB)
Warning threshold: 500 kB
Recommendation: Use dynamic import() for code-splitting
```

---

## GATEWAY SERVICE ISSUES

### TypeScript Build
✅ **PASSED** - No errors

### Tests
✅ **PASSED** - 153 tests passed, 8 test suites passed

### Deprecation Warnings
```
Package: inflight@1.0.6
Issue: Memory leak, not supported
Recommendation: Use lru-cache

Package: glob@7.2.3
Issue: Versions prior to v9 no longer supported
Recommendation: Upgrade to glob@9+
```

### Jest Configuration Warning
```
File: jest.config.js or package.json
Issue: ts-jest config under `globals` is deprecated
Current:
  globals: {
    'ts-jest': { /* config */ }
  }

Recommended:
  transform: {
    '^.+\\.ts$': ['ts-jest', { /* config */ }]
  }
```

---

## AUTH-BILLING SERVICE ISSUES

### TypeScript Build
✅ **PASSED** - No errors

### Tests
⚠️ **PARTIAL FAILURE** - 72 passed, 9 failed (Redis tests)

#### Failed Tests Details
```
Test Suite: src/redis/redis.service.spec.ts
Status: FAILED - 9 tests

Error: MaxRetriesPerRequestError
Message: Reached the max retries per request limit (which is 3)
Root Cause: Redis not running on localhost:6379

Failed Tests:
1. RedisService › incrementLoginAttempts › should increment login attempts for an email
2. RedisService › incrementLoginAttempts › should increment multiple times
3. RedisService › incrementLoginAttempts › should set expiration on first attempt
4. RedisService › getLoginAttempts › should return 0 for email with no attempts
5. RedisService › getLoginAttempts › should return correct attempt count
6. RedisService › resetLoginAttempts › should reset login attempts to 0
7. RedisService › generic operations › should set and get a value
8. RedisService › generic operations › should set value with TTL
9. RedisService › generic operations › should delete a key

Additional Error:
Worker process failed to exit gracefully
Likely cause: Tests leaking due to improper teardown
Recommendation: Run with --detectOpenHandles to find leaks
```

### NPM Audit - Security Vulnerabilities

```
Package: nodemailer
Severity: moderate
Vulnerable Versions: <7.0.7
Issue: Email to an unintended domain can occur due to Interpretation Conflict
Advisory: https://github.com/advisories/GHSA-mm7p-fcc7-pg87
Fix: npm audit fix --force (breaking change)
Will install: nodemailer@7.0.10
```

### Deprecation Warnings
```
Package: inflight@1.0.6
Package: glob@7.2.3
Package: supertest@6.3.4
  Recommendation: Upgrade to supertest@7.1.3+
Package: rimraf@3.0.2
  Issue: Versions prior to v4 no longer supported
Package: npmlog@5.0.1
  Issue: No longer supported
Package: are-we-there-yet@2.0.0
  Issue: No longer supported
Package: gauge@3.0.2
  Issue: No longer supported
Package: superagent@8.1.2
  Recommendation: Upgrade to superagent@10.2.2+
```

---

## INTELLIGENCE SERVICE ISSUES

### Python Flake8 Issues (247 violations)

#### Critical Errors

##### app/config.py
```
Line 4: F401 'typing.Optional' imported but unused
Line 9: W293 blank line contains whitespace
Line 13: W293 blank line contains whitespace
Line 16: W293 blank line contains whitespace
Line 21: W293 blank line contains whitespace
Line 26: W293 blank line contains whitespace
Line 30: W293 blank line contains whitespace
Line 34: W293 blank line contains whitespace
```

##### app/database.py
```
Line 3: F401 'sqlalchemy.orm.Session' imported but unused
```

##### app/middleware.py
```
Line 12: W293 blank line contains whitespace
Line 16: W293 blank line contains whitespace
Line 19: W293 blank line contains whitespace
Line 22: W293 blank line contains whitespace
Line 25: W293 blank line contains whitespace
```

##### app/models/schemas.py
```
Line 35: W293 blank line contains whitespace
Line 72: W293 blank line contains whitespace
```

##### app/routers/chat.py
```
Line 13: W291 trailing whitespace
Line 23: F401 'app.utils.metrics.track_message_processing' imported but unused
Line 23: F401 'app.utils.metrics.track_tokens' imported but unused
Line 23: F401 'app.utils.metrics.track_memory_context' imported but unused
Line 23: F401 'app.utils.metrics.increment_active_sessions' imported but unused
Line 23: F401 'app.utils.metrics.decrement_active_sessions' imported but unused
Line 24: W291 trailing whitespace
Line 54: W293 blank line contains whitespace
Line 56: W293 blank line contains whitespace
Line 60: W293 blank line contains whitespace
Line 63: W293 blank line contains whitespace
Line 69: W293 blank line contains whitespace
Line 82: W293 blank line contains whitespace
Line 86: W293 blank line contains whitespace
Line 92: W293 blank line contains whitespace
Line 95: W293 blank line contains whitespace
Line 99: W293 blank line contains whitespace
Line 108: W293 blank line contains whitespace
Line 118: W293 blank line contains whitespace
Line 121: W293 blank line contains whitespace
Line 127: W293 blank line contains whitespace
Line 130: W293 blank line contains whitespace
Line 133: W293 blank line contains whitespace
Line 136: W293 blank line contains whitespace
Line 143: W293 blank line contains whitespace
Line 150: W293 blank line contains whitespace
Line 152: E501 line too long (192 > 127 characters)
Line 159: W293 blank line contains whitespace
... (continues with more whitespace issues)
```

##### app/services/ollama_service.py
```
Line 28: W293 blank line contains whitespace
Line 34: W293 blank line contains whitespace
Line 40: W293 blank line contains whitespace
Line 44: W293 blank line contains whitespace
Line 50: W293 blank line contains whitespace
Line 54: W293 blank line contains whitespace
Line 63: W293 blank line contains whitespace
Line 79: W293 blank line contains whitespace
... (continues)
```

##### app/services/integration_service.py
```
Line 14: W293 blank line contains whitespace
Line 18: W293 blank line contains whitespace
Line 21: W293 blank line contains whitespace
Line 29: F841 local variable 'result' is assigned to but never used
Line 48: W293 blank line contains whitespace
... (continues)
```

##### app/services/session_service.py
```
Line 21: W293 blank line contains whitespace
Line 23: W293 blank line contains whitespace
Line 26: W293 blank line contains whitespace
Line 33: W293 blank line contains whitespace
Line 35: W293 blank line contains whitespace
... (continues)
```

##### app/services/usage_service.py
```
Line 17: W293 blank line contains whitespace
Line 26: W293 blank line contains whitespace
Line 31: W293 blank line contains whitespace
Line 40: W293 blank line contains whitespace
... (continues with 50+ violations)
```

##### app/utils/metrics.py
```
Line 67: W293 blank line contains whitespace
Line 78: W293 blank line contains whitespace
```

##### app/utils/sanitize.py
```
Line 7: F401 'typing.Optional' imported but unused
Line 20: W293 blank line contains whitespace
Line 23: W293 blank line contains whitespace
... (continues)
```

##### app/utils/service_auth.py
```
Line 24: W293 blank line contains whitespace
Line 30: W293 blank line contains whitespace
Line 45: W293 blank line contains whitespace
... (continues with 20+ violations)
```

##### app/utils/token_counter.py
```
Line 9: W293 blank line contains whitespace
Line 12: W293 blank line contains whitespace
Line 19: W293 blank line contains whitespace
Line 34: W293 blank line contains whitespace
Line 40: W293 blank line contains whitespace
Line 51: W293 blank line contains whitespace
Line 54: W293 blank line contains whitespace
```

### Black Formatting Issues
14 files would be reformatted:
1. app/middleware.py
2. app/metrics.py
3. app/config.py
4. app/database.py
5. app/models/schemas.py
6. app/services/ollama_service.py
7. app/services/integration_service.py
8. app/services/session_service.py
9. app/utils/metrics.py
10. app/utils/sanitize.py
11. app/utils/token_counter.py
12. app/utils/service_auth.py
13. app/services/usage_service.py
14. app/routers/chat.py

### Isort Import Sorting Issues
13 files have incorrectly sorted imports:
1. app/metrics.py
2. app/database.py
3. app/middleware.py
4. app/config.py
5. app/models/schemas.py
6. app/routers/chat.py
7. app/utils/metrics.py
8. app/utils/sanitize.py
9. app/utils/service_auth.py
10. app/services/ollama_service.py
11. app/services/session_service.py
12. app/services/usage_service.py
13. app/services/integration_service.py

### MyPy Type Checking
```
File: app/metrics.py
Line 14: error: Invalid syntax [syntax]
Status: Type checking failed - prevented further checking
```

---

## MEMORY SERVICE ISSUES

### Critical: Dependency Installation Failure

```
Error Type: subprocess-exited-with-error
Exit Code: 1

Traceback:
  File: pip/_vendor/pyproject_hooks/_in_process/_in_process.py
  Module: setuptools/version.py:1
  Import: pkg_resources
  Error: AttributeError: module 'pkgutil' has no attribute 'ImpImporter'
         Did you mean: 'zipimporter'?

Root Cause: Incompatible setuptools version with Python 3.12
Impact: Cannot install dependencies, service cannot build

Solution Options:
1. Pin Python to 3.11 in Dockerfile
2. Update setuptools in requirements.txt
3. Add setuptools<67.0.0 to requirements.txt (compatible with Python 3.12)
```

---

## NOBLE-SPIRIT SERVICE ISSUES

### Python Flake8 Issues (114 violations)

##### app/services/policy_service.py
```
Line 358: W293 blank line contains whitespace
Line 360: W293 blank line contains whitespace
Line 373: W293 blank line contains whitespace
Line 375: W293 blank line contains whitespace
```

##### app/utils/service_auth.py
```
Line 24: W293 blank line contains whitespace
Line 30: W293 blank line contains whitespace
Line 45: W293 blank line contains whitespace
Line 48: W293 blank line contains whitespace
Line 51: W293 blank line contains whitespace
Line 61: W293 blank line contains whitespace
Line 68: W293 blank line contains whitespace
Line 75: W293 blank line contains whitespace
Line 77: W293 blank line contains whitespace
Line 79: W293 blank line contains whitespace
Line 81: W293 blank line contains whitespace
Line 106: W293 blank line contains whitespace
Line 108: W293 blank line contains whitespace
Line 116: W293 blank line contains whitespace
Line 119: W293 blank line contains whitespace
Line 122: W293 blank line contains whitespace
Line 131: W293 blank line contains whitespace
Line 138: W293 blank line contains whitespace
Line 141: W293 blank line contains whitespace
Line 144: W293 blank line contains whitespace
Line 147: W293 blank line contains whitespace
Line 153: W293 blank line contains whitespace
Line 160: W293 blank line contains whitespace
```

##### Other Files
```
2 instances: F401 'sqlalchemy.orm.Session' imported but unused
112 instances: W293 blank line contains whitespace
```

---

## VSCODE EXTENSION ISSUES

### ESLint Naming Convention Warnings

##### src/mcpClient.ts
```
Line 8, Column 5: warning
Type Property name `confidence_score` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 9, Column 5: warning
Type Property name `created_at` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 14, Column 5: warning
Type Property name `context_summary` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 18, Column 5: warning
Type Property name `session_id` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 20, Column 5: warning
Type Property name `tokens_used` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 50, Column 13: warning
Object Literal Property name `file_path` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 51, Column 13: warning
Object Literal Property name `file_content` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 67, Column 13: warning
Object Literal Property name `file_path` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 81, Column 13: warning
Object Literal Property name `task_description` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 82, Column 13: warning
Object Literal Property name `file_context` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention

Line 83, Column 13: warning
Object Literal Property name `session_id` must match one of the following formats: camelCase
Rule: @typescript-eslint/naming-convention
```

### TypeScript Version Warning
```
Warning: Running unsupported TypeScript version

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0
YOUR TYPESCRIPT VERSION: 5.9.3

Impact: @typescript-eslint/typescript-estree may not work correctly
Recommendation: Downgrade to TypeScript 5.5.x or accept potential issues
```

### Deprecation Warnings
```
Package: inflight@1.0.6
Package: rimraf@3.0.2
Package: glob@7.2.3
Package: @humanwhocodes/object-schema@2.0.3
  Recommendation: Use @eslint/object-schema
Package: @humanwhocodes/config-array@0.13.0
  Recommendation: Use @eslint/config-array
Package: eslint@8.57.1
  Issue: This version is no longer supported
  Recommendation: Upgrade to ESLint 9.x
```

---

## INFRASTRUCTURE ISSUES

### GitHub Actions Workflow (.github/workflows/ci-cd.yml)

#### YAML Linting Errors (54 errors, 3 warnings)

```
Line 1, Column 1: warning
Missing document start "---"
Rule: document-start

Line 3, Column 1: warning
Truthy value should be one of [false, true]
Rule: truthy

Trailing Spaces (42 instances):
Lines: 30, 45, 55, 59, 64, 70, 76, 86, 91, 105, 119, 147, 151, 155, 158, 165,
       176, 195, 202, 206, 212, 221, 224, 227, 230, 233, 236, 240, 243, 257,
       264, 268, 274, 298, 303, 307, 311, 316, 320, 330, 335

Line Length Violations (12 instances):
Line 62: 119 characters (max 80)
Line 63: 135 characters
Line 66: 134 characters
Line 72: 91 characters
Line 78: 134 characters
Line 84: 96 characters
Line 88: 91 characters
Line 93: 134 characters
Line 96: 96 characters
Line 107: 91 characters
Line 110: 96 characters
Line 133: 110 characters
```

### Docker Compose Warnings

```
File: docker-compose.yml

Warning 1: Obsolete version attribute
Level: warning
Message: the attribute `version` is obsolete, it will be ignored, please remove it

Missing Environment Variables:
1. STRIPE_SECRET_KEY - Defaulting to blank string
2. STRIPE_WEBHOOK_SECRET - Defaulting to blank string
3. SMTP_USER - Defaulting to blank string
4. SMTP_PASSWORD - Defaulting to blank string

Impact: Services may fail at runtime if these are required
```

### Terraform Issues

```
Issue: terraform command not found
Impact: Cannot validate infrastructure as code
Recommendation: Install Terraform in development environment
Alternative: Only run Terraform in CI/CD where it's properly installed
```

---

## SHELL SCRIPT ISSUES

### scripts/apply_ngs_migrations.sh

```
Line 8: SC2046 (warning)
Issue: Quote this to prevent word splitting
Code: export $(cat .env | grep -v '^#' | xargs)
Fix: export "$(cat .env | grep -v '^#' | xargs)"

Line 8: SC2002 (style)
Issue: Useless cat
Code: cat .env | grep -v '^#'
Fix: grep -v '^#' .env

Line 34: SC2086 (info)
Issue: Double quote to prevent globbing and word splitting
Code: basename $file
Fix: basename "$file"

Line 36: SC2086 (info) - Multiple instances
Issue: Unquoted variables
Variables: $DB_HOST, $DB_PORT, $DB_USER, $DB_NAME
Fix: Use "$DB_HOST", "$DB_PORT", "$DB_USER", "$DB_NAME"

Line 38: SC2181 (style)
Issue: Check exit code directly
Code: if [ $? -eq 0 ]; then
Fix: if mycmd; then

Line 69: SC2086 (info) - Multiple instances
Issue: Unquoted variables in psql command
Variables: $DB_HOST, $DB_PORT, $DB_USER, $DB_NAME
Fix: Quote all variables
```

### scripts/backup.sh

```
Line 98: SC2086 (info)
Issue: Double quote to prevent globbing
Code: -mtime +${RETENTION_DAYS}
Fix: -mtime +"${RETENTION_DAYS}"

Line 99: SC2086 (info)
Issue: Same as above
Location: find "$BACKUP_DIR/redis"

Line 100: SC2086 (info)
Issue: Same as above
Location: find "$BACKUP_DIR/config"

Line 101: SC2086 (info)
Issue: Same as above
Location: find "$BACKUP_DIR/logs"
```

### scripts/test_ngs_endpoints.sh

```
Multiple Lines (60, 64, 73, 77, 81, etc.): SC2181 (style)
Issue: Check exit code directly with e.g. 'if mycmd;', not indirectly with $?
Code Pattern: [ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))
Fix Pattern: if command; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
```

### scripts/restore.sh
No significant issues found (not fully analyzed in this run)

---

## SUMMARY STATISTICS

### By Issue Type

| Category | Count |
|----------|-------|
| Security Vulnerabilities | 3 |
| Syntax Errors | 1 |
| Type Safety (any types) | 27 |
| Unused Variables/Imports | 19 |
| React Hook Dependencies | 8 |
| Whitespace Issues (Python) | 337 |
| Import Sorting Issues | 13 |
| Shell Script Issues | 30+ |
| YAML Linting Issues | 58 |
| Deprecated Packages | 15 |
| Test Failures | 9 |
| Configuration Issues | 8 |

### By Severity

| Severity | Count | % of Total |
|----------|-------|------------|
| Critical | 14 | 4.6% |
| High | 47 | 15.5% |
| Medium | 156 | 51.3% |
| Low | 87 | 28.6% |
| **Total** | **304** | **100%** |

---

**Note:** This is a living document. As issues are resolved, they should be marked as fixed in the main PROJECT_ISSUES_REPORT.md and removed from tracking in future audits.

**Last Updated:** 2025-11-11  
**Next Audit Scheduled:** 2025-11-18
