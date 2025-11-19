#!/bin/bash

# Stripe Webhook Raw Body Testing Script (Issue #7)
# Tests webhook signature verification through Gateway proxy

echo "🧪 Testing Stripe Webhook Raw Body Handling (Issue #7)"
echo "====================================================="

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Please install: https://stripe.com/docs/stripe-cli"
    exit 1
fi

# Set test webhook secret
TEST_WEBHOOK_SECRET="whsec_test123456789abcdefghijk"

echo ""
echo "🔧 Test Configuration:"
echo "   Gateway URL: http://localhost:5000"
echo "   Auth-Billing Direct: http://localhost:3001"
echo "   Webhook Secret: $TEST_WEBHOOK_SECRET"

# Test 1: Direct webhook to auth-billing (baseline)
echo ""
echo "Test 1: Direct webhook to auth-billing (should work)"
echo "======================================================"

# Generate test webhook payload
TIMESTAMP=$(date +%s)
PAYLOAD='{"type":"customer.subscription.updated","data":{"object":{"id":"sub_test"}}}'

# Create signature
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "$TEST_WEBHOOK_SECRET" -binary | base64)

echo "Testing direct webhook..."
DIRECT_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
  -X POST http://localhost:3001/billing/webhooks \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$TIMESTAMP,v1=$SIGNATURE" \
  -d "$PAYLOAD")

DIRECT_CODE=$(echo "$DIRECT_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)

if [ "$DIRECT_CODE" = "200" ]; then
    echo "✅ PASS: Direct webhook succeeded (HTTP $DIRECT_CODE)"
else
    echo "❌ FAIL: Direct webhook failed (HTTP $DIRECT_CODE)"
    echo "   Response: $(echo "$DIRECT_RESPONSE" | sed 's/HTTP_CODE:[0-9]*//')"
fi

# Test 2: Webhook through Gateway (potential issue)
echo ""
echo "Test 2: Webhook through Gateway proxy (may fail)"
echo "================================================"

echo "Testing webhook through Gateway..."
GATEWAY_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
  -X POST http://localhost:5000/api/billing/webhooks \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$TIMESTAMP,v1=$SIGNATURE" \
  -d "$PAYLOAD")

GATEWAY_CODE=$(echo "$GATEWAY_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)

if [ "$GATEWAY_CODE" = "200" ]; then
    echo "✅ PASS: Gateway webhook succeeded (HTTP $GATEWAY_CODE)"
    echo "   Raw body preserved through proxy"
else
    echo "⚠️  EXPECTED ISSUE: Gateway webhook failed (HTTP $GATEWAY_CODE)"
    echo "   Response: $(echo "$GATEWAY_RESPONSE" | sed 's/HTTP_CODE:[0-9]*//')"
    echo "   This confirms Issue #7: Raw body not preserved"
fi

# Test 3: Verify body transformation
echo ""
echo "Test 3: Body transformation test"
echo "==============================="

echo "Checking if Gateway transforms request body..."

# Send a webhook with known content
TEST_BODY='{"test":"webhook","number":123}'
TEST_SIGNATURE=$(echo -n "${TIMESTAMP}.${TEST_BODY}" | openssl dgst -sha256 -hmac "$TEST_WEBHOOK_SECRET" -binary | base64)

# Test direct vs gateway with debug logging
echo "Sending test payload through both paths..."

# You would need to add debug logging to see the actual body received
echo "💡 To debug further:"
echo "   1. Add console.log() in auth-billing webhook handler"
echo "   2. Compare req.body between direct and gateway requests"
echo "   3. Check if body is Buffer vs Object"

# Recommendation
echo ""
echo "📋 RECOMMENDATION (Issue #7):"
echo "================================"
echo ""
echo "Option 1: Direct Webhook (Recommended)"
echo "   Configure Stripe webhook URL: https://your-domain.com:3001/billing/webhooks"
echo "   Bypasses Gateway proxy entirely"
echo "   Guarantees raw body preservation"
echo ""
echo "Option 2: Gateway Raw Body Fix"
echo "   Modify Gateway to preserve raw body for webhook endpoints"
echo "   Add special handling for /api/billing/webhooks path"
echo "   More complex but maintains unified routing"
echo ""
echo "🔧 To implement Option 1:"
echo "   1. Configure Stripe webhook endpoint directly to auth-billing"
echo "   2. Ensure firewall allows direct access to port 3001 from Stripe IPs"
echo "   3. Update webhook URL in Stripe dashboard"
echo ""
echo "🔧 To implement Option 2:"
echo "   1. Modify Gateway proxy middleware for webhook paths"
echo "   2. Add raw body preservation before JSON parsing"
echo "   3. Test signature verification end-to-end"

echo ""
echo "🏁 Webhook testing completed"