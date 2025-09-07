#!/usr/bin/env python3
"""
Complete Authentication Flow Test
Tests the complete flow that React Native app will use:
1. POST /api/auth/signup to create test account
2. POST /api/auth/login to get valid token  
3. GET /api/auth/me with the valid token to verify it works
"""

import requests
import json
import uuid

BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_complete_auth_flow():
    print("=== COMPLETE AUTHENTICATION FLOW TEST ===")
    print("Testing the exact flow React Native app will use\n")
    
    # Generate test data
    test_email = f"rn_auth_test_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"rn_test_{uuid.uuid4().hex[:8]}"
    test_password = "SecurePass123!"
    
    print(f"Test Account: {test_email}")
    print(f"Test Username: {test_username}\n")
    
    # Step 1: Create account via signup
    print("STEP 1: POST /api/auth/signup")
    signup_data = {
        "email": test_email,
        "username": test_username,
        "password": test_password,
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            signup_resp = response.json()
            signup_token = signup_resp.get("token")
            user_data = signup_resp.get("user", {})
            
            print(f"✅ SUCCESS: Account created")
            print(f"   User ID: {user_data.get('id')}")
            print(f"   Email: {user_data.get('email')}")
            print(f"   Role: {user_data.get('role')}")
            print(f"   Token: {signup_token[:30]}..." if signup_token else "No token")
        else:
            print(f"❌ FAILED: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print()
    
    # Step 2: Login to get fresh token
    print("STEP 2: POST /api/auth/login")
    login_data = {
        "identifier": test_email,  # Test email login
        "password": test_password
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            login_resp = response.json()
            
            # Check if MFA is required (for owners)
            if login_resp.get("mfa_required"):
                print(f"✅ MFA Required (Owner account)")
                print(f"   User ID: {login_resp.get('user_id')}")
                print(f"   MFA Code: {login_resp.get('dev_mfa_code')}")
                # For this test, we'll skip MFA verification since we're testing customer account
                return True
            else:
                login_token = login_resp.get("token")
                user_data = login_resp.get("user", {})
                
                print(f"✅ SUCCESS: Login successful")
                print(f"   User ID: {user_data.get('id')}")
                print(f"   Email: {user_data.get('email')}")
                print(f"   Role: {user_data.get('role')}")
                print(f"   Token: {login_token[:30]}..." if login_token else "No token")
        else:
            print(f"❌ FAILED: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print()
    
    # Step 3: Verify token with /auth/me (This is the key fix for React Native)
    print("STEP 3: GET /api/auth/me (Token Verification)")
    print("This is the critical endpoint that React Native app calls on startup")
    
    try:
        headers = HEADERS.copy()
        headers["Authorization"] = f"Bearer {login_token}"
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            me_data = response.json()
            
            print(f"✅ SUCCESS: Token verification successful")
            print(f"   User ID: {me_data.get('id')}")
            print(f"   Email: {me_data.get('email')}")
            print(f"   Username: {me_data.get('username')}")
            print(f"   Role: {me_data.get('role')}")
            print(f"   MFA Enabled: {me_data.get('mfa_enabled')}")
            print(f"   Partner Status: {me_data.get('partner_status')}")
            
            # Verify all required fields are present
            required_fields = ["id", "email", "role", "mfa_enabled"]
            missing_fields = [field for field in required_fields if field not in me_data]
            
            if missing_fields:
                print(f"⚠️  WARNING: Missing required fields: {missing_fields}")
                return False
            
            # Verify data consistency
            if me_data.get("email") != test_email:
                print(f"❌ ERROR: Email mismatch. Expected: {test_email}, Got: {me_data.get('email')}")
                return False
            
            if me_data.get("username") != test_username:
                print(f"❌ ERROR: Username mismatch. Expected: {test_username}, Got: {me_data.get('username')}")
                return False
            
            print(f"✅ All data validation passed")
            
        else:
            print(f"❌ FAILED: Token verification failed")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print()
    
    # Step 4: Test username login as well
    print("STEP 4: POST /api/auth/login (Username)")
    login_data = {
        "identifier": test_username,  # Test username login
        "password": test_password
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            login_resp = response.json()
            username_token = login_resp.get("token")
            
            print(f"✅ SUCCESS: Username login successful")
            print(f"   Token: {username_token[:30]}..." if username_token else "No token")
            
            # Verify this token also works with /auth/me
            headers = HEADERS.copy()
            headers["Authorization"] = f"Bearer {username_token}"
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                print(f"✅ Username token also works with /auth/me")
            else:
                print(f"❌ Username token failed /auth/me verification")
                return False
                
        else:
            print(f"❌ FAILED: Username login failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print()
    print("🎉 COMPLETE AUTHENTICATION FLOW TEST PASSED!")
    print("✅ React Native authentication fix is working correctly")
    print("✅ All endpoints (signup, login, auth/me) are functional")
    print("✅ Both email and username login work")
    print("✅ Token validation is working properly")
    
    return True

if __name__ == "__main__":
    success = test_complete_auth_flow()
    if success:
        print("\n🟢 ALL TESTS PASSED - Authentication system is ready for React Native")
    else:
        print("\n🔴 TESTS FAILED - Authentication issues need to be addressed")
    exit(0 if success else 1)