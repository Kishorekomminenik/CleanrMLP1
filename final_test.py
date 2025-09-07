#!/usr/bin/env python3
"""
Final comprehensive test for SHINE Auth v3.0 after fixes
"""

import requests
import json
import uuid
from datetime import datetime

BASE_URL = "https://home-dashboard-2.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

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

def test_mfa_verification_fix():
    """Test the MFA verification fix"""
    print("🛡️ TESTING MFA VERIFICATION FIX")
    print("="*60)
    
    # Create owner user
    owner_email = f"owner_mfa_test_{uuid.uuid4().hex[:8]}@example.com"
    owner_username = f"owner_mfa_test_{uuid.uuid4().hex[:8]}"
    
    owner_data = {
        "email": owner_email,
        "username": owner_username,
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155552673",
        "accept_tos": True
    }
    
    print("Creating owner user...")
    signup_response = make_request("POST", "/auth/signup", owner_data)
    
    if signup_response and signup_response.status_code == 200:
        print("✅ Owner created successfully")
        
        # Test owner login (should require MFA)
        login_data = {
            "identifier": owner_email,
            "password": "SecurePass123!"
        }
        
        print("Testing owner login (should require MFA)...")
        login_response = make_request("POST", "/auth/login", login_data)
        
        if login_response and login_response.status_code == 200:
            try:
                login_resp_data = login_response.json()
                
                if login_resp_data.get("mfa_required") is True and "user_id" in login_resp_data and "dev_mfa_code" in login_resp_data:
                    print("✅ MFA required for owner login")
                    
                    user_id = login_resp_data["user_id"]
                    mfa_code = login_resp_data["dev_mfa_code"]
                    
                    print(f"MFA code generated: {mfa_code}")
                    
                    # Test MFA verification
                    mfa_data = {
                        "user_id": user_id,
                        "code": mfa_code
                    }
                    
                    print("Testing MFA verification...")
                    mfa_response = make_request("POST", "/auth/mfa/verify", mfa_data)
                    
                    if mfa_response and mfa_response.status_code == 200:
                        try:
                            mfa_resp_data = mfa_response.json()
                            print(f"MFA Response: {json.dumps(mfa_resp_data, indent=2)}")
                            
                            # Check if response has all required fields
                            if (mfa_resp_data.get("ok") is True and 
                                "token" in mfa_resp_data and 
                                "user" in mfa_resp_data):
                                print("✅ MFA VERIFICATION FIX SUCCESSFUL - All required fields present")
                                return True
                            else:
                                print("❌ MFA verification response missing required fields")
                                return False
                        except Exception as e:
                            print(f"❌ MFA JSON parsing error: {e}")
                            return False
                    else:
                        print(f"❌ MFA verification failed. Status: {mfa_response.status_code if mfa_response else 'No response'}")
                        return False
                else:
                    print(f"❌ MFA not required for owner: {login_resp_data}")
                    return False
            except Exception as e:
                print(f"❌ Login JSON parsing error: {e}")
                return False
        else:
            print(f"❌ Owner login failed. Status: {login_response.status_code if login_response else 'No response'}")
            return False
    else:
        print(f"❌ Could not create owner user. Status: {signup_response.status_code if signup_response else 'No response'}")
        return False

def test_comprehensive_auth_flow():
    """Test comprehensive authentication flow"""
    print("\n🔐 TESTING COMPREHENSIVE AUTH FLOW")
    print("="*60)
    
    results = {
        "customer_signup": False,
        "partner_signup": False,
        "owner_signup": False,
        "email_login": False,
        "username_login": False,
        "jwt_validation": False,
        "password_reset": False,
        "role_switching": False
    }
    
    # Test Customer Signup
    customer_email = f"customer_final_{uuid.uuid4().hex[:8]}@example.com"
    customer_username = f"customer_final_{uuid.uuid4().hex[:8]}"
    
    customer_data = {
        "email": customer_email,
        "username": customer_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    print("1. Testing Customer Signup...")
    response = make_request("POST", "/auth/signup", customer_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results["customer_signup"] = True
                customer_token = resp_data["token"]
                print("✅ Customer signup successful")
            else:
                print("❌ Customer signup - invalid response")
                customer_token = None
        except:
            print("❌ Customer signup - JSON error")
            customer_token = None
    else:
        print(f"❌ Customer signup failed - Status: {response.status_code if response else 'No response'}")
        customer_token = None
    
    # Test Partner Signup
    partner_email = f"partner_final_{uuid.uuid4().hex[:8]}@example.com"
    partner_username = f"partner_final_{uuid.uuid4().hex[:8]}"
    
    partner_data = {
        "email": partner_email,
        "username": partner_username,
        "password": "SecurePass123!",
        "role": "partner",
        "phone": "+14155552672",
        "accept_tos": True
    }
    
    print("2. Testing Partner Signup...")
    response = make_request("POST", "/auth/signup", partner_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and resp_data["user"]["partner_status"] == "pending":
                results["partner_signup"] = True
                partner_token = resp_data["token"]
                print("✅ Partner signup successful with pending status")
            else:
                print("❌ Partner signup - invalid response")
                partner_token = None
        except:
            print("❌ Partner signup - JSON error")
            partner_token = None
    else:
        print(f"❌ Partner signup failed - Status: {response.status_code if response else 'No response'}")
        partner_token = None
    
    # Test Owner Signup
    owner_email = f"owner_final_{uuid.uuid4().hex[:8]}@example.com"
    owner_username = f"owner_final_{uuid.uuid4().hex[:8]}"
    
    owner_data = {
        "email": owner_email,
        "username": owner_username,
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155552673",
        "accept_tos": True
    }
    
    print("3. Testing Owner Signup...")
    response = make_request("POST", "/auth/signup", owner_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and resp_data["user"]["mfa_enabled"] is True:
                results["owner_signup"] = True
                print("✅ Owner signup successful with MFA enabled")
            else:
                print("❌ Owner signup - invalid response")
        except:
            print("❌ Owner signup - JSON error")
    else:
        print(f"❌ Owner signup failed - Status: {response.status_code if response else 'No response'}")
    
    # Test Email Login
    print("4. Testing Email Login...")
    login_data = {
        "identifier": customer_email,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results["email_login"] = True
                print("✅ Email login successful")
            else:
                print("❌ Email login - invalid response")
        except:
            print("❌ Email login - JSON error")
    else:
        print(f"❌ Email login failed - Status: {response.status_code if response else 'No response'}")
    
    # Test Username Login
    print("5. Testing Username Login...")
    login_data = {
        "identifier": customer_username,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                results["username_login"] = True
                print("✅ Username login successful")
            else:
                print("❌ Username login - invalid response")
        except:
            print("❌ Username login - JSON error")
    else:
        print(f"❌ Username login failed - Status: {response.status_code if response else 'No response'}")
    
    # Test JWT Validation
    if customer_token:
        print("6. Testing JWT Validation...")
        response = make_request("GET", "/auth/me", auth_token=customer_token)
        
        if response and response.status_code == 200:
            try:
                user_data = response.json()
                if "id" in user_data and "email" in user_data:
                    results["jwt_validation"] = True
                    print("✅ JWT validation successful")
                else:
                    print("❌ JWT validation - invalid response")
            except:
                print("❌ JWT validation - JSON error")
        else:
            print(f"❌ JWT validation failed - Status: {response.status_code if response else 'No response'}")
    
    # Test Password Reset
    print("7. Testing Password Reset...")
    reset_data = {
        "email_or_phone": customer_email
    }
    
    response = make_request("POST", "/auth/reset/start", reset_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("sent") is True:
                results["password_reset"] = True
                print("✅ Password reset successful")
            else:
                print("❌ Password reset - invalid response")
        except:
            print("❌ Password reset - JSON error")
    else:
        print(f"❌ Password reset failed - Status: {response.status_code if response else 'No response'}")
    
    # Test Role Switching
    if partner_token:
        print("8. Testing Role Switching...")
        response = make_request("POST", "/auth/switch-role", auth_token=partner_token)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "token" in resp_data and resp_data["user"]["role"] == "customer":
                    results["role_switching"] = True
                    print("✅ Role switching successful")
                else:
                    print("❌ Role switching - invalid response")
            except:
                print("❌ Role switching - JSON error")
        else:
            print(f"❌ Role switching failed - Status: {response.status_code if response else 'No response'}")
    
    return results

def main():
    """Run final comprehensive tests"""
    print("🚀 FINAL COMPREHENSIVE SHINE AUTH v3.0 TESTS")
    print("="*80)
    
    # Test MFA fix
    mfa_fixed = test_mfa_verification_fix()
    
    # Test comprehensive auth flow
    auth_results = test_comprehensive_auth_flow()
    
    # Print summary
    print(f"\n{'='*80}")
    print("FINAL TEST SUMMARY")
    print(f"{'='*80}")
    
    print(f"MFA Verification Fix: {'✅ FIXED' if mfa_fixed else '❌ STILL BROKEN'}")
    
    print("\nAuthentication Flow Results:")
    for test_name, result in auth_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name.replace('_', ' ').title()}: {status}")
    
    total_tests = len(auth_results) + 1  # +1 for MFA fix
    passed_tests = sum(auth_results.values()) + (1 if mfa_fixed else 0)
    
    print(f"\nOverall Results:")
    print(f"  Total Tests: {total_tests}")
    print(f"  Passed: {passed_tests}")
    print(f"  Failed: {total_tests - passed_tests}")
    print(f"  Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print(f"\n🎉 ALL TESTS PASSED - SHINE AUTH v3.0 IS FULLY FUNCTIONAL!")
        return True
    else:
        print(f"\n⚠️ Some tests failed - see details above")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)