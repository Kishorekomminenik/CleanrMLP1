#!/usr/bin/env python3
"""
SHINE Auth v3.0 Backend System Comprehensive Tests
Tests all enhanced authentication endpoints and validation features
"""

import requests
import json
import time
from datetime import datetime
import uuid
import re

# Configuration
BASE_URL = "https://shine-role-router.preview.emergentagent.com/api"
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
        print(f"TEST SUMMARY")
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

def test_api_health(results):
    """Test if the API is accessible"""
    response = make_request("GET", "/")
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "message" in data:
                results.add_result("API Health Check", True, f"API is accessible: {data['message']}")
                return True
        except:
            pass
    
    results.add_result("API Health Check", False, f"API not accessible. Status: {response.status_code if response else 'No response'}")
    return False

def test_customer_registration(results):
    """Test customer user registration"""
    test_email = f"customer_{uuid.uuid4().hex[:8]}@test.com"
    
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer"
    }
    
    response = make_request("POST", "/auth/register", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            # Check response structure
            required_fields = ["access_token", "token_type", "user"]
            if all(field in resp_data for field in required_fields):
                user = resp_data["user"]
                
                # Verify user data
                if (user["email"] == test_email and 
                    user["role"] == "customer" and
                    user["partner_status"] is None and
                    user["mfa_enabled"] is False):
                    
                    results.add_result("Customer Registration", True, f"Customer registered successfully: {test_email}")
                    return resp_data["access_token"], test_email
                else:
                    results.add_result("Customer Registration", False, f"Invalid user data in response: {user}")
            else:
                results.add_result("Customer Registration", False, f"Missing required fields in response: {resp_data}")
        except Exception as e:
            results.add_result("Customer Registration", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Customer Registration", False, f"Registration failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email

def test_partner_registration(results):
    """Test partner user registration with pending status"""
    test_email = f"partner_{uuid.uuid4().hex[:8]}@test.com"
    
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "partner"
    }
    
    response = make_request("POST", "/auth/register", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            
            # Verify partner-specific data
            if (user["email"] == test_email and 
                user["role"] == "partner" and
                user["partner_status"] == "pending" and
                user["mfa_enabled"] is False):
                
                results.add_result("Partner Registration", True, f"Partner registered with pending status: {test_email}")
                return resp_data["access_token"], test_email
            else:
                results.add_result("Partner Registration", False, f"Partner status not set correctly: {user}")
        except Exception as e:
            results.add_result("Partner Registration", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Registration", False, f"Partner registration failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email

def test_owner_registration(results):
    """Test owner user registration with MFA enabled"""
    test_email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "owner"
    }
    
    response = make_request("POST", "/auth/register", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            
            # Verify owner-specific data
            if (user["email"] == test_email and 
                user["role"] == "owner" and
                user["partner_status"] is None and
                user["mfa_enabled"] is True):
                
                results.add_result("Owner Registration", True, f"Owner registered with MFA enabled: {test_email}")
                return resp_data["access_token"], test_email
            else:
                results.add_result("Owner Registration", False, f"Owner MFA not enabled correctly: {user}")
        except Exception as e:
            results.add_result("Owner Registration", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Owner Registration", False, f"Owner registration failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email

def test_duplicate_email_registration(results):
    """Test duplicate email registration handling"""
    test_email = f"duplicate_{uuid.uuid4().hex[:8]}@test.com"
    
    # First registration
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer"
    }
    
    response1 = make_request("POST", "/auth/register", data)
    
    if response1 and response1.status_code == 200:
        # Second registration with same email
        response2 = make_request("POST", "/auth/register", data)
        
        if response2 and response2.status_code == 400:
            try:
                error_data = response2.json()
                if "already registered" in error_data.get("detail", "").lower():
                    results.add_result("Duplicate Email Handling", True, "Duplicate email properly rejected")
                    return
            except:
                pass
        
        results.add_result("Duplicate Email Handling", False, f"Duplicate email not handled correctly. Status: {response2.status_code if response2 else 'No response'}")
    else:
        results.add_result("Duplicate Email Handling", False, "Could not create initial user for duplicate test")

def test_customer_login(results, email, password="SecurePass123!"):
    """Test customer login"""
    data = {
        "email": email,
        "password": password
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            # Should return token response for customer (no MFA)
            if "access_token" in resp_data and "user" in resp_data:
                results.add_result("Customer Login", True, f"Customer login successful: {email}")
                return resp_data["access_token"]
            else:
                results.add_result("Customer Login", False, f"Invalid login response structure: {resp_data}")
        except Exception as e:
            results.add_result("Customer Login", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Customer Login", False, f"Customer login failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_owner_login_mfa_flow(results, email, password="SecurePass123!"):
    """Test owner login with MFA flow"""
    data = {
        "email": email,
        "password": password
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            # Should return MFA required response
            if resp_data.get("mfa_required") is True and "dev_mfa_code" in resp_data:
                mfa_code = resp_data["dev_mfa_code"]
                results.add_result("Owner Login MFA Required", True, f"MFA code generated: {mfa_code}")
                
                # Test MFA verification
                return test_mfa_verification(results, email, mfa_code)
            else:
                results.add_result("Owner Login MFA Required", False, f"MFA not required for owner: {resp_data}")
        except Exception as e:
            results.add_result("Owner Login MFA Required", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Owner Login MFA Required", False, f"Owner login failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_mfa_verification(results, email, mfa_code):
    """Test MFA code verification"""
    data = {
        "email": email,
        "mfa_code": mfa_code
    }
    
    response = make_request("POST", "/auth/mfa", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "access_token" in resp_data and "user" in resp_data:
                results.add_result("MFA Verification", True, f"MFA verification successful for {email}")
                return resp_data["access_token"]
            else:
                results.add_result("MFA Verification", False, f"Invalid MFA response structure: {resp_data}")
        except Exception as e:
            results.add_result("MFA Verification", False, f"JSON parsing error: {e}")
    else:
        results.add_result("MFA Verification", False, f"MFA verification failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_invalid_mfa_code(results, email):
    """Test invalid MFA code handling"""
    data = {
        "email": email,
        "mfa_code": "000000"  # Invalid code
    }
    
    response = make_request("POST", "/auth/mfa", data)
    
    if response and response.status_code == 401:
        try:
            error_data = response.json()
            if "invalid" in error_data.get("detail", "").lower():
                results.add_result("Invalid MFA Code Handling", True, "Invalid MFA code properly rejected")
                return
        except:
            pass
    
    results.add_result("Invalid MFA Code Handling", False, f"Invalid MFA code not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_invalid_login_credentials(results):
    """Test invalid login credentials"""
    data = {
        "email": "nonexistent@test.com",
        "password": "wrongpassword"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 401:
        try:
            error_data = response.json()
            if "incorrect" in error_data.get("detail", "").lower():
                results.add_result("Invalid Login Credentials", True, "Invalid credentials properly rejected")
                return
        except:
            pass
    
    results.add_result("Invalid Login Credentials", False, f"Invalid credentials not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_get_current_user(results, token):
    """Test getting current user info with valid token"""
    response = make_request("GET", "/auth/me", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            user_data = response.json()
            
            required_fields = ["id", "email", "role", "mfa_enabled"]
            if all(field in user_data for field in required_fields):
                results.add_result("Get Current User", True, f"User info retrieved: {user_data['email']}")
                return user_data
            else:
                results.add_result("Get Current User", False, f"Missing required fields in user data: {user_data}")
        except Exception as e:
            results.add_result("Get Current User", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Get Current User", False, f"Get user info failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_invalid_token(results):
    """Test API access with invalid token"""
    response = make_request("GET", "/auth/me", auth_token="invalid_token")
    
    if response and response.status_code == 401:
        results.add_result("Invalid Token Handling", True, "Invalid token properly rejected")
    else:
        results.add_result("Invalid Token Handling", False, f"Invalid token not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_partner_role_switching(results, partner_token):
    """Test partner switching to customer role"""
    response = make_request("POST", "/auth/switch-role", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "access_token" in resp_data and "user" in resp_data:
                user = resp_data["user"]
                if user["role"] == "customer":
                    results.add_result("Partner Role Switching", True, f"Partner successfully switched to customer role")
                    return resp_data["access_token"]
                else:
                    results.add_result("Partner Role Switching", False, f"Role not switched correctly: {user}")
            else:
                results.add_result("Partner Role Switching", False, f"Invalid role switch response: {resp_data}")
        except Exception as e:
            results.add_result("Partner Role Switching", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Role Switching", False, f"Role switching failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_non_partner_role_switching(results, customer_token):
    """Test non-partner trying to switch roles (should fail)"""
    response = make_request("POST", "/auth/switch-role", auth_token=customer_token)
    
    if response and response.status_code == 403:
        try:
            error_data = response.json()
            if "only partners" in error_data.get("detail", "").lower():
                results.add_result("Non-Partner Role Switch Prevention", True, "Non-partner role switch properly prevented")
                return
        except:
            pass
    
    results.add_result("Non-Partner Role Switch Prevention", False, f"Non-partner role switch not prevented. Status: {response.status_code if response else 'No response'}")

def main():
    """Run all authentication tests"""
    print("🚀 Starting SHINE App Backend Authentication Tests")
    print(f"Testing API at: {BASE_URL}")
    print("="*60)
    
    results = TestResults()
    
    # Test API health
    if not test_api_health(results):
        print("❌ API is not accessible. Stopping tests.")
        results.print_summary()
        return
    
    # Test user registration
    customer_token, customer_email = test_customer_registration(results)
    partner_token, partner_email = test_partner_registration(results)
    owner_token, owner_email = test_owner_registration(results)
    
    # Test duplicate email handling
    test_duplicate_email_registration(results)
    
    # Test login flows
    if customer_email:
        customer_login_token = test_customer_login(results, customer_email)
    
    if owner_email:
        owner_login_token = test_owner_login_mfa_flow(results, owner_email)
        # Test invalid MFA code
        test_invalid_mfa_code(results, owner_email)
    
    # Test invalid login credentials
    test_invalid_login_credentials(results)
    
    # Test JWT token validation
    if customer_token:
        test_get_current_user(results, customer_token)
    
    test_invalid_token(results)
    
    # Test role switching
    if partner_token:
        switched_token = test_partner_role_switching(results, partner_token)
    
    if customer_token:
        test_non_partner_role_switching(results, customer_token)
    
    # Print final results
    results.print_summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)