#!/usr/bin/env python3
"""
Comprehensive SHINE Auth v3.0 Backend Test
Focus on all authentication endpoints with detailed error analysis
"""

import requests
import json
import uuid
from datetime import datetime

BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.critical_issues = []
        self.minor_issues = []
    
    def add_result(self, test_name, passed, message="", is_critical=False):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "critical": is_critical
        })
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            if is_critical:
                self.critical_issues.append(f"{test_name}: {message}")
            else:
                self.minor_issues.append(f"{test_name}: {message}")
        
        status = "✅ PASS" if passed else ("❌ CRITICAL FAIL" if is_critical else "⚠️ MINOR FAIL")
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
    
    def print_summary(self):
        print(f"\n{'='*80}")
        print(f"COMPREHENSIVE SHINE AUTH v3.0 TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.critical_issues:
            print(f"\n🚨 CRITICAL ISSUES ({len(self.critical_issues)}):")
            for issue in self.critical_issues:
                print(f"  - {issue}")
        
        if self.minor_issues:
            print(f"\n⚠️ MINOR ISSUES ({len(self.minor_issues)}):")
            for issue in self.minor_issues:
                print(f"  - {issue}")
        
        if not self.critical_issues and not self.minor_issues:
            print(f"\n🎉 ALL TESTS PASSED - NO ISSUES FOUND!")

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
            response = requests.get(url, headers=request_headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
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
            if "message" in data and "v3.0" in data["message"]:
                results.add_result("API Health Check", True, f"API v3.0 accessible: {data['message']}")
                return True
        except:
            pass
    
    results.add_result("API Health Check", False, f"API not accessible. Status: {response.status_code if response else 'No response'}", is_critical=True)
    return False

def test_all_role_signups(results):
    """Test signup for all roles with comprehensive validation"""
    
    # Test Customer Signup
    customer_email = f"customer_{uuid.uuid4().hex[:8]}@example.com"
    customer_username = f"customer_{uuid.uuid4().hex[:8]}"
    
    customer_data = {
        "email": customer_email,
        "username": customer_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", customer_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            
            if (user["role"] == "customer" and 
                user["partner_status"] is None and
                user["mfa_enabled"] is False and
                "token" in resp_data):
                results.add_result("Customer Signup", True, f"Customer registered successfully: {customer_email}")
                customer_token = resp_data["token"]
            else:
                results.add_result("Customer Signup", False, f"Invalid customer data: {user}", is_critical=True)
                customer_token = None
        except Exception as e:
            results.add_result("Customer Signup", False, f"JSON parsing error: {e}", is_critical=True)
            customer_token = None
    else:
        results.add_result("Customer Signup", False, f"Customer signup failed. Status: {response.status_code if response else 'No response'}", is_critical=True)
        customer_token = None
    
    # Test Partner Signup
    partner_email = f"partner_{uuid.uuid4().hex[:8]}@example.com"
    partner_username = f"partner_{uuid.uuid4().hex[:8]}"
    
    partner_data = {
        "email": partner_email,
        "username": partner_username,
        "password": "SecurePass123!",
        "role": "partner",
        "phone": "+14155552672",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", partner_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            
            if (user["role"] == "partner" and 
                user["partner_status"] == "pending" and
                user["mfa_enabled"] is False and
                "token" in resp_data):
                results.add_result("Partner Signup", True, f"Partner registered with pending status: {partner_email}")
                partner_token = resp_data["token"]
            else:
                results.add_result("Partner Signup", False, f"Invalid partner data: {user}", is_critical=True)
                partner_token = None
        except Exception as e:
            results.add_result("Partner Signup", False, f"JSON parsing error: {e}", is_critical=True)
            partner_token = None
    else:
        results.add_result("Partner Signup", False, f"Partner signup failed. Status: {response.status_code if response else 'No response'}", is_critical=True)
        partner_token = None
    
    # Test Owner Signup
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@example.com"
    owner_username = f"owner_{uuid.uuid4().hex[:8]}"
    
    owner_data = {
        "email": owner_email,
        "username": owner_username,
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155552673",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", owner_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            
            if (user["role"] == "owner" and 
                user["partner_status"] is None and
                user["mfa_enabled"] is True and
                "token" in resp_data):
                results.add_result("Owner Signup", True, f"Owner registered with MFA enabled: {owner_email}")
                owner_token = resp_data["token"]
            else:
                results.add_result("Owner Signup", False, f"Invalid owner data: {user}", is_critical=True)
                owner_token = None
        except Exception as e:
            results.add_result("Owner Signup", False, f"JSON parsing error: {e}", is_critical=True)
            owner_token = None
    else:
        results.add_result("Owner Signup", False, f"Owner signup failed. Status: {response.status_code if response else 'No response'}", is_critical=True)
        owner_token = None
    
    return {
        "customer": {"email": customer_email, "username": customer_username, "token": customer_token},
        "partner": {"email": partner_email, "username": partner_username, "token": partner_token},
        "owner": {"email": owner_email, "username": owner_username, "token": owner_token}
    }

def test_login_scenarios(results, users):
    """Test all login scenarios"""
    
    # Test Email Login for Customer
    if users["customer"]["email"]:
        login_data = {
            "identifier": users["customer"]["email"],
            "password": "SecurePass123!"
        }
        
        response = make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "token" in resp_data and "user" in resp_data:
                    results.add_result("Customer Email Login", True, f"Email login successful: {users['customer']['email']}")
                else:
                    results.add_result("Customer Email Login", False, f"Invalid login response: {resp_data}", is_critical=True)
            except Exception as e:
                results.add_result("Customer Email Login", False, f"JSON parsing error: {e}", is_critical=True)
        else:
            results.add_result("Customer Email Login", False, f"Email login failed. Status: {response.status_code if response else 'No response'}", is_critical=True)
    
    # Test Username Login for Customer
    if users["customer"]["username"]:
        login_data = {
            "identifier": users["customer"]["username"],
            "password": "SecurePass123!"
        }
        
        response = make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "token" in resp_data and "user" in resp_data:
                    results.add_result("Customer Username Login", True, f"Username login successful: {users['customer']['username']}")
                else:
                    results.add_result("Customer Username Login", False, f"Invalid login response: {resp_data}", is_critical=True)
            except Exception as e:
                results.add_result("Customer Username Login", False, f"JSON parsing error: {e}", is_critical=True)
        else:
            results.add_result("Customer Username Login", False, f"Username login failed. Status: {response.status_code if response else 'No response'}", is_critical=True)
    
    # Test Owner MFA Flow
    if users["owner"]["email"]:
        login_data = {
            "identifier": users["owner"]["email"],
            "password": "SecurePass123!"
        }
        
        response = make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("mfa_required") is True and "user_id" in resp_data and "dev_mfa_code" in resp_data:
                    results.add_result("Owner MFA Login", True, f"MFA required for owner login: {users['owner']['email']}")
                    
                    # Test MFA Verification
                    mfa_data = {
                        "user_id": resp_data["user_id"],
                        "code": resp_data["dev_mfa_code"]
                    }
                    
                    mfa_response = make_request("POST", "/auth/mfa/verify", mfa_data)
                    
                    if mfa_response and mfa_response.status_code == 200:
                        try:
                            mfa_resp_data = mfa_response.json()
                            if mfa_resp_data.get("ok") is True and "token" in mfa_resp_data and "user" in mfa_resp_data:
                                results.add_result("Owner MFA Verification", True, f"MFA verification successful")
                            else:
                                results.add_result("Owner MFA Verification", False, f"Invalid MFA response: {mfa_resp_data}", is_critical=True)
                        except Exception as e:
                            results.add_result("Owner MFA Verification", False, f"MFA JSON parsing error: {e}", is_critical=True)
                    else:
                        results.add_result("Owner MFA Verification", False, f"MFA verification failed. Status: {mfa_response.status_code if mfa_response else 'No response'}", is_critical=True)
                else:
                    results.add_result("Owner MFA Login", False, f"MFA not required for owner: {resp_data}", is_critical=True)
            except Exception as e:
                results.add_result("Owner MFA Login", False, f"JSON parsing error: {e}", is_critical=True)
        else:
            results.add_result("Owner MFA Login", False, f"Owner login failed. Status: {response.status_code if response else 'No response'}", is_critical=True)

def test_password_reset_flow(results, users):
    """Test password reset functionality"""
    
    if users["customer"]["email"]:
        # Test reset start with email
        reset_data = {
            "email_or_phone": users["customer"]["email"]
        }
        
        response = make_request("POST", "/auth/reset/start", reset_data)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("sent") is True and resp_data.get("channel") == "email":
                    results.add_result("Password Reset Start", True, f"Reset OTP sent via email: {users['customer']['email']}")
                else:
                    results.add_result("Password Reset Start", False, f"Invalid reset response: {resp_data}")
            except Exception as e:
                results.add_result("Password Reset Start", False, f"JSON parsing error: {e}")
        else:
            results.add_result("Password Reset Start", False, f"Reset start failed. Status: {response.status_code if response else 'No response'}")

def test_jwt_validation(results, users):
    """Test JWT token validation"""
    
    if users["customer"]["token"]:
        # Test valid token
        response = make_request("GET", "/auth/me", auth_token=users["customer"]["token"])
        
        if response and response.status_code == 200:
            try:
                user_data = response.json()
                required_fields = ["id", "email", "role", "mfa_enabled"]
                if all(field in user_data for field in required_fields):
                    results.add_result("JWT Token Validation", True, f"Valid token accepted: {user_data['email']}")
                else:
                    results.add_result("JWT Token Validation", False, f"Missing fields in user data: {user_data}", is_critical=True)
            except Exception as e:
                results.add_result("JWT Token Validation", False, f"JSON parsing error: {e}", is_critical=True)
        else:
            results.add_result("JWT Token Validation", False, f"Valid token rejected. Status: {response.status_code if response else 'No response'}", is_critical=True)
    
    # Test invalid token
    response = make_request("GET", "/auth/me", auth_token="invalid_token_12345")
    
    if response and response.status_code == 401:
        results.add_result("Invalid JWT Token Handling", True, "Invalid token properly rejected")
    else:
        results.add_result("Invalid JWT Token Handling", False, f"Invalid token not rejected. Status: {response.status_code if response else 'No response'}")

def test_role_switching(results, users):
    """Test partner role switching"""
    
    if users["partner"]["token"]:
        response = make_request("POST", "/auth/switch-role", auth_token=users["partner"]["token"])
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "token" in resp_data and "user" in resp_data and resp_data["user"]["role"] == "customer":
                    results.add_result("Partner Role Switching", True, f"Partner successfully switched to customer role")
                else:
                    results.add_result("Partner Role Switching", False, f"Role not switched correctly: {resp_data}", is_critical=True)
            except Exception as e:
                results.add_result("Partner Role Switching", False, f"JSON parsing error: {e}", is_critical=True)
        else:
            results.add_result("Partner Role Switching", False, f"Role switching failed. Status: {response.status_code if response else 'No response'}", is_critical=True)

def test_error_handling(results):
    """Test error handling scenarios"""
    
    # Test invalid credentials
    login_data = {
        "identifier": "nonexistent@example.com",
        "password": "wrongpassword"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if response and response.status_code == 401:
        results.add_result("Invalid Credentials Handling", True, "Invalid credentials properly rejected with 401")
    else:
        results.add_result("Invalid Credentials Handling", False, f"Invalid credentials not handled correctly. Status: {response.status_code if response else 'No response'}")
    
    # Test duplicate email
    test_email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
    
    signup_data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    # First signup
    response1 = make_request("POST", "/auth/signup", signup_data)
    
    if response1 and response1.status_code == 200:
        # Second signup with same email
        response2 = make_request("POST", "/auth/signup", signup_data)
        
        if response2 and response2.status_code == 409:
            results.add_result("Duplicate Email Handling", True, "Duplicate email properly rejected with 409")
        else:
            results.add_result("Duplicate Email Handling", False, f"Duplicate email not handled correctly. Status: {response2.status_code if response2 else 'No response'}")
    else:
        results.add_result("Duplicate Email Handling", False, "Could not create initial user for duplicate test")

def main():
    """Run comprehensive SHINE Auth v3.0 tests"""
    print("🚀 Starting Comprehensive SHINE Auth v3.0 Backend Tests")
    print(f"Testing API at: {BASE_URL}")
    print("="*80)
    
    results = TestResults()
    
    # Test API health
    if not test_api_health(results):
        print("❌ API is not accessible. Stopping tests.")
        results.print_summary()
        return False
    
    print("\n📝 TESTING ALL ROLE SIGNUPS...")
    users = test_all_role_signups(results)
    
    print("\n🔑 TESTING LOGIN SCENARIOS...")
    test_login_scenarios(results, users)
    
    print("\n🔄 TESTING PASSWORD RESET FLOW...")
    test_password_reset_flow(results, users)
    
    print("\n🛡️ TESTING JWT VALIDATION...")
    test_jwt_validation(results, users)
    
    print("\n🔄 TESTING ROLE SWITCHING...")
    test_role_switching(results, users)
    
    print("\n⚠️ TESTING ERROR HANDLING...")
    test_error_handling(results)
    
    # Print final results
    results.print_summary()
    
    return len(results.critical_issues) == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)