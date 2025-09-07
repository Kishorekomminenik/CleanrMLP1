#!/usr/bin/env python3
"""
Final comprehensive authentication test for SHINE app
"""

import requests
import json
import uuid

BASE_URL = "https://home-dashboard-2.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_complete_auth_flow():
    """Test complete authentication flow for all user types"""
    print("🚀 Testing Complete SHINE Authentication Flow")
    print("="*60)
    
    results = {
        "passed": 0,
        "failed": 0,
        "tests": []
    }
    
    def log_result(test_name, passed, message=""):
        results["tests"].append({"name": test_name, "passed": passed, "message": message})
        if passed:
            results["passed"] += 1
            print(f"✅ {test_name}: {message}")
        else:
            results["failed"] += 1
            print(f"❌ {test_name}: {message}")
    
    # 1. Test API Health
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_result("API Health", True, f"API accessible: {data.get('message', 'OK')}")
        else:
            log_result("API Health", False, f"API not accessible: {response.status_code}")
            return results
    except Exception as e:
        log_result("API Health", False, f"API connection failed: {e}")
        return results
    
    # 2. Test Customer Registration & Login
    customer_email = f"customer_{uuid.uuid4().hex[:8]}@test.com"
    customer_data = {
        "email": customer_email,
        "password": "SecurePass123!",
        "role": "customer"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=customer_data, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            resp_data = response.json()
            user = resp_data["user"]
            if user["role"] == "customer" and user["mfa_enabled"] is False:
                log_result("Customer Registration", True, f"Customer registered: {customer_email}")
                customer_token = resp_data["access_token"]
                
                # Test customer login
                login_response = requests.post(f"{BASE_URL}/auth/login", 
                                             json={"email": customer_email, "password": "SecurePass123!"}, 
                                             headers=HEADERS, timeout=10)
                if login_response.status_code == 200:
                    login_data = login_response.json()
                    if "access_token" in login_data:
                        log_result("Customer Login", True, "Customer login successful")
                    else:
                        log_result("Customer Login", False, "No access token in response")
                else:
                    log_result("Customer Login", False, f"Login failed: {login_response.status_code}")
            else:
                log_result("Customer Registration", False, f"Invalid customer data: {user}")
        else:
            log_result("Customer Registration", False, f"Registration failed: {response.status_code}")
    except Exception as e:
        log_result("Customer Registration", False, f"Exception: {e}")
    
    # 3. Test Partner Registration & Role Switching
    partner_email = f"partner_{uuid.uuid4().hex[:8]}@test.com"
    partner_data = {
        "email": partner_email,
        "password": "SecurePass123!",
        "role": "partner"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=partner_data, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            resp_data = response.json()
            user = resp_data["user"]
            if user["role"] == "partner" and user["partner_status"] == "pending":
                log_result("Partner Registration", True, f"Partner registered with pending status: {partner_email}")
                partner_token = resp_data["access_token"]
                
                # Test role switching
                switch_response = requests.post(f"{BASE_URL}/auth/switch-role", 
                                              headers={**HEADERS, "Authorization": f"Bearer {partner_token}"}, 
                                              timeout=10)
                if switch_response.status_code == 200:
                    switch_data = switch_response.json()
                    if switch_data["user"]["role"] == "customer":
                        log_result("Partner Role Switching", True, "Partner successfully switched to customer")
                    else:
                        log_result("Partner Role Switching", False, f"Role not switched: {switch_data['user']['role']}")
                else:
                    log_result("Partner Role Switching", False, f"Role switch failed: {switch_response.status_code}")
            else:
                log_result("Partner Registration", False, f"Invalid partner data: {user}")
        else:
            log_result("Partner Registration", False, f"Registration failed: {response.status_code}")
    except Exception as e:
        log_result("Partner Registration", False, f"Exception: {e}")
    
    # 4. Test Owner Registration & MFA Flow
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    owner_data = {
        "email": owner_email,
        "password": "SecurePass123!",
        "role": "owner"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=owner_data, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            resp_data = response.json()
            user = resp_data["user"]
            if user["role"] == "owner" and user["mfa_enabled"] is True:
                log_result("Owner Registration", True, f"Owner registered with MFA enabled: {owner_email}")
                
                # Test MFA login flow
                login_response = requests.post(f"{BASE_URL}/auth/login", 
                                             json={"email": owner_email, "password": "SecurePass123!"}, 
                                             headers=HEADERS, timeout=10)
                if login_response.status_code == 200:
                    login_data = login_response.json()
                    if login_data.get("mfa_required") and "dev_mfa_code" in login_data:
                        log_result("Owner MFA Required", True, f"MFA code generated: {login_data['dev_mfa_code']}")
                        
                        # Test MFA verification
                        mfa_response = requests.post(f"{BASE_URL}/auth/mfa", 
                                                   json={"email": owner_email, "mfa_code": login_data["dev_mfa_code"]}, 
                                                   headers=HEADERS, timeout=10)
                        if mfa_response.status_code == 200:
                            mfa_data = mfa_response.json()
                            if "access_token" in mfa_data:
                                log_result("Owner MFA Verification", True, "MFA verification successful")
                            else:
                                log_result("Owner MFA Verification", False, "No access token after MFA")
                        else:
                            log_result("Owner MFA Verification", False, f"MFA verification failed: {mfa_response.status_code}")
                    else:
                        log_result("Owner MFA Required", False, f"MFA not required: {login_data}")
                else:
                    log_result("Owner MFA Required", False, f"Owner login failed: {login_response.status_code}")
            else:
                log_result("Owner Registration", False, f"Invalid owner data: {user}")
        else:
            log_result("Owner Registration", False, f"Registration failed: {response.status_code}")
    except Exception as e:
        log_result("Owner Registration", False, f"Exception: {e}")
    
    # 5. Test JWT Token Validation
    if 'customer_token' in locals():
        try:
            me_response = requests.get(f"{BASE_URL}/auth/me", 
                                     headers={**HEADERS, "Authorization": f"Bearer {customer_token}"}, 
                                     timeout=10)
            if me_response.status_code == 200:
                user_data = me_response.json()
                if "email" in user_data and "role" in user_data:
                    log_result("JWT Token Validation", True, f"Token valid for user: {user_data['email']}")
                else:
                    log_result("JWT Token Validation", False, f"Invalid user data: {user_data}")
            else:
                log_result("JWT Token Validation", False, f"Token validation failed: {me_response.status_code}")
        except Exception as e:
            log_result("JWT Token Validation", False, f"Exception: {e}")
    
    # 6. Test Error Handling
    try:
        # Test duplicate email
        dup_response = requests.post(f"{BASE_URL}/auth/register", json=customer_data, headers=HEADERS, timeout=10)
        if dup_response.status_code == 400:
            log_result("Duplicate Email Handling", True, "Duplicate email properly rejected")
        else:
            log_result("Duplicate Email Handling", False, f"Duplicate not handled: {dup_response.status_code}")
        
        # Test invalid credentials
        invalid_response = requests.post(f"{BASE_URL}/auth/login", 
                                       json={"email": "fake@test.com", "password": "wrong"}, 
                                       headers=HEADERS, timeout=10)
        if invalid_response.status_code == 401:
            log_result("Invalid Credentials Handling", True, "Invalid credentials properly rejected")
        else:
            log_result("Invalid Credentials Handling", False, f"Invalid creds not handled: {invalid_response.status_code}")
        
        # Test invalid token
        invalid_token_response = requests.get(f"{BASE_URL}/auth/me", 
                                            headers={**HEADERS, "Authorization": "Bearer invalid_token"}, 
                                            timeout=10)
        if invalid_token_response.status_code == 401:
            log_result("Invalid Token Handling", True, "Invalid token properly rejected")
        else:
            log_result("Invalid Token Handling", False, f"Invalid token not handled: {invalid_token_response.status_code}")
            
    except Exception as e:
        log_result("Error Handling Tests", False, f"Exception: {e}")
    
    # Print summary
    print("\n" + "="*60)
    print("FINAL TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {results['passed'] + results['failed']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed']/(results['passed'] + results['failed'])*100):.1f}%")
    
    if results['failed'] > 0:
        print("\nFAILED TESTS:")
        for test in results['tests']:
            if not test['passed']:
                print(f"- {test['name']}: {test['message']}")
    
    return results

if __name__ == "__main__":
    test_complete_auth_flow()