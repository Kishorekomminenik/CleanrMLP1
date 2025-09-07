#!/usr/bin/env python3
"""
FOCUSED AUTH TOKEN VERIFICATION TEST
Tests the GET /api/auth/me endpoint to ensure React Native authentication fix works properly.
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://shine-app-debug.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, message=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"AUTH TOKEN VERIFICATION TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.failed > 0:
            print(f"\nFAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"- {result['test']}: {result['message']}")

def make_request(method, endpoint, data=None, headers=None, auth_token=None):
    """Helper function to make HTTP requests"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"Request: {method} {endpoint} -> Status: {response.status_code}")
        return response
    except requests.exceptions.Timeout as e:
        print(f"Request timeout: {method} {endpoint} - {e}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {method} {endpoint} - {e}")
        return None

def test_auth_me_no_header(results):
    """Test GET /api/auth/me with no Authorization header (should return 401/403)"""
    response = make_request("GET", "/auth/me")
    
    if response and response.status_code in [401, 403]:
        results.add_result("Auth Me - No Header", True, f"Properly rejected with status {response.status_code}")
        return True
    else:
        results.add_result("Auth Me - No Header", False, f"Expected 401/403, got {response.status_code if response else 'No response'}")
        return False

def test_auth_me_invalid_token(results):
    """Test GET /api/auth/me with invalid token (should return 401/403)"""
    invalid_tokens = [
        "invalid_token",
        "Bearer invalid_token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
        "",
        "   ",
        "null"
    ]
    
    passed_count = 0
    for invalid_token in invalid_tokens:
        response = make_request("GET", "/auth/me", auth_token=invalid_token)
        
        if response and response.status_code in [401, 403]:
            passed_count += 1
        else:
            results.add_result("Auth Me - Invalid Token", False, f"Invalid token '{invalid_token}' not rejected properly. Status: {response.status_code if response else 'No response'}")
            return False
    
    results.add_result("Auth Me - Invalid Token", True, f"All {passed_count} invalid tokens properly rejected")
    return True

def create_test_account(results):
    """Create a test account and return the token"""
    test_email = f"auth_test_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"auth_test_{uuid.uuid4().hex[:8]}"
    
    signup_data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results.add_result("Create Test Account", True, f"Test account created: {test_email}")
                return resp_data["token"], test_email, test_username
            else:
                results.add_result("Create Test Account", False, f"Invalid signup response: {resp_data}")
        except Exception as e:
            results.add_result("Create Test Account", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Create Test Account", False, f"Signup failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email, test_username

def test_login_flow(results, email, username):
    """Test complete login flow and return token"""
    # Test email login
    login_data = {
        "identifier": email,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results.add_result("Login Flow - Email", True, f"Email login successful: {email}")
                return resp_data["token"]
            else:
                results.add_result("Login Flow - Email", False, f"Invalid login response: {resp_data}")
        except Exception as e:
            results.add_result("Login Flow - Email", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Login Flow - Email", False, f"Email login failed. Status: {response.status_code if response else 'No response'}")
    
    # Test username login as fallback
    login_data = {
        "identifier": username,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results.add_result("Login Flow - Username", True, f"Username login successful: {username}")
                return resp_data["token"]
            else:
                results.add_result("Login Flow - Username", False, f"Invalid login response: {resp_data}")
        except Exception as e:
            results.add_result("Login Flow - Username", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Login Flow - Username", False, f"Username login failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_auth_me_valid_token(results, token, expected_email):
    """Test GET /api/auth/me with valid token (should return user data)"""
    response = make_request("GET", "/auth/me", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            user_data = response.json()
            
            # Check required fields
            required_fields = ["id", "email", "role", "mfa_enabled"]
            missing_fields = [field for field in required_fields if field not in user_data]
            
            if missing_fields:
                results.add_result("Auth Me - Valid Token", False, f"Missing required fields: {missing_fields}")
                return False
            
            # Verify email matches
            if user_data["email"] != expected_email:
                results.add_result("Auth Me - Valid Token", False, f"Email mismatch. Expected: {expected_email}, Got: {user_data['email']}")
                return False
            
            # Verify data types
            if not isinstance(user_data["id"], str) or not user_data["id"]:
                results.add_result("Auth Me - Valid Token", False, f"Invalid user ID: {user_data['id']}")
                return False
            
            if user_data["role"] not in ["customer", "partner", "owner"]:
                results.add_result("Auth Me - Valid Token", False, f"Invalid role: {user_data['role']}")
                return False
            
            if not isinstance(user_data["mfa_enabled"], bool):
                results.add_result("Auth Me - Valid Token", False, f"Invalid mfa_enabled type: {type(user_data['mfa_enabled'])}")
                return False
            
            results.add_result("Auth Me - Valid Token", True, f"Valid token returned correct user data: {user_data['email']}, role: {user_data['role']}")
            return True
            
        except Exception as e:
            results.add_result("Auth Me - Valid Token", False, f"JSON parsing error: {e}")
            return False
    else:
        results.add_result("Auth Me - Valid Token", False, f"Valid token rejected. Status: {response.status_code if response else 'No response'}")
        return False

def test_complete_auth_flow(results):
    """Test the complete authentication flow that React Native app will use"""
    print("\n" + "="*60)
    print("TESTING COMPLETE AUTHENTICATION FLOW")
    print("="*60)
    
    # Step 1: Create test account
    token, email, username = create_test_account(results)
    if not token:
        results.add_result("Complete Auth Flow", False, "Failed to create test account")
        return False
    
    # Step 2: Test /auth/me with signup token
    if not test_auth_me_valid_token(results, token, email):
        results.add_result("Complete Auth Flow", False, "Failed to validate signup token")
        return False
    
    # Step 3: Test login flow
    login_token = test_login_flow(results, email, username)
    if not login_token:
        results.add_result("Complete Auth Flow", False, "Failed to login")
        return False
    
    # Step 4: Test /auth/me with login token
    if not test_auth_me_valid_token(results, login_token, email):
        results.add_result("Complete Auth Flow", False, "Failed to validate login token")
        return False
    
    results.add_result("Complete Auth Flow", True, "All authentication flow steps completed successfully")
    return True

def main():
    """Run all authentication token verification tests"""
    print("SHINE AUTH TOKEN VERIFICATION TESTS")
    print("="*60)
    print("Testing GET /api/auth/me endpoint for React Native authentication fix")
    print()
    
    results = TestResults()
    
    # Test 1: No Authorization header
    print("Test 1: No Authorization Header")
    test_auth_me_no_header(results)
    print()
    
    # Test 2: Invalid tokens
    print("Test 2: Invalid Tokens")
    test_auth_me_invalid_token(results)
    print()
    
    # Test 3: Complete authentication flow
    print("Test 3: Complete Authentication Flow")
    test_complete_auth_flow(results)
    print()
    
    # Print final summary
    results.print_summary()
    
    # Return success/failure for script exit code
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)