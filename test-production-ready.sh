#!/bin/bash

# ========================================
# Production Build Test Script
# Tests if the application is ready for deployment
# ========================================

echo "🧪 Testing SAS Application - Production Readiness"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to print test result
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

# Change to backend directory
cd "$(dirname "$0")/backend" || exit 1

echo "📋 Test 1: Checking Required Files"
echo "-----------------------------------"

# Check if critical files exist
if [ -f "server.js" ]; then
    test_result 0 "server.js exists"
else
    test_result 1 "server.js missing"
fi

if [ -f "package.json" ]; then
    test_result 0 "package.json exists"
else
    test_result 1 "package.json missing"
fi
[ -f ".env.example" ] && test_result 0 ".env.example exists" || test_result 1 ".env.example missing"
[ -f ".env" ] && test_result 0 ".env exists" || test_result 1 ".env missing (required for testing)"
[ -f "../render.yaml" ] && test_result 0 "render.yaml exists" || test_result 1 "render.yaml missing"
[ -f "routes/health.js" ] && test_result 0 "health.js route exists" || test_result 1 "health.js route missing"

echo ""
echo "📋 Test 2: Checking Upload Directories"
echo "---------------------------------------"

[ -d "uploads" ] && test_result 0 "uploads directory exists" || test_result 1 "uploads directory missing"
[ -f "uploads/.gitkeep" ] && test_result 0 "uploads/.gitkeep exists" || test_result 1 "uploads/.gitkeep missing"
[ -f "uploads/photos/.gitkeep" ] && test_result 0 "uploads/photos/.gitkeep exists" || test_result 1 "uploads/photos/.gitkeep missing"
[ -f "uploads/videos/.gitkeep" ] && test_result 0 "uploads/videos/.gitkeep exists" || test_result 1 "uploads/videos/.gitkeep missing"
[ -f "uploads/docs/.gitkeep" ] && test_result 0 "uploads/docs/.gitkeep exists" || test_result 1 "uploads/docs/.gitkeep missing"

echo ""
echo "📋 Test 3: Checking Dependencies"
echo "---------------------------------"

if npm list compression --depth=0 &>/dev/null; then
    test_result 0 "compression package installed"
else
    test_result 1 "compression package missing"
fi

if npm list express --depth=0 &>/dev/null; then
    test_result 0 "express package installed"
else
    test_result 1 "express package missing"
fi

if npm list mongoose --depth=0 &>/dev/null; then
    test_result 0 "mongoose package installed"
else
    test_result 1 "mongoose package missing"
fi

echo ""
echo "📋 Test 4: Environment Variables"
echo "---------------------------------"

# Source .env file and check variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    
    [ ! -z "$MONGODB_URI" ] && test_result 0 "MONGODB_URI is set" || test_result 1 "MONGODB_URI not set"
    [ ! -z "$JWT_SECRET" ] && test_result 0 "JWT_SECRET is set" || test_result 1 "JWT_SECRET not set"
    [ ! -z "$PORT" ] && test_result 0 "PORT is set" || test_result 1 "PORT not set"
    
    # Check JWT_SECRET length
    if [ ${#JWT_SECRET} -ge 32 ]; then
        test_result 0 "JWT_SECRET is secure (${#JWT_SECRET} chars)"
    else
        test_result 1 "JWT_SECRET too short (${#JWT_SECRET} chars, need 32+)"
    fi
else
    test_result 1 ".env file not found"
fi

echo ""
echo "📋 Test 5: Server Configuration"
echo "--------------------------------"

# Check if server binds to 0.0.0.0
if grep -q "app.listen(PORT, '0.0.0.0'" server.js; then
    test_result 0 "Server binds to 0.0.0.0"
else
    test_result 1 "Server doesn't bind to 0.0.0.0"
fi

# Check if compression is used
if grep -q "compression()" server.js; then
    test_result 0 "Compression middleware enabled"
else
    test_result 1 "Compression middleware not enabled"
fi

# Check if health routes are registered
if grep -q "/api/health" server.js; then
    test_result 0 "Health routes registered"
else
    test_result 1 "Health routes not registered"
fi

echo ""
echo "📋 Test 6: Live Server Tests"
echo "-----------------------------"

# Check if server is running
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    test_result 0 "Server is running on port 5001"
    
    # Test health endpoint
    HEALTH_STATUS=$(curl -s http://localhost:5001/api/health | jq -r '.status' 2>/dev/null)
    if [ "$HEALTH_STATUS" = "ok" ]; then
        test_result 0 "Health endpoint returns 'ok'"
    else
        test_result 1 "Health endpoint not responding correctly"
    fi
    
    # Test database connection
    DB_STATUS=$(curl -s http://localhost:5001/api/health/db | jq -r '.status' 2>/dev/null)
    if [ "$DB_STATUS" = "ok" ]; then
        test_result 0 "Database connection is healthy"
    else
        test_result 1 "Database connection issue"
    fi
    
    # Test frontend serving
    if curl -s -I http://localhost:5001/ | grep -q "200 OK"; then
        test_result 0 "Frontend is being served"
    else
        test_result 1 "Frontend not being served correctly"
    fi
    
else
    test_result 1 "Server not running on port 5001"
    echo -e "${YELLOW}⚠️  Note: Start the server with 'npm run dev' to run live tests${NC}"
fi

echo ""
echo "📋 Test 7: Frontend Configuration"
echo "----------------------------------"

# Check if API URL is dynamic
if grep -q "window.location.origin" ../frontend/js/config.js; then
    test_result 0 "API URL is dynamic (production-ready)"
else
    test_result 1 "API URL might be hardcoded"
fi

echo ""
echo "=================================================="
echo "📊 Test Results Summary"
echo "=================================================="
echo -e "✅ Passed: ${GREEN}${PASSED}${NC}"
echo -e "❌ Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Application is ready for deployment!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please fix the issues before deploying.${NC}"
    exit 1
fi
