#!/usr/bin/env python3
"""
SHINE Auth v3.0 Backend System Focused Tests
Focused testing with better error handling
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://home-dashboard-2.preview.emergentagent.com/api"
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
        print(f"SHINE AUTH v3.0 FOCUSED TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        if self.passed + self.failed > 0:
            print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.failed > 0:
            print(f"\nFAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"- {result['test']}: {result['message']}")

def make_request(method, endpoint, data=None, auth_token=None):
    """Helper function to make HTTP requests with better error handling"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, timeout=15)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=15)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"Request: {method} {endpoint} -> Status: {response.status_code}")
        return response
    except requests.exceptions.Timeout:
        print(f"Request timeout: {method} {endpoint}")
        return None
    except requests.exceptions.ConnectionError:
        print(f"Connection error: {method} {endpoint}")
        return None
    except Exception as e:
        print(f"Request failed: {method} {endpoint} - {e}")
        return None

def test_api_health(results):
    """Test if the API is accessible"""
    response = make_request("GET", "/")
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "message" in data and "v3.0" in data["message"]:
                results.add_result("API Health Check", True, f"API v3.0 accessible: {data['message']}")
                return True
        except:
            pass
    
    results.add_result("API Health Check", False, f"API not accessible. Status: {response.status_code if response else 'No response'}")
    return False

def test_enhanced_signup_flow(results):
    """Test complete enhanced signup flow"""
    
    # Test 1: Customer signup with all fields
    test_email = f"customer_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"customer_{uuid.uuid4().hex[:8]}"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                user = resp_data["user"]
                if (user["email"] == test_email and 
                    user["username"] == test_username and
                    user["role"] == "customer" and
                    user["mfa_enabled"] is False):
                    results.add_result("Enhanced Customer Signup", True, f"Customer registered: {test_email}")
                    return resp_data["token"], test_email, test_username
                else:
                    results.add_result("Enhanced Customer Signup", False, f"Invalid user data: {user}")
            else:
                results.add_result("Enhanced Customer Signup", False, f"Missing fields in response")
        except Exception as e:
            results.add_result("Enhanced Customer Signup", False, f"JSON error: {e}")
    else:
        results.add_result("Enhanced Customer Signup", False, f"Signup failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email, test_username

def test_validation_rules(results):
    """Test all validation rules"""
    
    # Test weak password
    data = {
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "weak",
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 422:
        try:
            error_data = response.json()
            if "password" in str(error_data).lower():
                results.add_result("Password Validation", True, "Weak password properly rejected")
            else:
                results.add_result("Password Validation", False, f"Wrong error message: {error_data}")
        except:
            results.add_result("Password Validation", False, "Could not parse error response")
    else:
        results.add_result("Password Validation", False, f"Weak password not rejected. Status: {response.status_code if response else 'No response'}")
    
    # Test invalid username
    data = {
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "username": "ab",  # Too short
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 422:
        try:
            error_data = response.json()
            if "username" in str(error_data).lower():
                results.add_result("Username Validation", True, "Invalid username properly rejected")
            else:
                results.add_result("Username Validation", False, f"Wrong error message: {error_data}")
        except:
            results.add_result("Username Validation", False, "Could not parse error response")
    else:
        results.add_result("Username Validation", False, f"Invalid username not rejected. Status: {response.status_code if response else 'No response'}")
    
    # Test ToS requirement
    data = {
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": False
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 422:
        try:
            error_data = response.json()
            if "accept" in str(error_data).lower() or "terms" in str(error_data).lower():
                results.add_result("ToS Validation", True, "ToS requirement properly enforced")
            else:
                results.add_result("ToS Validation", False, f"Wrong error message: {error_data}")
        except:
            results.add_result("ToS Validation", False, "Could not parse error response")
    else:
        results.add_result("ToS Validation", False, f"ToS requirement not enforced. Status: {response.status_code if response else 'No response'}")

def test_duplicate_handling(results):
    """Test duplicate email and username handling"""
    
    # Test duplicate email
    test_email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
    
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    # First signup
    response1 = make_request("POST", "/auth/signup", data)
    
    if response1 and response1.status_code == 200:
        # Second signup with same email
        response2 = make_request("POST", "/auth/signup", data)
        
        if response2 and response2.status_code == 409:
            try:
                error_data = response2.json()
                if "email" in error_data.get("detail", "").lower():
                    results.add_result("Duplicate Email Handling", True, "Duplicate email properly rejected with 409")
                else:
                    results.add_result("Duplicate Email Handling", False, f"Wrong error message: {error_data}")
            except:
                results.add_result("Duplicate Email Handling", False, "Could not parse error response")
        else:
            results.add_result("Duplicate Email Handling", False, f"Duplicate email not rejected. Status: {response2.status_code if response2 else 'No response'}")
    else:
        results.add_result("Duplicate Email Handling", False, "Could not create initial user for duplicate test")

def test_login_flows(results, email, username):
    """Test enhanced login flows"""
    
    # Test login with email
    data = {
        "identifier": email,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results.add_result("Login with Email", True, f"Email login successful: {email}")
                return resp_data["token"]
            else:
                results.add_result("Login with Email", False, f"Invalid login response: {resp_data}")
        except Exception as e:
            results.add_result("Login with Email", False, f"JSON error: {e}")
    else:
        results.add_result("Login with Email", False, f"Email login failed. Status: {response.status_code if response else 'No response'}")
    
    # Test login with username
    data = {
        "identifier": username,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results.add_result("Login with Username", True, f"Username login successful: {username}")
                return resp_data["token"]
            else:
                results.add_result("Login with Username", False, f"Invalid login response: {resp_data}")
        except Exception as e:
            results.add_result("Login with Username", False, f"JSON error: {e}")
    else:
        results.add_result("Login with Username", False, f"Username login failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_invalid_credentials(results):
    """Test invalid credentials handling"""
    data = {
        "identifier": "nonexistent@example.com",
        "password": "wrongpassword"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 401:
        try:
            error_data = response.json()
            if "credentials" in error_data.get("detail", "").lower() or "incorrect" in error_data.get("detail", "").lower():
                results.add_result("Invalid Credentials Handling", True, "Invalid credentials properly rejected")
            else:
                results.add_result("Invalid Credentials Handling", False, f"Wrong error message: {error_data}")
        except:
            results.add_result("Invalid Credentials Handling", False, "Could not parse error response")
    else:
        results.add_result("Invalid Credentials Handling", False, f"Invalid credentials not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_owner_mfa_flow(results):
    """Test owner MFA flow"""
    
    # Create owner account
    test_email = f"owner_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"owner_{uuid.uuid4().hex[:8]}"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "owner",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            if user["mfa_enabled"] is True:
                results.add_result("Owner MFA Enabled", True, f"Owner MFA enabled during signup: {test_email}")
                
                # Test login should require MFA
                login_data = {
                    "identifier": test_email,
                    "password": "SecurePass123!"
                }
                
                login_response = make_request("POST", "/auth/login", login_data)
                
                if login_response and login_response.status_code == 200:
                    try:
                        login_resp_data = login_response.json()
                        if login_resp_data.get("mfa_required") is True and "dev_mfa_code" in login_resp_data:
                            results.add_result("Owner MFA Required", True, f"MFA required for owner login")
                            
                            # Test MFA verification
                            mfa_data = {
                                "user_id": login_resp_data["user_id"],
                                "code": login_resp_data["dev_mfa_code"]
                            }
                            
                            mfa_response = make_request("POST", "/auth/mfa/verify", mfa_data)
                            
                            if mfa_response and mfa_response.status_code == 200:
                                try:
                                    mfa_resp_data = mfa_response.json()
                                    if mfa_resp_data.get("ok") is True and "token" in mfa_resp_data:
                                        results.add_result("MFA Verification", True, "MFA verification successful")
                                    else:
                                        results.add_result("MFA Verification", False, f"Invalid MFA response: {mfa_resp_data}")
                                except:
                                    results.add_result("MFA Verification", False, "Could not parse MFA response")
                            else:
                                results.add_result("MFA Verification", False, f"MFA verification failed. Status: {mfa_response.status_code if mfa_response else 'No response'}")
                        else:
                            results.add_result("Owner MFA Required", False, f"MFA not required: {login_resp_data}")
                    except:
                        results.add_result("Owner MFA Required", False, "Could not parse login response")
                else:
                    results.add_result("Owner MFA Required", False, f"Owner login failed. Status: {login_response.status_code if login_response else 'No response'}")
            else:
                results.add_result("Owner MFA Enabled", False, f"Owner MFA not enabled: {user}")
        except:
            results.add_result("Owner MFA Enabled", False, "Could not parse signup response")
    else:
        results.add_result("Owner MFA Enabled", False, f"Owner signup failed. Status: {response.status_code if response else 'No response'}")

def test_password_reset_flow(results):
    """Test password reset flow"""
    
    # Test reset start with phone
    data = {
        "email_or_phone": "+14155552999"
    }
    
    response = make_request("POST", "/auth/reset/start", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("sent") is True and resp_data.get("channel") == "sms":
                results.add_result("Password Reset Start (Phone)", True, "Reset OTP sent via SMS")
            else:
                results.add_result("Password Reset Start (Phone)", False, f"Invalid reset response: {resp_data}")
        except:
            results.add_result("Password Reset Start (Phone)", False, "Could not parse reset response")
    else:
        results.add_result("Password Reset Start (Phone)", False, f"Reset start failed. Status: {response.status_code if response else 'No response'}")
    
    # Test reset verify with invalid OTP (expected to fail)
    data = {
        "email_or_phone": "+14155552999",
        "otp": "000000",
        "new_password": "NewSecurePass123!"
    }
    
    response = make_request("POST", "/auth/reset/verify", data)
    
    if response and response.status_code == 400:
        try:
            error_data = response.json()
            if "otp" in error_data.get("detail", "").lower() or "invalid" in error_data.get("detail", "").lower():
                results.add_result("Password Reset Verify (Invalid OTP)", True, "Invalid OTP properly rejected")
            else:
                results.add_result("Password Reset Verify (Invalid OTP)", False, f"Wrong error message: {error_data}")
        except:
            results.add_result("Password Reset Verify (Invalid OTP)", False, "Could not parse error response")
    else:
        results.add_result("Password Reset Verify (Invalid OTP)", False, f"Invalid OTP not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_jwt_validation(results, token):
    """Test JWT token validation"""
    
    # Test valid token
    response = make_request("GET", "/auth/me", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            user_data = response.json()
            required_fields = ["id", "email", "role", "mfa_enabled"]
            if all(field in user_data for field in required_fields):
                results.add_result("Get Current User", True, f"User info retrieved: {user_data['email']}")
            else:
                results.add_result("Get Current User", False, f"Missing fields in user data: {user_data}")
        except:
            results.add_result("Get Current User", False, "Could not parse user data")
    else:
        results.add_result("Get Current User", False, f"Get user info failed. Status: {response.status_code if response else 'No response'}")
    
    # Test invalid token
    response = make_request("GET", "/auth/me", auth_token="invalid_token")
    
    if response and response.status_code == 401:
        try:
            error_data = response.json()
            if "credentials" in error_data.get("detail", "").lower() or "validate" in error_data.get("detail", "").lower():
                results.add_result("Invalid Token Handling", True, "Invalid token properly rejected")
            else:
                results.add_result("Invalid Token Handling", False, f"Wrong error message: {error_data}")
        except:
            results.add_result("Invalid Token Handling", False, "Could not parse error response")
    else:
        results.add_result("Invalid Token Handling", False, f"Invalid token not handled correctly. Status: {response.status_code if response else 'No response'}")

def main():
    """Run focused SHINE Auth v3.0 tests"""
    print("🚀 Starting SHINE Auth v3.0 Backend Focused Tests")
    print(f"Testing API at: {BASE_URL}")
    print("="*60)
    
    results = TestResults()
    
    # Test API health
    if not test_api_health(results):
        print("❌ API is not accessible. Stopping tests.")
        results.print_summary()
        return False
    
    print("\n📝 TESTING ENHANCED SIGNUP...")
    customer_token, customer_email, customer_username = test_enhanced_signup_flow(results)
    
    print("\n🔒 TESTING VALIDATION RULES...")
    test_validation_rules(results)
    
    print("\n🔄 TESTING DUPLICATE HANDLING...")
    test_duplicate_handling(results)
    
    print("\n🔑 TESTING LOGIN FLOWS...")
    if customer_email and customer_username:
        login_token = test_login_flows(results, customer_email, customer_username)
    
    test_invalid_credentials(results)
    
    print("\n🛡️ TESTING OWNER MFA FLOW...")
    test_owner_mfa_flow(results)
    
    print("\n🔄 TESTING PASSWORD RESET...")
    test_password_reset_flow(results)
    
    print("\n🔧 TESTING JWT VALIDATION...")
    if customer_token:
        test_jwt_validation(results, customer_token)
    
    # Print final results
    results.print_summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)