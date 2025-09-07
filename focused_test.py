#!/usr/bin/env python3
"""
Focused test for error handling scenarios
"""

import requests
import json
import uuid

BASE_URL = "https://shine-app-debug.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_duplicate_email():
    """Test duplicate email registration"""
    test_email = f"duplicate_{uuid.uuid4().hex[:8]}@test.com"
    
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer"
    }
    
    print(f"Testing duplicate email with: {test_email}")
    
    # First registration
    response1 = requests.post(f"{BASE_URL}/auth/register", json=data, headers=HEADERS, timeout=10)
    print(f"First registration: {response1.status_code}")
    if response1.status_code == 200:
        print("✅ First registration successful")
        
        # Second registration with same email
        response2 = requests.post(f"{BASE_URL}/auth/register", json=data, headers=HEADERS, timeout=10)
        print(f"Second registration: {response2.status_code}")
        if response2.status_code == 400:
            error_data = response2.json()
            print(f"✅ Duplicate email properly rejected: {error_data}")
        else:
            print(f"❌ Duplicate email not handled correctly: {response2.status_code}")
    else:
        print(f"❌ First registration failed: {response1.status_code}")

def test_invalid_login():
    """Test invalid login credentials"""
    data = {
        "email": "nonexistent@test.com",
        "password": "wrongpassword"
    }
    
    print("Testing invalid login credentials")
    response = requests.post(f"{BASE_URL}/auth/login", json=data, headers=HEADERS, timeout=10)
    print(f"Invalid login response: {response.status_code}")
    if response.status_code == 401:
        error_data = response.json()
        print(f"✅ Invalid credentials properly rejected: {error_data}")
    else:
        print(f"❌ Invalid credentials not handled correctly: {response.status_code}")

def test_invalid_token():
    """Test invalid token"""
    headers = HEADERS.copy()
    headers["Authorization"] = "Bearer invalid_token"
    
    print("Testing invalid token")
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
    print(f"Invalid token response: {response.status_code}")
    if response.status_code == 401:
        error_data = response.json()
        print(f"✅ Invalid token properly rejected: {error_data}")
    else:
        print(f"❌ Invalid token not handled correctly: {response.status_code}")

def test_invalid_mfa():
    """Test invalid MFA code"""
    # First create an owner user
    test_email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "owner"
    }
    
    print(f"Creating owner user: {test_email}")
    response = requests.post(f"{BASE_URL}/auth/register", json=data, headers=HEADERS, timeout=10)
    if response.status_code == 200:
        print("✅ Owner created successfully")
        
        # Try to login to trigger MFA
        login_data = {
            "email": test_email,
            "password": "SecurePass123!"
        }
        
        login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=HEADERS, timeout=10)
        if login_response.status_code == 200:
            login_result = login_response.json()
            if login_result.get("mfa_required"):
                print("✅ MFA required for owner login")
                
                # Test invalid MFA code
                mfa_data = {
                    "email": test_email,
                    "mfa_code": "000000"  # Invalid code
                }
                
                mfa_response = requests.post(f"{BASE_URL}/auth/mfa", json=mfa_data, headers=HEADERS, timeout=10)
                print(f"Invalid MFA response: {mfa_response.status_code}")
                if mfa_response.status_code == 401:
                    error_data = mfa_response.json()
                    print(f"✅ Invalid MFA code properly rejected: {error_data}")
                else:
                    print(f"❌ Invalid MFA code not handled correctly: {mfa_response.status_code}")
            else:
                print(f"❌ MFA not required for owner: {login_result}")
        else:
            print(f"❌ Owner login failed: {login_response.status_code}")
    else:
        print(f"❌ Owner creation failed: {response.status_code}")

if __name__ == "__main__":
    print("🔍 Running focused error handling tests")
    print("="*50)
    
    test_duplicate_email()
    print()
    test_invalid_login()
    print()
    test_invalid_token()
    print()
    test_invalid_mfa()