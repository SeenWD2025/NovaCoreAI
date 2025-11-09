#!/bin/bash
# Test script for NGS Curriculum endpoints

set -e

# Configuration
BASE_URL=${BASE_URL:-http://localhost:9000}
TEST_USER_ID=${TEST_USER_ID:-550e8400-e29b-41d4-a716-446655440000}

echo "🧪 Testing NGS Curriculum Endpoints"
echo "Base URL: $BASE_URL"
echo "Test User ID: $TEST_USER_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -n "Testing: $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "X-User-Id: $TEST_USER_ID" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -H "X-User-Id: $TEST_USER_ID" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Track results
total=0
passed=0
failed=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Service Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "GET" "/health" "Health check"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

test_endpoint "GET" "/" "Service info"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Progress & Levels"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "GET" "/ngs/progress" "Get user progress"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

test_endpoint "GET" "/ngs/levels" "Get all curriculum levels"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

test_endpoint "GET" "/ngs/levels/1" "Get level 1 details"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Lessons"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "GET" "/ngs/levels/1/lessons" "Get lessons for level 1"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

# Get a lesson ID for testing (this is just a test, will fail if no lessons)
echo -n "Getting lesson ID for testing... "
lesson_response=$(curl -s -H "X-User-Id: $TEST_USER_ID" "$BASE_URL/ngs/levels/1/lessons")
lesson_id=$(echo "$lesson_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$lesson_id" ]; then
    echo -e "${GREEN}✓${NC} Got lesson ID: ${lesson_id:0:8}..."
    
    test_endpoint "GET" "/ngs/lessons/$lesson_id" "Get specific lesson"
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))
    
    # Test lesson completion
    completion_data='{
        "score": 85,
        "time_spent_seconds": 2700,
        "reflection_text": "This is a test reflection about awakening to signals and understanding the Noble Core Principles.",
        "metadata": {"test": true}
    }'
    
    test_endpoint "POST" "/ngs/lessons/$lesson_id/complete" "Complete lesson" "$completion_data"
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))
else
    echo -e "${YELLOW}⚠${NC} No lessons found (database might not be populated)"
    echo "   Skipping lesson-specific tests"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Reflections"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Submit a reflection
reflection_data='{
    "level_number": 1,
    "reflection_prompt": "What signals are truly yours, and which are echoes?",
    "reflection_text": "After observing my thoughts today, I noticed that many reactions are automatic responses to external stimuli rather than genuine internal signals. I am learning to distinguish between reactive patterns and authentic intentions.",
    "is_public": false
}'

test_endpoint "POST" "/ngs/reflections" "Submit reflection" "$reflection_data"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

test_endpoint "GET" "/ngs/reflections?limit=10" "Get user reflections"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  XP & Achievements"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Award XP
xp_data='{
    "source": "creative_solution",
    "amount": 75,
    "metadata": {"test": "testing XP award"}
}'

test_endpoint "POST" "/ngs/award-xp" "Award XP" "$xp_data"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

test_endpoint "GET" "/ngs/achievements" "Get achievements"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

test_endpoint "GET" "/ngs/leaderboard?limit=10" "Get leaderboard"
total=$((total + 1))
[ $? -eq 0 ] && passed=$((passed + 1)) || failed=$((failed + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests: $total"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"

if [ $failed -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✨ All tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi
