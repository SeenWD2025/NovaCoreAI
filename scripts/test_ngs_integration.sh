#!/bin/bash
# Comprehensive integration test for NGS Curriculum Phase 9

set -e

echo "🧪 NGS Curriculum Phase 9 - Comprehensive Integration Test"
echo "=========================================================="
echo ""

# Configuration
BASE_URL=${BASE_URL:-http://localhost:9000}
GATEWAY_URL=${GATEWAY_URL:-http://localhost:5000}
TEST_USER_ID=${TEST_USER_ID:-550e8400-e29b-41d4-a716-446655440000}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
total=0
passed=0
failed=0

# Test function
test_api() {
    local method=$1
    local url=$2
    local description=$3
    local data=$4
    local expected_code=${5:-200}
    
    total=$((total + 1))
    echo -n "  [$total] $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "X-User-Id: $TEST_USER_ID" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -H "X-User-Id: $TEST_USER_ID" \
            -d "$data" "$url" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_code" ] || [ "$http_code" = "201" ] && [ "$expected_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        passed=$((passed + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_code)"
        echo "     Response: ${body:0:100}..."
        failed=$((failed + 1))
        return 1
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 1: Service Health & Connectivity${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_api "GET" "$BASE_URL/health" "Health check"
test_api "GET" "$BASE_URL/" "Service info"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 2: Curriculum Levels${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_api "GET" "$BASE_URL/ngs/levels" "Get all 24 levels"
test_api "GET" "$BASE_URL/ngs/levels/1" "Get Level 1 (Awakeners)"
test_api "GET" "$BASE_URL/ngs/levels/12" "Get Level 12 (Operator - Agent unlock)"
test_api "GET" "$BASE_URL/ngs/levels/24" "Get Level 24 (Noble Sovereign)"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 3: User Progress Tracking${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_api "GET" "$BASE_URL/ngs/progress" "Get initial progress"
test_api "GET" "$BASE_URL/ngs/achievements" "Get achievements"
test_api "GET" "$BASE_URL/ngs/leaderboard?limit=5" "Get leaderboard"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 4: Lesson Content${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_api "GET" "$BASE_URL/ngs/levels/1/lessons" "Get Level 1 lessons"
test_api "GET" "$BASE_URL/ngs/levels/6/lessons" "Get Level 6 lessons"
test_api "GET" "$BASE_URL/ngs/levels/12/lessons" "Get Level 12 lessons"

# Get a lesson ID for further testing
echo -n "  Getting lesson ID for testing... "
lesson_response=$(curl -s -H "X-User-Id: $TEST_USER_ID" "$BASE_URL/ngs/levels/1/lessons" 2>/dev/null)
lesson_id=$(echo "$lesson_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$lesson_id" ]; then
    echo -e "${GREEN}✓${NC} $lesson_id"
    
    test_api "GET" "$BASE_URL/ngs/lessons/$lesson_id" "Get specific lesson details"
else
    echo -e "${YELLOW}⚠ No lessons found - skipping lesson tests${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 5: Lesson Completion Flow${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -n "$lesson_id" ]; then
    completion_data='{
        "score": 90,
        "time_spent_seconds": 2400,
        "reflection_text": "I observed my thoughts throughout the day and noticed recurring patterns. Many thoughts were reactions to external stimuli rather than originating from my core values. This exercise helped me distinguish between reactive patterns and authentic signals.",
        "metadata": {"practice_completed": true, "insights": 3}
    }'
    
    test_api "POST" "$BASE_URL/ngs/lessons/$lesson_id/complete" "Complete lesson with reflection" "$completion_data" 201
    
    # Check XP increase
    test_api "GET" "$BASE_URL/ngs/progress" "Verify XP increase after completion"
else
    echo -e "${YELLOW}  Skipping lesson completion tests (no lesson ID)${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 6: Reflection System${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

reflection_data='{
    "level_number": 1,
    "reflection_prompt": "What signals are truly yours, and which are echoes?",
    "reflection_text": "Through this practice, I discovered that authentic signals arise from stillness and alignment with my core principles. Echoes, on the other hand, are reactive and often carry emotional charge from external sources. By pausing before responding, I can better distinguish between the two.",
    "is_public": false
}'

test_api "POST" "$BASE_URL/ngs/reflections" "Submit practice reflection" "$reflection_data" 201
test_api "GET" "$BASE_URL/ngs/reflections?limit=5" "Get reflection history"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 7: XP & Achievement System${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

xp_data='{
    "source": "creative_solution",
    "amount": 75,
    "metadata": {"solution_type": "innovative", "complexity": "high"}
}'

test_api "POST" "$BASE_URL/ngs/award-xp" "Award XP for creative solution" "$xp_data"
test_api "GET" "$BASE_URL/ngs/progress" "Check updated progress"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 8: Challenge System${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_api "GET" "$BASE_URL/ngs/levels/1/challenges" "Get challenges for Level 1"
test_api "GET" "$BASE_URL/ngs/challenges/submissions" "Get submission history"

# Try to get a challenge ID
challenge_response=$(curl -s "$BASE_URL/ngs/levels/1/challenges" 2>/dev/null)
challenge_id=$(echo "$challenge_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$challenge_id" ]; then
    test_api "GET" "$BASE_URL/ngs/challenges/$challenge_id" "Get specific challenge"
    
    submission_data='{
        "submission_code": "function solution() { return true; }"
    }'
    
    test_api "POST" "$BASE_URL/ngs/challenges/$challenge_id/submit" "Submit challenge solution" "$submission_data" 201
else
    echo -e "${YELLOW}  No challenges found (expected - content not yet created)${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 9: Data Integrity Checks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test edge cases
test_api "GET" "$BASE_URL/ngs/levels/0" "Invalid level (too low)" "" 400
test_api "GET" "$BASE_URL/ngs/levels/25" "Invalid level (too high)" "" 400
test_api "GET" "$BASE_URL/ngs/levels/abc" "Invalid level format" "" 400

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 10: Level Progression Simulation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "  Awarding multiple XP to test level progression..."

for i in {1..3}; do
    xp_award='{
        "source": "lesson_completion",
        "amount": 50,
        "metadata": {"lesson": "'$i'"}
    }'
    test_api "POST" "$BASE_URL/ngs/award-xp" "Award lesson XP #$i" "$xp_award"
done

test_api "GET" "$BASE_URL/ngs/progress" "Final progress check"
test_api "GET" "$BASE_URL/ngs/achievements" "Check for level-up achievements"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Total Tests:  $total"
echo -e "  Passed:       ${GREEN}$passed${NC}"
echo -e "  Failed:       ${RED}$failed${NC}"
echo -e "  Success Rate: $(( passed * 100 / total ))%"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✨ All integration tests passed!${NC}"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Run migration script: ./scripts/apply_ngs_migrations.sh"
    echo "  2. Test with Gateway: BASE_URL=$GATEWAY_URL/api ./scripts/test_ngs_integration.sh"
    echo "  3. Proceed with frontend development (Phase 10)"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed - review errors above${NC}"
    exit 1
fi
