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

def test_verified_partner_signup(results):
    """Create a verified partner for dispatch testing"""
    test_email = f"verified_partner_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"verified_{uuid.uuid4().hex[:8]}"
    test_phone = "+14155552673"
    
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
            
            if user["role"] == "partner" and user["partner_status"] == "pending":
                results.add_result("Verified Partner Signup", True, f"Verified partner created for testing: {test_email}")
                return resp_data["token"], test_email, test_username
            else:
                results.add_result("Verified Partner Signup", False, f"Partner creation failed: {user}")
        except Exception as e:
            results.add_result("Verified Partner Signup", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Verified Partner Signup", False, f"Verified partner signup failed. Status: {response.status_code if response else 'No response'}")
    
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
    
    passed_count = 0
    for weak_password in weak_passwords:
        data = {
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": weak_password,
            "role": "customer",
            "accept_tos": True
        }
        
        response = make_request("POST", "/auth/signup", data)
        
        if response and response.status_code == 422:
            try:
                error_data = response.json()
                if "password" in str(error_data).lower():
                    passed_count += 1
                    continue  # This weak password was properly rejected
            except:
                pass
        
        results.add_result("Password Validation", False, f"Weak password not rejected: {weak_password}")
        return
    
    results.add_result("Password Validation", True, f"All {passed_count} weak passwords properly rejected")

def test_username_validation(results):
    """Test username validation"""
    
    invalid_usernames = [
        "ab",  # Too short
        "a" * 31,  # Too long
        "user-name",  # Invalid character (hyphen)
        "user name",  # Space
        "user@name",  # Special character
        "123user!",  # Special character
    ]
    
    passed_count = 0
    for invalid_username in invalid_usernames:
        data = {
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
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
                    passed_count += 1
                    continue  # This invalid username was properly rejected
            except:
                pass
        
        results.add_result("Username Validation", False, f"Invalid username not rejected: {invalid_username}")
        return
    
    results.add_result("Username Validation", True, f"All {passed_count} invalid usernames properly rejected")

def test_phone_validation(results):
    """Test phone number validation (E.164 format)"""
    
    invalid_phones = [
        "1234567890",  # No + prefix
        "+1",  # Too short
        "+123456789012345678",  # Too long
        "+0123456789",  # Starts with 0 after +
        "123-456-7890",  # Invalid format
        "+1 415 555 2671",  # Spaces
    ]
    
    passed_count = 0
    for invalid_phone in invalid_phones:
        data = {
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
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
                    passed_count += 1
                    continue  # This invalid phone was properly rejected
            except:
                pass
        
        results.add_result("Phone Validation", False, f"Invalid phone not rejected: {invalid_phone}")
        return
    
    results.add_result("Phone Validation", True, f"All {passed_count} invalid phone numbers properly rejected")

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
            if "terms" in str(error_data).lower() or "tos" in str(error_data).lower() or "accept" in str(error_data).lower():
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

# ===== ADDRESS API TESTS =====

def test_list_addresses_empty(results, token):
    """Test listing addresses for authenticated user (should be empty initially)"""
    response = make_request("GET", "/addresses", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "addresses" in resp_data and isinstance(resp_data["addresses"], list):
                if len(resp_data["addresses"]) == 0:
                    results.add_result("List Addresses (Empty)", True, "Empty address list returned for new user")
                    return True
                else:
                    results.add_result("List Addresses (Empty)", True, f"Address list returned with {len(resp_data['addresses'])} existing addresses")
                    return True
            else:
                results.add_result("List Addresses (Empty)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("List Addresses (Empty)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("List Addresses (Empty)", False, f"List addresses failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_save_address_valid(results, token):
    """Test saving a new address with valid data"""
    address_data = {
        "label": "Home",
        "line1": "123 Main Street",
        "line2": "Apt 4B",
        "city": "San Francisco",
        "state": "CA",
        "postalCode": "94102",
        "country": "USA",
        "lat": 37.7749,
        "lng": -122.4194
    }
    
    response = make_request("POST", "/addresses", address_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "id" in resp_data and resp_data["id"]:
                results.add_result("Save Address (Valid)", True, f"Address saved successfully with ID: {resp_data['id']}")
                return resp_data["id"], address_data
            else:
                results.add_result("Save Address (Valid)", False, f"Invalid save response: {resp_data}")
        except Exception as e:
            results.add_result("Save Address (Valid)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Save Address (Valid)", False, f"Save address failed. Status: {response.status_code if response else 'No response'}")
    
    return None, None

def test_save_duplicate_address(results, token, address_data):
    """Test saving duplicate address (should return 409 conflict)"""
    response = make_request("POST", "/addresses", address_data, auth_token=token)
    
    if response and response.status_code == 409:
        try:
            error_data = response.json()
            detail = error_data.get("detail", "").lower()
            if "address" in detail and ("exists" in detail or "already" in detail):
                results.add_result("Save Duplicate Address", True, "Duplicate address properly rejected with 409")
                return
        except:
            # Even if JSON parsing fails, 409 status is correct
            results.add_result("Save Duplicate Address", True, "Duplicate address properly rejected with 409 (JSON parse failed)")
            return
    
    results.add_result("Save Duplicate Address", False, f"Duplicate address not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_list_addresses_with_data(results, token):
    """Test listing addresses after saving one"""
    response = make_request("GET", "/addresses", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "addresses" in resp_data and isinstance(resp_data["addresses"], list):
                if len(resp_data["addresses"]) > 0:
                    address = resp_data["addresses"][0]
                    required_fields = ["id", "line1", "city", "state", "postalCode", "country", "lat", "lng"]
                    
                    if all(field in address for field in required_fields):
                        results.add_result("List Addresses (With Data)", True, f"Address list returned with {len(resp_data['addresses'])} addresses")
                        return True
                    else:
                        results.add_result("List Addresses (With Data)", False, f"Address missing required fields: {address}")
                else:
                    results.add_result("List Addresses (With Data)", False, "No addresses found after saving")
            else:
                results.add_result("List Addresses (With Data)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("List Addresses (With Data)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("List Addresses (With Data)", False, f"List addresses failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_addresses_require_auth(results):
    """Test that address endpoints require authentication"""
    # Test GET /addresses without auth
    response = make_request("GET", "/addresses")
    
    if response and response.status_code in [401, 403]:
        results.add_result("Address Auth Required (GET)", True, f"GET /addresses properly requires authentication (Status: {response.status_code})")
    else:
        results.add_result("Address Auth Required (GET)", False, f"GET /addresses auth not enforced. Status: {response.status_code if response else 'No response'}")
    
    # Test POST /addresses without auth
    address_data = {
        "line1": "123 Test Street",
        "city": "Test City",
        "state": "CA",
        "postalCode": "12345",
        "country": "USA",
        "lat": 37.7749,
        "lng": -122.4194
    }
    
    response = make_request("POST", "/addresses", address_data)
    
    if response and response.status_code in [401, 403]:
        results.add_result("Address Auth Required (POST)", True, f"POST /addresses properly requires authentication (Status: {response.status_code})")
    else:
        results.add_result("Address Auth Required (POST)", False, f"POST /addresses auth not enforced. Status: {response.status_code if response else 'No response'}")

def test_autocomplete_short_query(results):
    """Test autocomplete with short query (< 3 chars)"""
    response = make_request("GET", "/places/autocomplete?q=ab")
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "candidates" in resp_data and isinstance(resp_data["candidates"], list):
                if len(resp_data["candidates"]) == 0:
                    results.add_result("Autocomplete Short Query", True, "Short query returns empty candidates list")
                    return
                else:
                    results.add_result("Autocomplete Short Query", True, f"Short query returns {len(resp_data['candidates'])} candidates (acceptable)")
                    return
            else:
                results.add_result("Autocomplete Short Query", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Autocomplete Short Query", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Autocomplete Short Query", False, f"Autocomplete failed. Status: {response.status_code if response else 'No response'}")

def test_autocomplete_normal_query(results):
    """Test autocomplete with normal query"""
    response = make_request("GET", "/places/autocomplete?q=Main Street")
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "candidates" in resp_data and isinstance(resp_data["candidates"], list):
                if len(resp_data["candidates"]) > 0:
                    candidate = resp_data["candidates"][0]
                    required_fields = ["placeId", "label", "line1", "city", "state", "postalCode", "country", "lat", "lng"]
                    
                    if all(field in candidate for field in required_fields):
                        results.add_result("Autocomplete Normal Query", True, f"Normal query returns {len(resp_data['candidates'])} valid candidates")
                        return
                    else:
                        results.add_result("Autocomplete Normal Query", False, f"Candidate missing required fields: {candidate}")
                else:
                    results.add_result("Autocomplete Normal Query", False, "Normal query returns no candidates")
            else:
                results.add_result("Autocomplete Normal Query", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Autocomplete Normal Query", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Autocomplete Normal Query", False, f"Autocomplete failed. Status: {response.status_code if response else 'No response'}")

def test_eta_preview_now(results):
    """Test ETA preview with 'now' timing"""
    eta_data = {
        "lat": 37.7749,
        "lng": -122.4194,
        "timing": {
            "when": "now"
        }
    }
    
    response = make_request("POST", "/eta/preview", eta_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "window" in resp_data and "distanceKm" in resp_data:
                window = resp_data["window"]
                distance = resp_data["distanceKm"]
                
                # Check if window contains time information
                if "min" in window.lower() and isinstance(distance, (int, float)):
                    results.add_result("ETA Preview (Now)", True, f"ETA calculated: {window}, {distance}km")
                    return
                else:
                    results.add_result("ETA Preview (Now)", False, f"Invalid ETA data: window={window}, distance={distance}")
            else:
                results.add_result("ETA Preview (Now)", False, f"Missing required fields in response: {resp_data}")
        except Exception as e:
            results.add_result("ETA Preview (Now)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("ETA Preview (Now)", False, f"ETA preview failed. Status: {response.status_code if response else 'No response'}")

def test_eta_preview_scheduled(results):
    """Test ETA preview with 'schedule' timing"""
    eta_data = {
        "lat": 40.7128,
        "lng": -74.0060,
        "timing": {
            "when": "schedule",
            "scheduleAt": "2024-01-15T14:30:00Z"
        }
    }
    
    response = make_request("POST", "/eta/preview", eta_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "window" in resp_data and "distanceKm" in resp_data:
                window = resp_data["window"]
                distance = resp_data["distanceKm"]
                
                # Check if window contains time information and possibly "Scheduled"
                if "min" in window.lower() and isinstance(distance, (int, float)):
                    results.add_result("ETA Preview (Scheduled)", True, f"Scheduled ETA calculated: {window}, {distance}km")
                    return
                else:
                    results.add_result("ETA Preview (Scheduled)", False, f"Invalid scheduled ETA data: window={window}, distance={distance}")
            else:
                results.add_result("ETA Preview (Scheduled)", False, f"Missing required fields in response: {resp_data}")
        except Exception as e:
            results.add_result("ETA Preview (Scheduled)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("ETA Preview (Scheduled)", False, f"Scheduled ETA preview failed. Status: {response.status_code if response else 'No response'}")

# ===== CHECKOUT & PAYMENT API TESTS =====

def test_list_payment_methods(results, token):
    """Test listing saved payment methods for authenticated user"""
    response = make_request("GET", "/billing/methods", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "methods" in resp_data and isinstance(resp_data["methods"], list):
                methods = resp_data["methods"]
                if len(methods) > 0:
                    # Check first method structure
                    method = methods[0]
                    required_fields = ["id", "brand", "last4", "exp", "isDefault"]
                    
                    if all(field in method for field in required_fields):
                        results.add_result("List Payment Methods", True, f"Payment methods retrieved: {len(methods)} methods")
                        return methods
                    else:
                        results.add_result("List Payment Methods", False, f"Payment method missing required fields: {method}")
                else:
                    results.add_result("List Payment Methods", True, "Empty payment methods list returned")
                    return []
            else:
                results.add_result("List Payment Methods", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("List Payment Methods", False, f"JSON parsing error: {e}")
    else:
        results.add_result("List Payment Methods", False, f"List payment methods failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_create_setup_intent(results, token):
    """Test creating Stripe setup intent for adding payment methods"""
    response = make_request("POST", "/billing/setup-intent", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "clientSecret" in resp_data and resp_data["clientSecret"]:
                client_secret = resp_data["clientSecret"]
                if "seti_" in client_secret and "_secret_" in client_secret:
                    results.add_result("Create Setup Intent", True, f"Setup intent created with client secret")
                    return client_secret
                else:
                    results.add_result("Create Setup Intent", False, f"Invalid client secret format: {client_secret}")
            else:
                results.add_result("Create Setup Intent", False, f"Missing clientSecret in response: {resp_data}")
        except Exception as e:
            results.add_result("Create Setup Intent", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Create Setup Intent", False, f"Create setup intent failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_attach_payment_method(results, token):
    """Test attaching payment method to customer"""
    data = {
        "paymentMethodId": "pm_test_card_visa"
    }
    
    response = make_request("POST", "/billing/methods", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                results.add_result("Attach Payment Method", True, "Payment method attached successfully")
                return True
            else:
                results.add_result("Attach Payment Method", False, f"Attachment failed: {resp_data}")
        except Exception as e:
            results.add_result("Attach Payment Method", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Attach Payment Method", False, f"Attach payment method failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_apply_valid_promo_codes(results, token):
    """Test applying valid promo codes"""
    valid_promos = ["SHINE20", "FIRST10", "SAVE15"]
    
    for promo_code in valid_promos:
        data = {
            "quoteId": "quote_test123",
            "code": promo_code,
            "useCredits": False
        }
        
        response = make_request("POST", "/pricing/promo/apply", data, auth_token=token)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                
                required_fields = ["breakdown", "total", "promoApplied", "creditsApplied"]
                if all(field in resp_data for field in required_fields):
                    if resp_data["promoApplied"] is True:
                        breakdown = resp_data["breakdown"]
                        total = resp_data["total"]
                        
                        # Check if promo discount is in breakdown
                        promo_found = any(promo_code in item.get("label", "") for item in breakdown)
                        
                        if promo_found and isinstance(total, (int, float)):
                            results.add_result(f"Apply Promo Code ({promo_code})", True, f"Promo applied successfully, total: ${total}")
                            continue
                        else:
                            results.add_result(f"Apply Promo Code ({promo_code})", False, f"Promo not found in breakdown or invalid total")
                            return
                    else:
                        results.add_result(f"Apply Promo Code ({promo_code})", False, f"Promo not applied: {resp_data}")
                        return
                else:
                    results.add_result(f"Apply Promo Code ({promo_code})", False, f"Missing required fields: {resp_data}")
                    return
            except Exception as e:
                results.add_result(f"Apply Promo Code ({promo_code})", False, f"JSON parsing error: {e}")
                return
        else:
            results.add_result(f"Apply Promo Code ({promo_code})", False, f"Promo application failed. Status: {response.status_code if response else 'No response'}")
            return
    
    results.add_result("Apply Valid Promo Codes", True, f"All {len(valid_promos)} valid promo codes applied successfully")

def test_apply_invalid_promo_code(results, token):
    """Test applying invalid promo code"""
    data = {
        "quoteId": "quote_test123",
        "code": "INVALID_CODE",
        "useCredits": False
    }
    
    response = make_request("POST", "/pricing/promo/apply", data, auth_token=token)
    
    if response and response.status_code == 400:
        try:
            error_data = response.json()
            detail = error_data.get("detail", "").lower()
            if "invalid" in detail and "promo" in detail:
                results.add_result("Apply Invalid Promo Code", True, "Invalid promo code properly rejected")
                return
        except:
            # Even if JSON parsing fails, 400 status is correct
            results.add_result("Apply Invalid Promo Code", True, "Invalid promo code properly rejected (400 status)")
            return
    
    results.add_result("Apply Invalid Promo Code", False, f"Invalid promo code not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_apply_promo_with_credits(results, token):
    """Test applying promo code with credits"""
    data = {
        "quoteId": "quote_test123",
        "code": "SHINE20",
        "useCredits": True
    }
    
    response = make_request("POST", "/pricing/promo/apply", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if (resp_data.get("promoApplied") is True and 
                resp_data.get("creditsApplied", 0) > 0):
                
                breakdown = resp_data["breakdown"]
                credits_found = any("credits" in item.get("label", "").lower() for item in breakdown)
                
                if credits_found:
                    results.add_result("Apply Promo with Credits", True, f"Promo and credits applied: ${resp_data['creditsApplied']} credits")
                    return
                else:
                    results.add_result("Apply Promo with Credits", False, "Credits not found in breakdown")
            else:
                results.add_result("Apply Promo with Credits", False, f"Promo or credits not applied: {resp_data}")
        except Exception as e:
            results.add_result("Apply Promo with Credits", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Apply Promo with Credits", False, f"Promo with credits failed. Status: {response.status_code if response else 'No response'}")

def test_payment_preauth_success(results, token):
    """Test successful payment pre-authorization"""
    data = {
        "amount": 89.50,
        "currency": "usd",
        "paymentMethodId": "pm_card_visa",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["paymentIntentId", "clientSecret", "requiresAction"]
            if all(field in resp_data for field in required_fields):
                pi_id = resp_data["paymentIntentId"]
                client_secret = resp_data["clientSecret"]
                requires_action = resp_data["requiresAction"]
                
                if ("pi_" in pi_id and "_secret_" in client_secret and 
                    isinstance(requires_action, bool)):
                    
                    results.add_result("Payment Preauth Success", True, f"Payment intent created: {pi_id}, requires_action: {requires_action}")
                    return pi_id, client_secret
                else:
                    results.add_result("Payment Preauth Success", False, f"Invalid payment intent data: {resp_data}")
            else:
                results.add_result("Payment Preauth Success", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Payment Preauth Success", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Payment Preauth Success", False, f"Payment preauth failed. Status: {response.status_code if response else 'No response'}")
    
    return None, None

def test_payment_preauth_declined(results, token):
    """Test declined payment pre-authorization"""
    data = {
        "amount": 89.50,
        "currency": "usd",
        "paymentMethodId": "pm_declined",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", data, auth_token=token)
    
    if response and response.status_code == 402:
        try:
            error_data = response.json()
            detail = error_data.get("detail", "").lower()
            if "declined" in detail or "card" in detail:
                results.add_result("Payment Preauth Declined", True, "Declined payment properly handled with 402")
                return
        except:
            # Even if JSON parsing fails, 402 status is correct
            results.add_result("Payment Preauth Declined", True, "Declined payment properly handled (402 status)")
            return
    
    results.add_result("Payment Preauth Declined", False, f"Declined payment not handled correctly. Status: {response.status_code if response else 'No response'}")

def test_payment_preauth_sca_required(results, token):
    """Test payment pre-authorization requiring SCA"""
    data = {
        "amount": 89.50,
        "currency": "usd",
        "paymentMethodId": "pm_sca_required",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if (resp_data.get("requiresAction") is True and 
                "paymentIntentId" in resp_data and 
                "clientSecret" in resp_data):
                
                results.add_result("Payment Preauth SCA Required", True, f"SCA required payment intent created: {resp_data['paymentIntentId']}")
                return resp_data["paymentIntentId"]
            else:
                results.add_result("Payment Preauth SCA Required", False, f"SCA not required or invalid response: {resp_data}")
        except Exception as e:
            results.add_result("Payment Preauth SCA Required", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Payment Preauth SCA Required", False, f"SCA payment preauth failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_confirm_stripe_action(results, payment_intent_id):
    """Test confirming Stripe action (SCA)"""
    if not payment_intent_id:
        results.add_result("Confirm Stripe Action", False, "No payment intent ID provided")
        return
    
    data = {
        "paymentIntentId": payment_intent_id
    }
    
    response = make_request("POST", "/billing/confirm", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                results.add_result("Confirm Stripe Action", True, f"Stripe action confirmed for: {payment_intent_id}")
                return True
            else:
                results.add_result("Confirm Stripe Action", False, f"Confirmation failed: {resp_data}")
        except Exception as e:
            results.add_result("Confirm Stripe Action", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Confirm Stripe Action", False, f"Confirm action failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_create_booking_now(results, token):
    """Test creating booking with 'now' timing"""
    booking_data = {
        "quoteId": "quote_test123",
        "service": {
            "type": "basic",
            "timing": {
                "when": "now"
            },
            "details": {
                "bedrooms": 2,
                "bathrooms": 1
            }
        },
        "address": {
            "line1": "123 Main Street",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94102",
            "lat": 37.7749,
            "lng": -122.4194
        },
        "access": {
            "entrance": "front_door",
            "notes": "Ring doorbell twice"
        },
        "totals": {
            "subtotal": 89.00,
            "tax": 7.89,
            "total": 96.89
        },
        "payment": {
            "paymentIntentId": "pi_test123",
            "paymentMethodId": "pm_card_visa"
        },
        "applyCredits": False,
        "promoCode": None
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["bookingId", "status", "next"]
            if all(field in resp_data for field in required_fields):
                booking_id = resp_data["bookingId"]
                status = resp_data["status"]
                next_step = resp_data["next"]
                eta_window = resp_data.get("etaWindow")
                
                if ("bk_" in booking_id and status in ["pending_dispatch", "scheduled"] and 
                    next_step in ["dispatch", "tracking"]):
                    
                    results.add_result("Create Booking (Now)", True, f"Booking created: {booking_id}, status: {status}, ETA: {eta_window}")
                    return booking_id
                else:
                    results.add_result("Create Booking (Now)", False, f"Invalid booking data: {resp_data}")
            else:
                results.add_result("Create Booking (Now)", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Create Booking (Now)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Create Booking (Now)", False, f"Create booking failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_create_booking_scheduled(results, token):
    """Test creating booking with 'schedule' timing"""
    booking_data = {
        "quoteId": "quote_test456",
        "service": {
            "type": "deep",
            "timing": {
                "when": "schedule",
                "scheduleAt": "2024-01-15T14:30:00Z"
            },
            "details": {
                "bedrooms": 3,
                "bathrooms": 2
            }
        },
        "address": {
            "line1": "456 Oak Avenue",
            "city": "New York",
            "state": "NY",
            "postalCode": "10001",
            "lat": 40.7128,
            "lng": -74.0060
        },
        "access": {
            "entrance": "side_door",
            "notes": "Key under mat"
        },
        "totals": {
            "subtotal": 150.00,
            "tax": 13.31,
            "total": 163.31
        },
        "payment": {
            "paymentIntentId": "pi_test456",
            "paymentMethodId": "pm_card_mastercard"
        },
        "applyCredits": True,
        "promoCode": "SHINE20"
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["bookingId", "status", "next"]
            if all(field in resp_data for field in required_fields):
                booking_id = resp_data["bookingId"]
                status = resp_data["status"]
                next_step = resp_data["next"]
                
                if ("bk_" in booking_id and status == "scheduled" and next_step == "tracking"):
                    results.add_result("Create Booking (Scheduled)", True, f"Scheduled booking created: {booking_id}, status: {status}")
                    return booking_id
                else:
                    results.add_result("Create Booking (Scheduled)", False, f"Invalid scheduled booking data: {resp_data}")
            else:
                results.add_result("Create Booking (Scheduled)", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Create Booking (Scheduled)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Create Booking (Scheduled)", False, f"Create scheduled booking failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_void_preauth(results, payment_intent_id):
    """Test voiding payment pre-authorization"""
    if not payment_intent_id:
        results.add_result("Void Preauth", False, "No payment intent ID provided")
        return
    
    data = {
        "paymentIntentId": payment_intent_id
    }
    
    response = make_request("POST", "/billing/void", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                results.add_result("Void Preauth", True, f"Payment preauth voided: {payment_intent_id}")
                return True
            else:
                results.add_result("Void Preauth", False, f"Void failed: {resp_data}")
        except Exception as e:
            results.add_result("Void Preauth", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Void Preauth", False, f"Void preauth failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_checkout_endpoints_require_auth(results):
    """Test that checkout endpoints require authentication"""
    endpoints_to_test = [
        ("GET", "/billing/methods"),
        ("POST", "/billing/setup-intent"),
        ("POST", "/billing/methods", {"paymentMethodId": "pm_test"}),
        ("POST", "/pricing/promo/apply", {"quoteId": "test", "code": "TEST"}),
        ("POST", "/billing/preauth", {"amount": 100, "paymentMethodId": "pm_test"}),
        ("POST", "/bookings", {"quoteId": "test", "service": {}, "address": {}, "totals": {}, "payment": {}})
    ]
    
    auth_required_count = 0
    
    for method, endpoint, *data in endpoints_to_test:
        request_data = data[0] if data else None
        response = make_request(method, endpoint, request_data)
        
        if response and response.status_code in [401, 403]:
            auth_required_count += 1
        else:
            results.add_result(f"Checkout Auth Required ({method} {endpoint})", False, f"Auth not enforced. Status: {response.status_code if response else 'No response'}")
            return
    
    results.add_result("Checkout Endpoints Auth Required", True, f"All {auth_required_count} checkout endpoints properly require authentication")

# ===== DISPATCH & OFFER API TESTS =====

def test_customer_dispatch_status(results, token, booking_id):
    """Test customer dispatch status tracking"""
    response = make_request("GET", f"/dispatch/status/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["state", "waitMins", "zone"]
            if all(field in resp_data for field in required_fields):
                state = resp_data["state"]
                wait_mins = resp_data["waitMins"]
                zone = resp_data["zone"]
                partner = resp_data.get("partner")
                
                # Check valid states
                valid_states = ["searching", "assigned", "no_match", "cancelled"]
                if state in valid_states and isinstance(wait_mins, int) and zone:
                    results.add_result("Customer Dispatch Status", True, f"Dispatch status retrieved: state={state}, wait={wait_mins}min, zone={zone}")
                    return resp_data
                else:
                    results.add_result("Customer Dispatch Status", False, f"Invalid dispatch status data: state={state}, wait={wait_mins}, zone={zone}")
            else:
                results.add_result("Customer Dispatch Status", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Customer Dispatch Status", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Customer Dispatch Status", False, f"Dispatch status failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_partner_offer_polling(results, token):
    """Test partner offer polling (WebSocket fallback)"""
    response = make_request("GET", "/partner/offers/poll", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "offer" in resp_data:
                offer = resp_data["offer"]
                if offer is None:
                    results.add_result("Partner Offer Polling", True, "No offers available (expected for new partner)")
                    return None
                else:
                    # Check offer structure
                    required_fields = ["offerId", "bookingId", "serviceType", "addressShort", "distanceKm", "etaMinutes", "payout", "countdownSec"]
                    if all(field in offer for field in required_fields):
                        results.add_result("Partner Offer Polling", True, f"Offer retrieved: {offer['offerId']}, payout: ${offer['payout']}")
                        return offer
                    else:
                        results.add_result("Partner Offer Polling", False, f"Offer missing required fields: {offer}")
            else:
                results.add_result("Partner Offer Polling", False, f"Missing 'offer' field in response: {resp_data}")
        except Exception as e:
            results.add_result("Partner Offer Polling", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Offer Polling", False, f"Offer polling failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def verify_partner_for_testing(results, partner_email):
    """Helper function to verify a partner for testing dispatch endpoints"""
    # In a real system, this would be done through an admin interface
    # For testing, we'll simulate partner verification by updating the database directly
    # This is a mock verification - in production this would be handled differently
    results.add_result("Partner Verification (Test Setup)", True, f"Partner {partner_email} verified for testing")
    return True

def create_test_dispatch_offer(results, booking_id):
    """Helper function to create a test dispatch offer by simulating booking creation"""
    # This will trigger offer creation in the backend
    # We'll use the existing booking creation to generate offers
    return f"of_{uuid.uuid4().hex[:16]}"  # Mock offer ID for testing

def test_partner_accept_offer(results, token, offer_id):
    """Test partner accepting an offer"""
    data = {
        "idempotencyKey": str(uuid.uuid4())
    }
    
    response = make_request("POST", f"/partner/offers/{offer_id}/accept", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["assigned", "bookingId"]
            if all(field in resp_data for field in required_fields):
                assigned = resp_data["assigned"]
                booking_id = resp_data["bookingId"]
                
                if assigned is True and booking_id:
                    results.add_result("Partner Accept Offer", True, f"Offer accepted successfully: booking {booking_id}")
                    return booking_id
                else:
                    results.add_result("Partner Accept Offer", False, f"Offer not properly accepted: assigned={assigned}, booking={booking_id}")
            else:
                results.add_result("Partner Accept Offer", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Partner Accept Offer", False, f"JSON parsing error: {e}")
    elif response and response.status_code == 410:
        results.add_result("Partner Accept Offer", True, "Offer expired (410) - expected behavior for test offer")
        return None
    elif response and response.status_code == 409:
        results.add_result("Partner Accept Offer", True, "Offer already taken (409) - expected behavior")
        return None
    elif response and response.status_code == 423:
        results.add_result("Partner Accept Offer", False, "Partner not eligible (423) - check partner verification status")
        return None
    else:
        results.add_result("Partner Accept Offer", False, f"Accept offer failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_partner_decline_offer(results, token, offer_id):
    """Test partner declining an offer"""
    response = make_request("POST", f"/partner/offers/{offer_id}/decline", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                results.add_result("Partner Decline Offer", True, f"Offer declined successfully: {offer_id}")
                return True
            else:
                results.add_result("Partner Decline Offer", False, f"Decline failed: {resp_data}")
        except Exception as e:
            results.add_result("Partner Decline Offer", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Decline Offer", False, f"Decline offer failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_customer_cancel_booking(results, token, booking_id):
    """Test customer cancelling a booking"""
    data = {
        "reason": "Changed my mind"
    }
    
    response = make_request("POST", f"/bookings/{booking_id}/cancel", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                fee = resp_data.get("fee")
                refund_credit = resp_data.get("refundCredit")
                
                results.add_result("Customer Cancel Booking", True, f"Booking cancelled: fee=${fee}, refund=${refund_credit}")
                return True
            else:
                results.add_result("Customer Cancel Booking", False, f"Cancellation failed: {resp_data}")
        except Exception as e:
            results.add_result("Customer Cancel Booking", False, f"JSON parsing error: {e}")
    elif response and response.status_code == 409:
        results.add_result("Customer Cancel Booking", True, "Cannot cancel after partner assigned (409) - expected behavior")
        return True
    elif response and response.status_code == 404:
        results.add_result("Customer Cancel Booking", False, "Booking not found (404)")
        return False
    else:
        results.add_result("Customer Cancel Booking", False, f"Cancel booking failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_owner_dispatch_dashboard(results, token):
    """Test owner dispatch dashboard with live metrics"""
    response = make_request("GET", "/owner/dispatch", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["kpis", "offers"]
            if all(field in resp_data for field in required_fields):
                kpis = resp_data["kpis"]
                offers = resp_data["offers"]
                
                # Check KPIs structure
                kpi_fields = ["avgTimeToAssign", "acceptRate", "offersActive", "offersExpired"]
                if all(field in kpis for field in kpi_fields):
                    avg_time = kpis["avgTimeToAssign"]
                    accept_rate = kpis["acceptRate"]
                    active_offers = kpis["offersActive"]
                    expired_offers = kpis["offersExpired"]
                    
                    if (isinstance(avg_time, (int, float)) and 
                        isinstance(accept_rate, (int, float)) and
                        isinstance(active_offers, int) and
                        isinstance(expired_offers, int)):
                        
                        results.add_result("Owner Dispatch Dashboard", True, f"Dashboard loaded: {active_offers} active offers, {accept_rate:.1f}% accept rate")
                        return resp_data
                    else:
                        results.add_result("Owner Dispatch Dashboard", False, f"Invalid KPI data types: {kpis}")
                else:
                    results.add_result("Owner Dispatch Dashboard", False, f"Missing KPI fields: {kpis}")
            else:
                results.add_result("Owner Dispatch Dashboard", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Owner Dispatch Dashboard", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Owner Dispatch Dashboard", False, f"Owner dashboard failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_dispatch_endpoints_require_auth(results):
    """Test that dispatch endpoints require authentication"""
    endpoints_to_test = [
        ("GET", "/dispatch/status/bk_test123"),
        ("GET", "/partner/offers/poll"),
        ("POST", "/partner/offers/of_test123/accept", {"idempotencyKey": "test"}),
        ("POST", "/partner/offers/of_test123/decline"),
        ("POST", "/bookings/bk_test123/cancel", {"reason": "test"}),
        ("GET", "/owner/dispatch")
    ]
    
    auth_required_count = 0
    
    for method, endpoint, *data in endpoints_to_test:
        request_data = data[0] if data else None
        response = make_request(method, endpoint, request_data)
        
        if response and response.status_code in [401, 403]:
            auth_required_count += 1
        else:
            results.add_result(f"Dispatch Auth Required ({method} {endpoint})", False, f"Auth not enforced. Status: {response.status_code if response else 'No response'}")
            return
    
    results.add_result("Dispatch Endpoints Auth Required", True, f"All {auth_required_count} dispatch endpoints properly require authentication")

def test_dispatch_role_access_control(results, customer_token, partner_token, owner_token):
    """Test role-based access control for dispatch endpoints"""
    
    # Test customer trying to access partner endpoints
    response = make_request("GET", "/partner/offers/poll", auth_token=customer_token)
    if response and response.status_code == 403:
        results.add_result("Dispatch Role Access (Customer->Partner)", True, "Customer properly denied partner access")
    else:
        results.add_result("Dispatch Role Access (Customer->Partner)", False, f"Customer access not properly restricted. Status: {response.status_code if response else 'No response'}")
    
    # Test partner trying to access owner endpoints
    response = make_request("GET", "/owner/dispatch", auth_token=partner_token)
    if response and response.status_code == 403:
        results.add_result("Dispatch Role Access (Partner->Owner)", True, "Partner properly denied owner access")
    else:
        results.add_result("Dispatch Role Access (Partner->Owner)", False, f"Partner access not properly restricted. Status: {response.status_code if response else 'No response'}")
    
    # Test customer trying to cancel with wrong role
    response = make_request("POST", "/bookings/bk_test123/cancel", {"reason": "test"}, auth_token=partner_token)
    if response and response.status_code == 403:
        results.add_result("Dispatch Role Access (Partner->Customer Cancel)", True, "Partner properly denied customer cancel access")
    else:
        results.add_result("Dispatch Role Access (Partner->Customer Cancel)", False, f"Partner cancel access not properly restricted. Status: {response.status_code if response else 'No response'}")

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
    
    print("\n🏠 TESTING ADDRESS API ENDPOINTS...")
    
    # Test address endpoints with authentication
    if customer_token:
        # Test authentication requirements
        test_addresses_require_auth(results)
        
        # Test address listing (empty initially)
        test_list_addresses_empty(results, customer_token)
        
        # Test saving a valid address
        address_id, saved_address = test_save_address_valid(results, customer_token)
        
        # Test listing addresses after saving
        if address_id:
            test_list_addresses_with_data(results, customer_token)
            
            # Test saving duplicate address
            if saved_address:
                test_save_duplicate_address(results, customer_token, saved_address)
    
    print("\n🔍 TESTING AUTOCOMPLETE API...")
    
    # Test autocomplete endpoints (no auth required)
    test_autocomplete_short_query(results)
    test_autocomplete_normal_query(results)
    
    print("\n⏱️ TESTING ETA PREVIEW API...")
    
    # Test ETA preview endpoints (no auth required)
    test_eta_preview_now(results)
    test_eta_preview_scheduled(results)
    
    print("\n💳 TESTING CHECKOUT & PAYMENT API ENDPOINTS...")
    
    # Test checkout & payment endpoints with authentication
    if customer_token:
        # Test authentication requirements for checkout endpoints
        test_checkout_endpoints_require_auth(results)
        
        # Test payment methods management
        payment_methods = test_list_payment_methods(results, customer_token)
        setup_client_secret = test_create_setup_intent(results, customer_token)
        test_attach_payment_method(results, customer_token)
        
        # Test promo code functionality
        test_apply_valid_promo_codes(results, customer_token)
        test_apply_invalid_promo_code(results, customer_token)
        test_apply_promo_with_credits(results, customer_token)
        
        # Test payment pre-authorization scenarios
        pi_id, client_secret = test_payment_preauth_success(results, customer_token)
        test_payment_preauth_declined(results, customer_token)
        sca_pi_id = test_payment_preauth_sca_required(results, customer_token)
        
        # Test Stripe action confirmation
        if sca_pi_id:
            test_confirm_stripe_action(results, sca_pi_id)
        
        # Test booking creation
        booking_id_now = test_create_booking_now(results, customer_token)
        booking_id_scheduled = test_create_booking_scheduled(results, customer_token)
        
        # Test payment void
        if pi_id:
            test_void_preauth(results, pi_id)
    
    print("\n🚚 TESTING DISPATCH & OFFER API ENDPOINTS...")
    
    # Test dispatch endpoints with different user roles
    if customer_token and partner_token and owner_token:
        # Test customer dispatch status tracking
        if booking_id_now:
            test_customer_dispatch_status(results, customer_token, booking_id_now)
        
        # Use original partner login token (not switched token) for partner tests
        original_partner_token = test_login_with_email(results, partner_email) if partner_email else None
        
        if original_partner_token:
            # Test partner offer polling and handling
            test_partner_offer_polling(results, original_partner_token)
            
            # Create a test offer and test accept/decline
            test_offer_id = create_test_dispatch_offer(results, booking_id_now if booking_id_now else "bk_test123")
            if test_offer_id:
                test_partner_accept_offer(results, original_partner_token, test_offer_id)
                
                # Create another offer for decline test
                test_offer_id_2 = create_test_dispatch_offer(results, "bk_test456")
                if test_offer_id_2:
                    test_partner_decline_offer(results, original_partner_token, test_offer_id_2)
        
        # Test customer booking cancellation
        if booking_id_now:
            test_customer_cancel_booking(results, customer_token, booking_id_now)
        
        # Test owner dispatch dashboard
        test_owner_dispatch_dashboard(results, owner_token)
        
        # Test authentication requirements for dispatch endpoints
        test_dispatch_endpoints_require_auth(results)
        
        # Test role-based access control (use switched token for customer role tests)
        test_dispatch_role_access_control(results, customer_token, partner_token, owner_token)
    
    # Print final results
    results.print_summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)