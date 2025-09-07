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
        print(f"SHINE AUTH v3.0 TEST SUMMARY")
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
            if "message" in data and "v3.0" in data["message"]:
                results.add_result("API Health Check", True, f"API v3.0 accessible: {data['message']}")
                return True
        except:
            pass
    
    results.add_result("API Health Check", False, f"API not accessible. Status: {response.status_code if response else 'No response'}")
    return False

# ===== ENHANCED SIGNUP TESTS =====

def test_customer_signup_enhanced(results):
    """Test enhanced customer signup with all fields"""
    test_email = f"customer_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"customer_{uuid.uuid4().hex[:8]}"
    test_phone = "+14155552671"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": test_phone,
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            # Check response structure
            required_fields = ["token", "user"]
            if all(field in resp_data for field in required_fields):
                user = resp_data["user"]
                
                # Verify user data
                if (user["email"] == test_email and 
                    user["username"] == test_username and
                    user["role"] == "customer" and
                    user["phone"] == test_phone and
                    user["partner_status"] is None and
                    user["mfa_enabled"] is False):
                    
                    results.add_result("Enhanced Customer Signup", True, f"Customer registered with all fields: {test_email}")
                    return resp_data["token"], test_email, test_username
                else:
                    results.add_result("Enhanced Customer Signup", False, f"Invalid user data in response: {user}")
            else:
                results.add_result("Enhanced Customer Signup", False, f"Missing required fields in response: {resp_data}")
        except Exception as e:
            results.add_result("Enhanced Customer Signup", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Enhanced Customer Signup", False, f"Signup failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email, None

def test_partner_signup_enhanced(results):
    """Test enhanced partner signup with all required fields"""
    test_email = f"partner_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"partner_{uuid.uuid4().hex[:8]}"
    test_phone = "+14155552672"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "partner",
        "phone": test_phone,
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            
            # Verify partner-specific data
            if (user["email"] == test_email and 
                user["username"] == test_username and
                user["role"] == "partner" and
                user["phone"] == test_phone and
                user["partner_status"] == "pending" and
                user["mfa_enabled"] is False):
                
                results.add_result("Enhanced Partner Signup", True, f"Partner registered with pending status: {test_email}")
                return resp_data["token"], test_email, test_username
            else:
                results.add_result("Enhanced Partner Signup", False, f"Partner status not set correctly: {user}")
        except Exception as e:
            results.add_result("Enhanced Partner Signup", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Enhanced Partner Signup", False, f"Partner signup failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email, None

def test_owner_signup_enhanced(results):
    """Test enhanced owner signup with MFA enabled"""
    test_email = f"owner_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"owner_{uuid.uuid4().hex[:8]}"
    test_phone = "+14155552673"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "owner",
        "phone": test_phone,
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            user = resp_data["user"]
            
            # Verify owner-specific data
            if (user["email"] == test_email and 
                user["username"] == test_username and
                user["role"] == "owner" and
                user["phone"] == test_phone and
                user["partner_status"] is None and
                user["mfa_enabled"] is True):
                
                results.add_result("Enhanced Owner Signup", True, f"Owner registered with MFA enabled: {test_email}")
                return resp_data["token"], test_email, test_username
            else:
                results.add_result("Enhanced Owner Signup", False, f"Owner MFA not enabled correctly: {user}")
        except Exception as e:
            results.add_result("Enhanced Owner Signup", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Enhanced Owner Signup", False, f"Owner signup failed. Status: {response.status_code if response else 'No response'}")
    
    return None, test_email, None

# ===== VALIDATION TESTS =====

def test_password_validation(results):
    """Test strong password validation"""
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    
    weak_passwords = [
        "weak",  # Too short
        "weakpassword",  # No uppercase, digit, special
        "WeakPassword",  # No digit, special
        "WeakPassword123",  # No special character
        "WeakPassword!",  # No digit
        "WEAKPASSWORD123!",  # No lowercase
        "a" * 65 + "A1!"  # Too long (over 64 chars)
    ]
    
    for weak_password in weak_passwords:
        data = {
            "email": test_email,
            "password": weak_password,
            "role": "customer",
            "accept_tos": True
        }
        
        response = make_request("POST", "/auth/signup", data)
        
        if response and response.status_code == 422:
            try:
                error_data = response.json()
                if "password" in str(error_data).lower():
                    continue  # This weak password was properly rejected
            except:
                pass
        
        results.add_result("Password Validation", False, f"Weak password not rejected: {weak_password}")
        return
    
    results.add_result("Password Validation", True, "All weak passwords properly rejected")

def test_username_validation(results):
    """Test username validation"""
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    
    invalid_usernames = [
        "ab",  # Too short
        "a" * 31,  # Too long
        "user-name",  # Invalid character (hyphen)
        "user name",  # Space
        "user@name",  # Special character
        "123user!",  # Special character
    ]
    
    for invalid_username in invalid_usernames:
        data = {
            "email": test_email,
            "username": invalid_username,
            "password": "SecurePass123!",
            "role": "customer",
            "accept_tos": True
        }
        
        response = make_request("POST", "/auth/signup", data)
        
        if response and response.status_code == 422:
            try:
                error_data = response.json()
                if "username" in str(error_data).lower():
                    continue  # This invalid username was properly rejected
            except:
                pass
        
        results.add_result("Username Validation", False, f"Invalid username not rejected: {invalid_username}")
        return
    
    results.add_result("Username Validation", True, "All invalid usernames properly rejected")

def test_phone_validation(results):
    """Test phone number validation (E.164 format)"""
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    
    invalid_phones = [
        "1234567890",  # No + prefix
        "+1",  # Too short
        "+123456789012345678",  # Too long
        "+0123456789",  # Starts with 0 after +
        "123-456-7890",  # Invalid format
        "+1 415 555 2671",  # Spaces
    ]
    
    for invalid_phone in invalid_phones:
        data = {
            "email": test_email,
            "phone": invalid_phone,
            "password": "SecurePass123!",
            "role": "customer",
            "accept_tos": True
        }
        
        response = make_request("POST", "/auth/signup", data)
        
        if response and response.status_code == 422:
            try:
                error_data = response.json()
                if "phone" in str(error_data).lower():
                    continue  # This invalid phone was properly rejected
            except:
                pass
        
        results.add_result("Phone Validation", False, f"Invalid phone not rejected: {invalid_phone}")
        return
    
    results.add_result("Phone Validation", True, "All invalid phone numbers properly rejected")

def test_tos_validation(results):
    """Test Terms of Service acceptance requirement"""
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": False  # Not accepting ToS
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 422:
        try:
            error_data = response.json()
            if "terms" in str(error_data).lower() or "tos" in str(error_data).lower():
                results.add_result("ToS Validation", True, "ToS acceptance requirement enforced")
                return
        except:
            pass
    
    results.add_result("ToS Validation", False, f"ToS acceptance not enforced. Status: {response.status_code if response else 'No response'}")

def test_duplicate_email_handling(results):
    """Test duplicate email handling (409)"""
    test_email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
    
    # First signup
    data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response1 = make_request("POST", "/auth/signup", data)
    
    if response1 and response1.status_code == 200:
        # Second signup with same email
        response2 = make_request("POST", "/auth/signup", data)
        
        if response2 and response2.status_code == 409:
            try:
                error_data = response2.json()
                if "email" in error_data.get("detail", "").lower():
                    results.add_result("Duplicate Email Handling", True, "Duplicate email properly rejected with 409")
                    return
            except:
                pass
        
        results.add_result("Duplicate Email Handling", False, f"Duplicate email not handled correctly. Status: {response2.status_code if response2 else 'No response'}")
    else:
        results.add_result("Duplicate Email Handling", False, "Could not create initial user for duplicate test")

def test_duplicate_username_handling(results):
    """Test duplicate username handling (409)"""
    test_username = f"duplicate_{uuid.uuid4().hex[:8]}"
    
    # First signup
    data1 = {
        "email": f"user1_{uuid.uuid4().hex[:8]}@example.com",
        "username": test_username,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response1 = make_request("POST", "/auth/signup", data1)
    
    if response1 and response1.status_code == 200:
        # Second signup with same username
        data2 = {
            "email": f"user2_{uuid.uuid4().hex[:8]}@example.com",
            "username": test_username,
            "password": "SecurePass123!",
            "role": "customer",
            "accept_tos": True
        }
        
        response2 = make_request("POST", "/auth/signup", data2)
        
        if response2 and response2.status_code == 409:
            try:
                error_data = response2.json()
                if "username" in error_data.get("detail", "").lower():
                    results.add_result("Duplicate Username Handling", True, "Duplicate username properly rejected with 409")
                    return
            except:
                pass
        
        results.add_result("Duplicate Username Handling", False, f"Duplicate username not handled correctly. Status: {response2.status_code if response2 else 'No response'}")
    else:
        results.add_result("Duplicate Username Handling", False, "Could not create initial user for duplicate username test")

# ===== ENHANCED LOGIN TESTS =====

def test_login_with_email(results, email, password="SecurePass123!"):
    """Test login with email identifier"""
    data = {
        "identifier": email,
        "password": password
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            # Check if it's a regular login or MFA required
            if "token" in resp_data and "user" in resp_data:
                results.add_result("Login with Email", True, f"Email login successful: {email}")
                return resp_data["token"]
            elif resp_data.get("mfa_required") is True:
                results.add_result("Login with Email", True, f"Email login successful (MFA required): {email}")
                return resp_data  # Return MFA response
            else:
                results.add_result("Login with Email", False, f"Invalid login response structure: {resp_data}")
        except Exception as e:
            results.add_result("Login with Email", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Login with Email", False, f"Email login failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_login_with_username(results, username, password="SecurePass123!"):
    """Test login with username identifier"""
    data = {
        "identifier": username,
        "password": password
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            # Check if it's a regular login or MFA required
            if "token" in resp_data and "user" in resp_data:
                results.add_result("Login with Username", True, f"Username login successful: {username}")
                return resp_data["token"]
            elif resp_data.get("mfa_required") is True:
                results.add_result("Login with Username", True, f"Username login successful (MFA required): {username}")
                return resp_data  # Return MFA response
            else:
                results.add_result("Login with Username", False, f"Invalid login response structure: {resp_data}")
        except Exception as e:
            results.add_result("Login with Username", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Login with Username", False, f"Username login failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_invalid_credentials(results):
    """Test invalid credentials (401)"""
    data = {
        "identifier": "nonexistent@example.com",
        "password": "wrongpassword"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 401:
        try:
            error_data = response.json()
            if "credentials" in error_data.get("detail", "").lower():
                results.add_result("Invalid Credentials Handling", True, "Invalid credentials properly rejected with 401")
                return
        except:
            pass
    
    results.add_result("Invalid Credentials Handling", False, f"Invalid credentials not handled correctly. Status: {response.status_code if response else 'No response'}")

# ===== MFA TESTS =====

def test_owner_mfa_flow(results, owner_email, password="SecurePass123!"):
    """Test complete owner MFA flow"""
    # Step 1: Login should return MFA required
    data = {
        "identifier": owner_email,
        "password": password
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("mfa_required") is True and "user_id" in resp_data and "dev_mfa_code" in resp_data:
                user_id = resp_data["user_id"]
                mfa_code = resp_data["dev_mfa_code"]
                results.add_result("Owner MFA Required", True, f"MFA code generated for owner: {mfa_code}")
                
                # Step 2: Verify MFA code
                return test_mfa_verification(results, user_id, mfa_code)
            else:
                results.add_result("Owner MFA Required", False, f"MFA not required for owner: {resp_data}")
        except Exception as e:
            results.add_result("Owner MFA Required", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Owner MFA Required", False, f"Owner login failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_mfa_verification(results, user_id, mfa_code):
    """Test MFA code verification"""
    data = {
        "user_id": user_id,
        "code": mfa_code
    }
    
    response = make_request("POST", "/auth/mfa/verify", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True and "token" in resp_data and "user" in resp_data:
                results.add_result("MFA Verification", True, f"MFA verification successful")
                return resp_data["token"]
            else:
                results.add_result("MFA Verification", False, f"Invalid MFA response structure: {resp_data}")
        except Exception as e:
            results.add_result("MFA Verification", False, f"JSON parsing error: {e}")
    else:
        results.add_result("MFA Verification", False, f"MFA verification failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_invalid_mfa_code(results, user_id):
    """Test invalid MFA code handling"""
    data = {
        "user_id": user_id,
        "code": "000000"  # Invalid code
    }
    
    response = make_request("POST", "/auth/mfa/verify", data)
    
    if response and response.status_code == 400:
        try:
            error_data = response.json()
            if "invalid" in error_data.get("detail", "").lower() or "code" in error_data.get("detail", "").lower():
                results.add_result("Invalid MFA Code Handling", True, "Invalid MFA code properly rejected")
                return
        except:
            pass
    
    results.add_result("Invalid MFA Code Handling", False, f"Invalid MFA code not handled correctly. Status: {response.status_code if response else 'No response'}")

# ===== PASSWORD RESET TESTS =====

def test_password_reset_start_email(results, email):
    """Test password reset start with email"""
    data = {
        "email_or_phone": email
    }
    
    response = make_request("POST", "/auth/reset/start", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("sent") is True and resp_data.get("channel") == "email":
                results.add_result("Password Reset Start (Email)", True, f"Reset OTP sent via email: {email}")
                return True
            else:
                results.add_result("Password Reset Start (Email)", False, f"Invalid reset response: {resp_data}")
        except Exception as e:
            results.add_result("Password Reset Start (Email)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Password Reset Start (Email)", False, f"Reset start failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_password_reset_start_phone(results, phone):
    """Test password reset start with phone"""
    data = {
        "email_or_phone": phone
    }
    
    response = make_request("POST", "/auth/reset/start", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("sent") is True and resp_data.get("channel") == "sms":
                results.add_result("Password Reset Start (Phone)", True, f"Reset OTP sent via SMS: {phone}")
                return True
            else:
                results.add_result("Password Reset Start (Phone)", False, f"Invalid reset response: {resp_data}")
        except Exception as e:
            results.add_result("Password Reset Start (Phone)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Password Reset Start (Phone)", False, f"Reset start failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_password_reset_verify(results, email, new_password="NewSecurePass123!"):
    """Test password reset verification (simulated OTP)"""
    # Note: In a real test, we'd need the actual OTP from logs or email
    # For this test, we'll simulate with a known pattern
    data = {
        "email_or_phone": email,
        "otp": "123456",  # This would fail in real scenario
        "new_password": new_password
    }
    
    response = make_request("POST", "/auth/reset/verify", data)
    
    # We expect this to fail with invalid OTP since we don't have the real OTP
    if response and response.status_code == 400:
        try:
            error_data = response.json()
            if "otp" in error_data.get("detail", "").lower() or "invalid" in error_data.get("detail", "").lower():
                results.add_result("Password Reset Verify (Invalid OTP)", True, "Invalid OTP properly rejected")
                return
        except:
            pass
    
    results.add_result("Password Reset Verify (Invalid OTP)", False, f"Invalid OTP handling failed. Status: {response.status_code if response else 'No response'}")

# ===== UTILITY TESTS =====

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
            
            if "token" in resp_data and "user" in resp_data:
                user = resp_data["user"]
                if user["role"] == "customer":
                    results.add_result("Partner Role Switching", True, f"Partner successfully switched to customer role")
                    return resp_data["token"]
                else:
                    results.add_result("Partner Role Switching", False, f"Role not switched correctly: {user}")
            else:
                results.add_result("Partner Role Switching", False, f"Invalid role switch response: {resp_data}")
        except Exception as e:
            results.add_result("Partner Role Switching", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Role Switching", False, f"Role switching failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def main():
    """Run all SHINE Auth v3.0 tests"""
    print("🚀 Starting SHINE Auth v3.0 Backend Comprehensive Tests")
    print(f"Testing API at: {BASE_URL}")
    print("="*60)
    
    results = TestResults()
    
    # Test API health
    if not test_api_health(results):
        print("❌ API is not accessible. Stopping tests.")
        results.print_summary()
        return False
    
    print("\n📝 TESTING ENHANCED SIGNUP ENDPOINTS...")
    
    # Test enhanced signup with all validation
    customer_token, customer_email, customer_username = test_customer_signup_enhanced(results)
    partner_token, partner_email, partner_username = test_partner_signup_enhanced(results)
    owner_token, owner_email, owner_username = test_owner_signup_enhanced(results)
    
    print("\n🔒 TESTING VALIDATION RULES...")
    
    # Test all validation rules
    test_password_validation(results)
    test_username_validation(results)
    test_phone_validation(results)
    test_tos_validation(results)
    test_duplicate_email_handling(results)
    test_duplicate_username_handling(results)
    
    print("\n🔑 TESTING ENHANCED LOGIN ENDPOINTS...")
    
    # Test enhanced login with email and username identifiers
    if customer_email and customer_username:
        customer_login_token = test_login_with_email(results, customer_email)
        test_login_with_username(results, customer_username)
    
    if partner_email and partner_username:
        partner_login_token = test_login_with_email(results, partner_email)
        test_login_with_username(results, partner_username)
    
    # Test invalid credentials
    test_invalid_credentials(results)
    
    print("\n🛡️ TESTING MFA FLOW...")
    
    # Test owner MFA flow
    if owner_email:
        owner_mfa_token = test_owner_mfa_flow(results, owner_email)
        # Test invalid MFA code (we need user_id for this, but it's complex to get)
    
    print("\n🔄 TESTING PASSWORD RESET FLOW...")
    
    # Test password reset flow
    if customer_email:
        test_password_reset_start_email(results, customer_email)
    
    if partner_email and partner_username:
        # Get phone from signup data
        test_phone = "+14155552672"  # From partner signup
        test_password_reset_start_phone(results, test_phone)
    
    # Test reset verification with invalid OTP
    if customer_email:
        test_password_reset_verify(results, customer_email)
    
    print("\n🔧 TESTING UTILITY ENDPOINTS...")
    
    # Test JWT token validation
    if customer_token:
        test_get_current_user(results, customer_token)
    
    test_invalid_token(results)
    
    # Test role switching
    if partner_token:
        switched_token = test_partner_role_switching(results, partner_token)
    
    # Print final results
    results.print_summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)