#!/bin/bash
set -e

API_BASE="http://localhost:8001/api"
PASS="Passw0rd!"
NEW_PASS="NewPassw0rd!"

echo "=== SHINE Backend Auth Validation ==="
echo "API Base: $API_BASE"
echo "=============================================="

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    
    if [[ "$actual" == *"$expected"* ]]; then
        echo "✅ PASS: $test_name"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL: $test_name (Expected: $expected, Got: $actual)"
        ((TESTS_FAILED++))
    fi
}

echo ""
echo "=== S1: Customer Signup & Login ==="
EMAIL_C="e2e+cust.$(date +%s)@example.com"
echo "Customer Email: $EMAIL_C"

# Customer Signup
echo "1. Customer Signup"
SIGNUP_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_C}\",\"password\":\"${PASS}\",\"role\":\"customer\"}")
echo "$SIGNUP_RESPONSE"

CUSTOMER_ROLE=$(echo "$SIGNUP_RESPONSE" | jq -r '.user.role // "missing"')
test_result "Customer role assignment" "customer" "$CUSTOMER_ROLE"

CUSTOMER_MFA=$(echo "$SIGNUP_RESPONSE" | jq -r '.user.mfa_enabled // "missing"')
test_result "Customer MFA disabled" "false" "$CUSTOMER_MFA"

# Customer Login
echo ""
echo "2. Customer Login"
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_C}\",\"password\":\"${PASS}\"}")
LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // "missing"')
test_result "Customer login token" "eyJ" "$LOGIN_TOKEN"

# Duplicate signup
echo ""
echo "3. Duplicate Signup Test"
DUPLICATE_STATUS=$(curl -i -s -X POST "${API_BASE}/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_C}\",\"password\":\"${PASS}\",\"role\":\"customer\"}" | head -n 1)
test_result "Duplicate email rejection" "400" "$DUPLICATE_STATUS"

echo ""
echo "=== S2: Partner Signup & Login ==="
EMAIL_P="e2e+partner.$(date +%s)@example.com"
echo "Partner Email: $EMAIL_P"

# Partner Signup
echo "1. Partner Signup"
PARTNER_SIGNUP=$(curl -s -X POST "${API_BASE}/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_P}\",\"password\":\"${PASS}\",\"role\":\"partner\"}")
echo "$PARTNER_SIGNUP"

PARTNER_STATUS=$(echo "$PARTNER_SIGNUP" | jq -r '.user.partner_status // "missing"')
test_result "Partner pending status" "pending" "$PARTNER_STATUS"

# Partner Login
echo ""
echo "2. Partner Login"
PARTNER_TOKEN=$(curl -s -X POST "${API_BASE}/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_P}\",\"password\":\"${PASS}\"}" | jq -r '.access_token // "missing"')
test_result "Partner login token" "eyJ" "$PARTNER_TOKEN"

echo ""
echo "=== S3: Owner Signup & MFA ==="
EMAIL_O="e2e+owner.$(date +%s)@example.com"
echo "Owner Email: $EMAIL_O"

# Owner Signup
echo "1. Owner Signup"
OWNER_SIGNUP=$(curl -s -X POST "${API_BASE}/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_O}\",\"password\":\"${PASS}\",\"role\":\"owner\"}")
echo "$OWNER_SIGNUP"

OWNER_MFA=$(echo "$OWNER_SIGNUP" | jq -r '.user.mfa_enabled // "missing"')
test_result "Owner MFA enabled" "true" "$OWNER_MFA"

# Owner Login (should require MFA)
echo ""
echo "2. Owner Login (MFA Required)"
OWNER_LOGIN=$(curl -s -X POST "${API_BASE}/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_O}\",\"password\":\"${PASS}\"}")
echo "$OWNER_LOGIN"

MFA_REQUIRED=$(echo "$OWNER_LOGIN" | jq -r '.mfa_required // "missing"')
test_result "Owner MFA required" "true" "$MFA_REQUIRED"

DEV_MFA_CODE=$(echo "$OWNER_LOGIN" | jq -r '.dev_mfa_code // "missing"')
echo "Dev MFA Code: $DEV_MFA_CODE"

# MFA Verification
echo ""
echo "3. MFA Verification"
MFA_VERIFY=$(curl -s -X POST "${API_BASE}/auth/mfa" -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL_O}\",\"mfa_code\":\"${DEV_MFA_CODE}\"}")
echo "$MFA_VERIFY"

MFA_TOKEN=$(echo "$MFA_VERIFY" | jq -r '.access_token // "missing"')
test_result "MFA verification token" "eyJ" "$MFA_TOKEN"

echo ""
echo "=== S4: Invalid Login Test ==="
INVALID_LOGIN=$(curl -i -s -X POST "${API_BASE}/auth/login" -H "Content-Type: application/json" -d '{"email":"nobody@example.com","password":"wrong"}' | head -n 1)
test_result "Invalid login rejection" "401" "$INVALID_LOGIN"

echo ""
echo "=== S5: Protected Endpoint Test ==="
# Test /auth/me with customer token
ME_RESPONSE=$(curl -s -X GET "${API_BASE}/auth/me" -H "Authorization: Bearer $LOGIN_TOKEN")
ME_EMAIL=$(echo "$ME_RESPONSE" | jq -r '.email // "missing"')
test_result "Get current user" "$EMAIL_C" "$ME_EMAIL"

# Test invalid token
INVALID_ME=$(curl -i -s -X GET "${API_BASE}/auth/me" -H "Authorization: Bearer invalid_token" | head -n 1)
test_result "Invalid token rejection" "401" "$INVALID_ME"

echo ""
echo "=== S6: Role Switch Test ==="
# Partner switches to customer
SWITCH_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/switch-role" -H "Authorization: Bearer $PARTNER_TOKEN")
echo "$SWITCH_RESPONSE"

SWITCHED_ROLE=$(echo "$SWITCH_RESPONSE" | jq -r '.user.role // "missing"')
test_result "Partner role switch" "customer" "$SWITCHED_ROLE"

# Customer tries to switch (should fail)
CUSTOMER_SWITCH=$(curl -i -s -X POST "${API_BASE}/auth/switch-role" -H "Authorization: Bearer $LOGIN_TOKEN" | head -n 1)
test_result "Customer switch rejection" "403" "$CUSTOMER_SWITCH"

echo ""
echo "=============================================="
echo "=== VALIDATION SUMMARY ==="
echo "=============================================="
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo "Success Rate: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✅ ALL TESTS PASSED - Backend authentication system is fully functional!"
else
    echo "❌ Some tests failed - Review the failures above"
fi