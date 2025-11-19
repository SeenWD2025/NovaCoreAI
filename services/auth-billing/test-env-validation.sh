#!/bin/bash

# Environment Variable Validation Test Script
# Tests that auth-billing service validates environment variables correctly

echo "🧪 Testing Environment Variable Validation (Issue #9)"
echo "=================================================="

# Save original environment
ORIGINAL_JWT_SECRET="$JWT_SECRET"
ORIGINAL_NODE_ENV="$NODE_ENV"

# Test 1: Missing required variables
echo ""
echo "Test 1: Missing JWT_SECRET"
unset JWT_SECRET
echo "Expected: Service should fail to start"

if timeout 10s npm run start:dev 2>&1 | grep -q "Missing environment variables: JWT_SECRET"; then
    echo "✅ PASS: Correctly detected missing JWT_SECRET"
else
    echo "❌ FAIL: Did not detect missing JWT_SECRET"
fi

# Test 2: Default values in production
echo ""
echo "Test 2: Default value in production"
export NODE_ENV=production
export JWT_SECRET="your-secret-key-change-in-production"
echo "Expected: Service should fail with default value warning"

if timeout 10s npm run start:dev 2>&1 | grep -q "using default value"; then
    echo "✅ PASS: Correctly detected default value"
else
    echo "❌ FAIL: Did not detect default value"
fi

# Test 3: Short secret in production
echo ""
echo "Test 3: Short secret in production"
export JWT_SECRET="short"
echo "Expected: Service should fail with short secret error"

if timeout 10s npm run start:dev 2>&1 | grep -q "must be at least 32 characters"; then
    echo "✅ PASS: Correctly detected short secret"
else
    echo "❌ FAIL: Did not detect short secret"
fi

# Test 4: Valid configuration
echo ""
echo "Test 4: Valid configuration"
export NODE_ENV=development
export JWT_SECRET="this-is-a-valid-long-secret-key-for-testing-purposes-32-chars"
export JWT_REFRESH_SECRET="this-is-a-valid-refresh-secret-key-for-testing-purposes-32"
export SERVICE_JWT_SECRET="this-is-a-valid-service-secret-key-for-testing-purposes-32"
export DATABASE_URL="postgresql://test:test@localhost:5432/test"

echo "Expected: Service should start successfully"

if timeout 15s npm run start:dev 2>&1 | grep -q "Environment variables validated"; then
    echo "✅ PASS: Service started with valid configuration"
else
    echo "❌ FAIL: Service failed to start with valid configuration"
fi

# Restore original environment
export JWT_SECRET="$ORIGINAL_JWT_SECRET"
export NODE_ENV="$ORIGINAL_NODE_ENV"

echo ""
echo "🏁 Environment validation tests completed"
echo ""
echo "💡 To run manually:"
echo "   cd services/auth-billing"
echo "   chmod +x test-env-validation.sh"
echo "   ./test-env-validation.sh"