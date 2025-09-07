#!/usr/bin/env python3
"""
Debug test for SHINE Auth v3.0 critical issues
Focus on the specific problems mentioned in the review request
"""

import requests
import json
import uuid
from datetime import datetime

BASE_URL = "https://shine-app-debug.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def make_request(method, endpoint, data=None, headers=None, auth_token=None):
    """Helper function to make HTTP requests with detailed logging"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"\n{'='*60}")
        print(f"REQUEST: {method} {endpoint}")
        print(f"URL: {url}")
        if data:
            print(f"DATA: {json.dumps(data, indent=2)}")
        print(f"STATUS: {response.status_code}")
        
        try:
            response_data = response.json()
            print(f"RESPONSE: {json.dumps(response_data, indent=2)}")
        except:
            print(f"RESPONSE TEXT: {response.text}")
        
        return response
    except requests.exceptions.Timeout as e:
        print(f"Request timeout: {method} {endpoint} - {e}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {method} {endpoint} - {e}")
        return None

def test_critical_issues():
    """Test the specific critical issues mentioned in the review request"""
    
    print("🔍 DEBUGGING CRITICAL ISSUES FROM REVIEW REQUEST")
    print("="*60)
    
    # Issue 1: Email login failing with 401 for valid credentials
    print("\n1. TESTING EMAIL LOGIN WITH VALID CREDENTIALS")
    
    # First create a user
    test_email = f"debug_user_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"debug_user_{uuid.uuid4().hex[:8]}"
    
    signup_data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    print("\nCreating user for email login test...")
    signup_response = make_request("POST", "/auth/signup", signup_data)
    
    if signup_response and signup_response.status_code == 200:
        print("✅ User created successfully")
        
        # Now test email login
        print("\nTesting email login with valid credentials...")
        login_data = {
            "identifier": test_email,
            "password": "SecurePass123!"
        }
        
        login_response = make_request("POST", "/auth/login", login_data)
        
        if login_response and login_response.status_code == 200:
            print("✅ Email login working correctly")
        else:
            print(f"❌ CRITICAL: Email login failed with status {login_response.status_code if login_response else 'No response'}")
    else:
        print(f"❌ Could not create user for email login test. Status: {signup_response.status_code if signup_response else 'No response'}")
    
    # Issue 2: Database constraint error with username_lower index causing 500 errors when username is null
    print("\n\n2. TESTING SIGNUP WITHOUT USERNAME (NULL USERNAME)")
    
    signup_no_username = {
        "email": f"no_username_{uuid.uuid4().hex[:8]}@example.com",
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
        # No username field
    }
    
    print("\nTesting signup without username...")
    no_username_response = make_request("POST", "/auth/signup", signup_no_username)
    
    if no_username_response and no_username_response.status_code == 500:
        print("❌ CRITICAL: 500 error when username is null - database constraint issue confirmed")
    elif no_username_response and no_username_response.status_code == 200:
        print("✅ Signup without username works correctly")
    else:
        print(f"⚠️ Unexpected response for null username: {no_username_response.status_code if no_username_response else 'No response'}")
    
    # Issue 3: Owner signup failing due to database constraint
    print("\n\n3. TESTING OWNER SIGNUP")
    
    owner_signup_data = {
        "email": f"owner_debug_{uuid.uuid4().hex[:8]}@example.com",
        "username": f"owner_debug_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155552673",
        "accept_tos": True
    }
    
    print("\nTesting owner signup...")
    owner_response = make_request("POST", "/auth/signup", owner_signup_data)
    
    if owner_response and owner_response.status_code == 500:
        print("❌ CRITICAL: Owner signup failing with 500 error - database constraint issue")
    elif owner_response and owner_response.status_code == 200:
        print("✅ Owner signup working correctly")
    else:
        print(f"⚠️ Unexpected response for owner signup: {owner_response.status_code if owner_response else 'No response'}")
    
    # Issue 4: Server returning 500 errors on signup attempts
    print("\n\n4. TESTING VARIOUS SIGNUP SCENARIOS FOR 500 ERRORS")
    
    test_scenarios = [
        {
            "name": "Customer with all fields",
            "data": {
                "email": f"customer_500_{uuid.uuid4().hex[:8]}@example.com",
                "username": f"customer_500_{uuid.uuid4().hex[:8]}",
                "password": "SecurePass123!",
                "role": "customer",
                "phone": "+14155552674",
                "accept_tos": True
            }
        },
        {
            "name": "Partner with all fields",
            "data": {
                "email": f"partner_500_{uuid.uuid4().hex[:8]}@example.com",
                "username": f"partner_500_{uuid.uuid4().hex[:8]}",
                "password": "SecurePass123!",
                "role": "partner",
                "phone": "+14155552675",
                "accept_tos": True
            }
        },
        {
            "name": "Customer without username",
            "data": {
                "email": f"customer_no_user_{uuid.uuid4().hex[:8]}@example.com",
                "password": "SecurePass123!",
                "role": "customer",
                "accept_tos": True
            }
        }
    ]
    
    for scenario in test_scenarios:
        print(f"\nTesting: {scenario['name']}")
        response = make_request("POST", "/auth/signup", scenario['data'])
        
        if response and response.status_code == 500:
            print(f"❌ CRITICAL: 500 error for {scenario['name']}")
        elif response and response.status_code == 200:
            print(f"✅ {scenario['name']} working correctly")
        else:
            print(f"⚠️ Unexpected response for {scenario['name']}: {response.status_code if response else 'No response'}")

def test_database_constraint_edge_cases():
    """Test specific database constraint edge cases"""
    
    print("\n\n🔍 TESTING DATABASE CONSTRAINT EDGE CASES")
    print("="*60)
    
    # Test case 1: Empty string username
    print("\n1. TESTING EMPTY STRING USERNAME")
    empty_username_data = {
        "email": f"empty_username_{uuid.uuid4().hex[:8]}@example.com",
        "username": "",
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", empty_username_data)
    
    # Test case 2: Whitespace-only username
    print("\n2. TESTING WHITESPACE-ONLY USERNAME")
    whitespace_username_data = {
        "email": f"whitespace_username_{uuid.uuid4().hex[:8]}@example.com",
        "username": "   ",
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", whitespace_username_data)
    
    # Test case 3: None/null username (explicitly set to None)
    print("\n3. TESTING EXPLICIT NULL USERNAME")
    null_username_data = {
        "email": f"null_username_{uuid.uuid4().hex[:8]}@example.com",
        "username": None,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", null_username_data)

if __name__ == "__main__":
    test_critical_issues()
    test_database_constraint_edge_cases()
    print("\n🏁 Debug testing completed")