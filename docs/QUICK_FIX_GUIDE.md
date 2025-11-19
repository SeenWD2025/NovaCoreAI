# Quick Fix Guide
**Companion to:** PROJECT_ISSUES_REPORT.md  
**Purpose:** Fast reference for fixing common issues

---

## 🚀 Quick Start - Fix Critical Issues First

### 1. Security Fixes (5 minutes)

```bash
# Frontend - Fix XSS vulnerability
cd services/frontend
npm audit fix

# Auth-Billing - Fix nodemailer vulnerability (breaking change)
cd ../auth-billing
npm audit fix --force
```

### 2. Memory Service - Fix Dependency Installation (2 minutes)

```bash
cd services/memory

# Option A: Pin Python version in Dockerfile
# Change: FROM python:3.12 -> FROM python:3.11

# Option B: Add compatible setuptools to requirements.txt
echo "setuptools<67.0.0" >> requirements.txt
```

### 3. Intelligence Service - Fix Syntax Error (Review needed)

```bash
cd services/intelligence
# Open app/metrics.py line 14 and fix syntax error
# Check for unclosed brackets, quotes, or invalid Python syntax
```

---

## 🔧 Python Code Quality - Auto-Fix (10 minutes per service)

### Intelligence Service

```bash
cd services/intelligence

# 1. Auto-format with Black
python3 -m pip install black
python3 -m black app/

# 2. Auto-sort imports
python3 -m pip install isort
python3 -m isort app/

# 3. Auto-fix whitespace (autopep8)
python3 -m pip install autopep8
python3 -m autopep8 --in-place --recursive --select=W291,W293 app/

# 4. Remove unused imports (autoflake)
python3 -m pip install autoflake
python3 -m autoflake --in-place --remove-all-unused-imports --recursive app/

# Verify fixes
python3 -m flake8 app/ --count --statistics
```

### Noble-Spirit Service

```bash
cd services/noble-spirit

# Apply same commands as Intelligence service
python3 -m black app/
python3 -m isort app/
python3 -m autopep8 --in-place --recursive --select=W291,W293 app/
```

---

## 📝 Frontend - Auto-Fix ESLint (5-10 minutes)

```bash
cd services/frontend

# Auto-fix what's possible
npm run lint -- --fix

# Remaining manual fixes needed:
# 1. Replace 'any' types with proper TypeScript types
# 2. Add missing dependencies to useEffect hooks
# 3. Remove unused variables
```

### Common Type Replacements

```typescript
// ❌ Bad
const data: any = response.data;

// ✅ Good - Create proper interface
interface ResponseData {
  id: string;
  name: string;
  // ... other fields
}
const data: ResponseData = response.data;
```

### Fix React Hook Dependencies

```typescript
// ❌ Bad
useEffect(() => {
  loadUser();
}, []);

// ✅ Good
useEffect(() => {
  loadUser();
}, [loadUser]); // Add dependency

// Or use useCallback
const loadUser = useCallback(() => {
  // ... implementation
}, []);
```

---

## 🐚 Shell Scripts - Auto-Fix (5 minutes)

```bash
# Install shellcheck
sudo apt-get install shellcheck  # Ubuntu/Debian
# or
brew install shellcheck  # macOS

# Check all scripts
shellcheck scripts/*.sh

# Auto-fix with shellcheck's diff output
shellcheck -f diff scripts/*.sh | patch

# Manual fixes for remaining issues:
# 1. Quote all variables: $VAR -> "$VAR"
# 2. Replace 'cat file | cmd' with 'cmd < file'
# 3. Replace '[ $? -eq 0 ]' with 'if command; then'
```

---

## 📋 GitHub Actions - Fix YAML (5 minutes)

```bash
# Install yamllint
pip install yamllint

# Check workflow
yamllint .github/workflows/ci-cd.yml

# Fix common issues:
# 1. Remove trailing spaces
# 2. Break long lines
# 3. Add --- at start of file
```

### Auto-remove Trailing Spaces

```bash
# Remove trailing spaces from GitHub Actions
sed -i 's/[[:space:]]*$//' .github/workflows/ci-cd.yml
```

---

## 🧪 Auth-Billing - Fix Redis Tests (15 minutes)

### Option 1: Use Redis Mock

```bash
cd services/auth-billing
npm install --save-dev redis-mock

# Update test file to use redis-mock when Redis unavailable
```

### Option 2: Use Docker for Tests

```bash
# Start Redis for tests
docker run -d -p 6379:6379 redis:7-alpine

# Run tests
npm test

# Stop Redis
docker stop $(docker ps -q --filter ancestor=redis:7-alpine)
```

### Option 3: Skip Redis Tests in CI (Quick Fix)

```typescript
// In test file, add conditional skip
if (!process.env.REDIS_URL) {
  it.skip('Redis tests', () => {});
}
```

---

## 🎨 VSCode Extension - Fix Naming (Optional)

The snake_case properties may be required by backend API. Verify before changing.

If safe to change:

```typescript
// Before
interface Memory {
  confidence_score: number;
  created_at: string;
}

// After
interface Memory {
  confidenceScore: number;
  createdAt: string;
}

// Update API calls to transform data
const transformMemory = (apiData: any): Memory => ({
  confidenceScore: apiData.confidence_score,
  createdAt: apiData.created_at,
});
```

---

## 📦 Update Deprecated Packages

### Gateway

```bash
cd services/gateway
npm update glob
npm install lru-cache  # Replace inflight if used
```

### Auth-Billing

```bash
cd services/auth-billing
npm update glob rimraf
npm install supertest@latest superagent@latest
```

### VSCode Extension

```bash
cd vscode-extension
npm update glob rimraf
npm install @eslint/object-schema @eslint/config-array
npm install eslint@9
```

---

## 🔍 Verification Commands

Run these after fixes to verify:

```bash
# Python Services
cd services/intelligence
python3 -m flake8 app/ --count
python3 -m black --check app/
python3 -m isort --check-only app/
python3 -m mypy app/ --ignore-missing-imports

# TypeScript Services
cd services/frontend
npm run lint
npm run build
npm test  # if tests exist

# Shell Scripts
shellcheck scripts/*.sh

# YAML
yamllint .github/workflows/

# Security
npm audit  # in each Node service
```

---

## 📊 Progress Tracking

Use this checklist to track fixes:

```markdown
## Critical Fixes
- [ ] Frontend: npm audit fix
- [ ] Auth-Billing: npm audit fix --force
- [ ] Memory: Fix Python dependency
- [ ] Intelligence: Fix syntax error in metrics.py

## High Priority
- [ ] Intelligence: Black formatting (14 files)
- [ ] Intelligence: isort imports (13 files)
- [ ] Intelligence: Remove unused imports
- [ ] Noble-Spirit: Black formatting
- [ ] Frontend: Fix ESLint errors (33)
- [ ] Auth-Billing: Fix Redis tests (9)
- [ ] GitHub Actions: Fix YAML issues
- [ ] Shell Scripts: Fix shellcheck warnings

## Medium Priority
- [ ] Update deprecated packages
- [ ] Fix Jest configuration (Gateway)
- [ ] Add missing tests (Frontend, MCP Server)
- [ ] Bundle size optimization
- [ ] VSCode Extension: Naming conventions

## Low Priority
- [ ] Documentation improvements
- [ ] Pre-commit hooks setup
- [ ] Code coverage thresholds
```

---

## 🆘 If Something Breaks

### Rollback Commands

```bash
# Undo uncommitted changes
git checkout -- .

# Undo last commit
git reset --soft HEAD~1

# Restore specific file
git checkout HEAD -- path/to/file
```

### Test in Isolation

```bash
# Create test branch
git checkout -b test-fixes

# Make changes, test, then merge if successful
git checkout main
git merge test-fixes
```

---

## 📞 Need Help?

1. Check DETAILED_ISSUES_APPENDIX.md for specific error details
2. Check PROJECT_ISSUES_REPORT.md for context and impact
3. Review existing tests for patterns
4. Test changes in isolation before committing

---

**Remember:** 
- Fix critical security issues first
- Test after each fix
- Commit frequently with clear messages
- Document any manual changes needed

**Estimated Time:**
- Critical fixes: 15-30 minutes
- High priority: 2-4 hours
- Medium priority: 4-8 hours
- Low priority: 8-16 hours
- **Total:** 1-2 days for one developer
