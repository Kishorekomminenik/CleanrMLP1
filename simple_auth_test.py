#!/usr/bin/env python3
"""
Simple Auth Token Test - Debug version
"""

import requests
import json
import uuid

BASE_URL = "https://shine-app-debug.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_auth_endpoint():
    print("=== TESTING AUTH TOKEN VERIFICATION ===\n")
    
    # Test 1: No Authorization header
    print("1. Testing GET /auth/me with no Authorization header:")
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=HEADERS, timeout=10)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        if response.status_code in [401, 403]:
            print("   ✅ PASS: Properly rejected unauthorized request")
        else:
            print("   ❌ FAIL: Should have returned 401/403")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    print()
    
    # Test 2: Invalid token
    print("2. Testing GET /auth/me with invalid token:")
    try:
        headers = HEADERS.copy()
        headers["Authorization"] = "Bearer invalid_token_123"
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        if response.status_code in [401, 403]:
            print("   ✅ PASS: Properly rejected invalid token")
        else:
            print("   ❌ FAIL: Should have returned 401/403")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    print()
    
    # Test 3: Create account and get valid token
    print("3. Creating test account:")
    test_email = f"auth_test_{uuid.uuid4().hex[:8]}@example.com"
    signup_data = {
        "email": test_email,
        "username": f"auth_test_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS, timeout=10)
        print(f"   Signup Status: {response.status_code}")
        
        if response.status_code == 200:
            resp_data = response.json()
            token = resp_data.get("token")
            print(f"   ✅ Account created: {test_email}")
            print(f"   Token received: {token[:20]}..." if token else "No token")
            
            # Test 4: Valid token
            print("\n4. Testing GET /auth/me with valid token:")
            headers = HEADERS.copy()
            headers["Authorization"] = f"Bearer {token}"
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"   ✅ PASS: Valid token returned user data")
                print(f"   User: {user_data.get('email')}, Role: {user_data.get('role')}")
                
                # Verify required fields
                required_fields = ["id", "email", "role", "mfa_enabled"]
                missing = [f for f in required_fields if f not in user_data]
                if missing:
                    print(f"   ⚠️  WARNING: Missing fields: {missing}")
                else:
                    print(f"   ✅ All required fields present")
            else:
                print(f"   ❌ FAIL: Valid token rejected. Response: {response.text[:200]}")
        else:
            print(f"   ❌ FAIL: Account creation failed. Response: {response.text[:200]}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_auth_endpoint()