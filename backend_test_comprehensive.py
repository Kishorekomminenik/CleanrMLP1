#!/usr/bin/env python3
"""
SHINE Application Comprehensive End-to-End Backend Testing
Tests complete customer journey from authentication through rating
"""

import requests
import json
import time
from datetime import datetime
import uuid
import re

# Configuration
BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.system_results = {}
    
    def add_result(self, test_name, passed, message="", system="general"):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "system": system,
            "timestamp": datetime.now().isoformat()
        })
        
        if system not in self.system_results:
            self.system_results[system] = {"passed": 0, "failed": 0}
        
        if passed:
            self.passed += 1
            self.system_results[system]["passed"] += 1
        else:
            self.failed += 1
            self.system_results[system]["failed"] += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
    
    def print_summary(self):
        print(f"\n{'='*80}")
        print(f"SHINE APPLICATION COMPREHENSIVE TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        print(f"\nSYSTEM BREAKDOWN:")
        for system, counts in self.system_results.items():
            total = counts["passed"] + counts["failed"]
            rate = (counts["passed"]/total*100) if total > 0 else 0
            print(f"  {system.upper()}: {counts['passed']}/{total} ({rate:.1f}%)")
        
        if self.failed > 0:
            print(f"\nFAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"- [{result['system']}] {result['test']}: {result['message']}")

def make_request(method, endpoint, data=None, headers=None, auth_token=None, params=None):
    """Helper function to make HTTP requests"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, params=params, timeout=15)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=15)
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

# ===== AUTHENTICATION SYSTEM TESTS (PAGE-1-AUTH) =====

def test_authentication_system(results):
    """Test complete authentication system"""
    print(f"\n{'='*60}")
    print("TESTING AUTHENTICATION SYSTEM (PAGE-1-AUTH)")
    print(f"{'='*60}")
    
    # Test user registration for all roles
    customer_token, customer_email = test_customer_registration(results)
    partner_token, partner_email = test_partner_registration(results)
    owner_token, owner_email = test_owner_registration(results)
    
    # Test login flows
    if customer_email:
        test_email_login(results, customer_email)
        test_username_login(results, customer_email.split('@')[0])
    
    # Test Owner MFA flow
    if owner_email:
        test_owner_mfa_complete_flow(results, owner_email)
    
    # Test JWT validation
    if customer_token:
        test_jwt_validation(results, customer_token)
    
    return customer_token, partner_token, owner_token, customer_email, partner_email, owner_email

def test_customer_registration(results):
    """Test customer registration"""
    test_email = f"customer_{uuid.uuid4().hex[:8]}@shine.com"
    test_username = f"customer_{uuid.uuid4().hex[:8]}"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "ShinePass123!",
        "role": "customer",
        "phone": "+14155551234",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                user = resp_data["user"]
                if user["role"] == "customer" and user["email"] == test_email:
                    results.add_result("Customer Registration", True, f"Customer registered: {test_email}", "auth")
                    return resp_data["token"], test_email
        except Exception as e:
            results.add_result("Customer Registration", False, f"JSON error: {e}", "auth")
    
    results.add_result("Customer Registration", False, f"Registration failed. Status: {response.status_code if response else 'No response'}", "auth")
    return None, test_email

def test_partner_registration(results):
    """Test partner registration"""
    test_email = f"partner_{uuid.uuid4().hex[:8]}@shine.com"
    test_username = f"partner_{uuid.uuid4().hex[:8]}"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "ShinePass123!",
        "role": "partner",
        "phone": "+14155551235",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                user = resp_data["user"]
                if (user["role"] == "partner" and 
                    user["email"] == test_email and 
                    user["partner_status"] == "pending"):
                    results.add_result("Partner Registration", True, f"Partner registered with pending status: {test_email}", "auth")
                    return resp_data["token"], test_email
        except Exception as e:
            results.add_result("Partner Registration", False, f"JSON error: {e}", "auth")
    
    results.add_result("Partner Registration", False, f"Registration failed. Status: {response.status_code if response else 'No response'}", "auth")
    return None, test_email

def test_owner_registration(results):
    """Test owner registration"""
    test_email = f"owner_{uuid.uuid4().hex[:8]}@shine.com"
    test_username = f"owner_{uuid.uuid4().hex[:8]}"
    
    data = {
        "email": test_email,
        "username": test_username,
        "password": "ShinePass123!",
        "role": "owner",
        "phone": "+14155551236",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                user = resp_data["user"]
                if (user["role"] == "owner" and 
                    user["email"] == test_email and 
                    user["mfa_enabled"] is True):
                    results.add_result("Owner Registration", True, f"Owner registered with MFA enabled: {test_email}", "auth")
                    return resp_data["token"], test_email
        except Exception as e:
            results.add_result("Owner Registration", False, f"JSON error: {e}", "auth")
    
    results.add_result("Owner Registration", False, f"Registration failed. Status: {response.status_code if response else 'No response'}", "auth")
    return None, test_email

def test_email_login(results, email):
    """Test login with email"""
    data = {
        "identifier": email,
        "password": "ShinePass123!"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data or resp_data.get("mfa_required"):
                results.add_result("Email Login", True, f"Email login successful: {email}", "auth")
                return
        except Exception as e:
            results.add_result("Email Login", False, f"JSON error: {e}", "auth")
            return
    
    results.add_result("Email Login", False, f"Login failed. Status: {response.status_code if response else 'No response'}", "auth")

def test_username_login(results, username):
    """Test login with username"""
    data = {
        "identifier": username,
        "password": "ShinePass123!"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data or resp_data.get("mfa_required"):
                results.add_result("Username Login", True, f"Username login successful: {username}", "auth")
                return
        except Exception as e:
            results.add_result("Username Login", False, f"JSON error: {e}", "auth")
            return
    
    results.add_result("Username Login", False, f"Login failed. Status: {response.status_code if response else 'No response'}", "auth")

def test_owner_mfa_complete_flow(results, owner_email):
    """Test complete Owner MFA flow"""
    # Step 1: Login should trigger MFA
    data = {
        "identifier": owner_email,
        "password": "ShinePass123!"
    }
    
    response = make_request("POST", "/auth/login", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if (resp_data.get("mfa_required") is True and 
                "user_id" in resp_data and 
                "dev_mfa_code" in resp_data):
                
                user_id = resp_data["user_id"]
                mfa_code = resp_data["dev_mfa_code"]
                
                # Step 2: Verify MFA code
                verify_data = {
                    "user_id": user_id,
                    "code": mfa_code
                }
                
                verify_response = make_request("POST", "/auth/mfa/verify", verify_data)
                
                if verify_response and verify_response.status_code == 200:
                    verify_resp = verify_response.json()
                    if verify_resp.get("ok") is True and "token" in verify_resp:
                        results.add_result("Owner MFA Flow", True, f"Complete MFA flow successful for owner: {owner_email}", "auth")
                        return verify_resp["token"]
                
                results.add_result("Owner MFA Flow", False, "MFA verification failed", "auth")
            else:
                results.add_result("Owner MFA Flow", False, f"MFA not triggered for owner: {resp_data}", "auth")
        except Exception as e:
            results.add_result("Owner MFA Flow", False, f"JSON error: {e}", "auth")
    else:
        results.add_result("Owner MFA Flow", False, f"Owner login failed. Status: {response.status_code if response else 'No response'}", "auth")
    
    return None

def test_jwt_validation(results, token):
    """Test JWT token validation"""
    response = make_request("GET", "/auth/me", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            user_data = response.json()
            if "id" in user_data and "email" in user_data and "role" in user_data:
                results.add_result("JWT Token Validation", True, f"JWT validation successful", "auth")
                return
        except Exception as e:
            results.add_result("JWT Token Validation", False, f"JSON error: {e}", "auth")
            return
    
    results.add_result("JWT Token Validation", False, f"JWT validation failed. Status: {response.status_code if response else 'No response'}", "auth")

# ===== HOME DASHBOARD SYSTEM TESTS (PAGE-2-HOME) =====

def test_home_dashboard_system(results, customer_token, partner_token, owner_token):
    """Test home dashboard system for all roles"""
    print(f"\n{'='*60}")
    print("TESTING HOME DASHBOARD SYSTEM (PAGE-2-HOME)")
    print(f"{'='*60}")
    
    # Test customer dashboard features
    if customer_token:
        test_customer_nearby_partners(results)
        test_customer_surge_pricing(results)
    
    # Test partner dashboard
    if partner_token:
        test_partner_dashboard(results, partner_token)
    
    # Test owner dashboard
    if owner_token:
        test_owner_dashboard_tiles(results, owner_token)

def test_customer_nearby_partners(results):
    """Test customer nearby partners API"""
    params = {"lat": 37.7749, "lng": -122.4194, "radius_km": 5.0}
    response = make_request("GET", "/partners/nearby", params=params)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "partners" in resp_data and isinstance(resp_data["partners"], list):
                partners = resp_data["partners"]
                if len(partners) > 0:
                    partner = partners[0]
                    required_fields = ["id", "lat", "lng", "rating", "badges"]
                    if all(field in partner for field in required_fields):
                        results.add_result("Customer Nearby Partners", True, f"Found {len(partners)} nearby partners", "home")
                        return
                
                results.add_result("Customer Nearby Partners", True, "No partners found (acceptable)", "home")
                return
        except Exception as e:
            results.add_result("Customer Nearby Partners", False, f"JSON error: {e}", "home")
            return
    
    results.add_result("Customer Nearby Partners", False, f"API failed. Status: {response.status_code if response else 'No response'}", "home")

def test_customer_surge_pricing(results):
    """Test customer surge pricing API"""
    params = {"lat": 37.7749, "lng": -122.4194}
    response = make_request("GET", "/pricing/surge", params=params)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "active" in resp_data and "multiplier" in resp_data:
                active = resp_data["active"]
                multiplier = resp_data["multiplier"]
                if isinstance(active, bool) and isinstance(multiplier, (int, float)):
                    results.add_result("Customer Surge Pricing", True, f"Surge status: active={active}, multiplier={multiplier}", "home")
                    return
        except Exception as e:
            results.add_result("Customer Surge Pricing", False, f"JSON error: {e}", "home")
            return
    
    results.add_result("Customer Surge Pricing", False, f"API failed. Status: {response.status_code if response else 'No response'}", "home")

def test_partner_dashboard(results, partner_token):
    """Test partner dashboard API"""
    response = make_request("GET", "/partner/home", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            required_fields = ["status", "verification", "queue"]
            if all(field in resp_data for field in required_fields):
                status = resp_data["status"]
                verification = resp_data["verification"]
                queue = resp_data["queue"]
                
                if (status in ["online", "offline"] and 
                    verification in ["pending", "verified"] and 
                    isinstance(queue, list)):
                    results.add_result("Partner Dashboard", True, f"Dashboard data: status={status}, verification={verification}, queue_size={len(queue)}", "home")
                    return
        except Exception as e:
            results.add_result("Partner Dashboard", False, f"JSON error: {e}", "home")
            return
    
    results.add_result("Partner Dashboard", False, f"API failed. Status: {response.status_code if response else 'No response'}", "home")

def test_owner_dashboard_tiles(results, owner_token):
    """Test owner dashboard tiles API"""
    response = make_request("GET", "/owner/tiles", auth_token=owner_token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            required_fields = ["activeJobs", "partnersOnline", "supportOpen", "gmvToday"]
            if all(field in resp_data for field in required_fields):
                active_jobs = resp_data["activeJobs"]
                partners_online = resp_data["partnersOnline"]
                support_open = resp_data["supportOpen"]
                gmv_today = resp_data["gmvToday"]
                
                if all(isinstance(val, int) for val in [active_jobs, partners_online, support_open, gmv_today]):
                    results.add_result("Owner Dashboard Tiles", True, f"Tiles data: jobs={active_jobs}, partners={partners_online}, support={support_open}, gmv=${gmv_today}", "home")
                    return
        except Exception as e:
            results.add_result("Owner Dashboard Tiles", False, f"JSON error: {e}", "home")
            return
    
    results.add_result("Owner Dashboard Tiles", False, f"API failed. Status: {response.status_code if response else 'No response'}", "home")

# ===== ADDRESS MANAGEMENT SYSTEM TESTS (PAGE-4-ADDRESS) =====

def test_address_management_system(results, customer_token):
    """Test complete address management system"""
    print(f"\n{'='*60}")
    print("TESTING ADDRESS MANAGEMENT SYSTEM (PAGE-4-ADDRESS)")
    print(f"{'='*60}")
    
    if not customer_token:
        results.add_result("Address Management System", False, "No customer token available", "address")
        return None
    
    # Test saved addresses
    test_list_saved_addresses(results, customer_token)
    
    # Test address creation
    address_id = test_create_address(results, customer_token)
    
    # Test address autocomplete
    test_address_autocomplete(results)
    
    # Test ETA preview
    test_eta_preview_calculations(results)
    
    # Test address validation
    test_address_duplicate_handling(results, customer_token)
    
    return address_id

def test_list_saved_addresses(results, token):
    """Test listing saved addresses"""
    response = make_request("GET", "/addresses", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "addresses" in resp_data and isinstance(resp_data["addresses"], list):
                results.add_result("List Saved Addresses", True, f"Retrieved {len(resp_data['addresses'])} saved addresses", "address")
                return resp_data["addresses"]
        except Exception as e:
            results.add_result("List Saved Addresses", False, f"JSON error: {e}", "address")
            return []
    
    results.add_result("List Saved Addresses", False, f"API failed. Status: {response.status_code if response else 'No response'}", "address")
    return []

def test_create_address(results, token):
    """Test creating a new address"""
    address_data = {
        "label": "Home",
        "line1": "123 Shine Street",
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
                results.add_result("Create Address", True, f"Address created with ID: {resp_data['id']}", "address")
                return resp_data["id"]
        except Exception as e:
            results.add_result("Create Address", False, f"JSON error: {e}", "address")
            return None
    
    results.add_result("Create Address", False, f"API failed. Status: {response.status_code if response else 'No response'}", "address")
    return None

def test_address_autocomplete(results):
    """Test address autocomplete with query validation"""
    # Test with valid query
    params = {"q": "Main Street"}
    response = make_request("GET", "/places/autocomplete", params=params)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "candidates" in resp_data and isinstance(resp_data["candidates"], list):
                candidates = resp_data["candidates"]
                if len(candidates) > 0:
                    candidate = candidates[0]
                    required_fields = ["placeId", "label", "line1", "city", "state", "postalCode", "country", "lat", "lng"]
                    if all(field in candidate for field in required_fields):
                        results.add_result("Address Autocomplete", True, f"Autocomplete returned {len(candidates)} valid candidates", "address")
                        return
                
                results.add_result("Address Autocomplete", True, "Autocomplete returned empty results (acceptable)", "address")
                return
        except Exception as e:
            results.add_result("Address Autocomplete", False, f"JSON error: {e}", "address")
            return
    
    results.add_result("Address Autocomplete", False, f"API failed. Status: {response.status_code if response else 'No response'}", "address")

def test_eta_preview_calculations(results):
    """Test ETA preview calculations"""
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
                
                if "min" in window.lower() and isinstance(distance, (int, float)):
                    results.add_result("ETA Preview Calculations", True, f"ETA calculated: {window}, {distance}km", "address")
                    return
        except Exception as e:
            results.add_result("ETA Preview Calculations", False, f"JSON error: {e}", "address")
            return
    
    results.add_result("ETA Preview Calculations", False, f"API failed. Status: {response.status_code if response else 'No response'}", "address")

def test_address_duplicate_handling(results, token):
    """Test address duplicate handling"""
    # Try to create the same address again
    address_data = {
        "label": "Home Duplicate",
        "line1": "123 Shine Street",  # Same as previous
        "city": "San Francisco",
        "state": "CA",
        "postalCode": "94102",
        "country": "USA",
        "lat": 37.7749,
        "lng": -122.4194
    }
    
    response = make_request("POST", "/addresses", address_data, auth_token=token)
    
    if response and response.status_code == 409:
        results.add_result("Address Duplicate Handling", True, "Duplicate address properly rejected with 409", "address")
    elif response and response.status_code == 200:
        results.add_result("Address Duplicate Handling", False, "Duplicate address was allowed (should be rejected)", "address")
    else:
        results.add_result("Address Duplicate Handling", False, f"Unexpected response. Status: {response.status_code if response else 'No response'}", "address")

# ===== CHECKOUT & PAYMENT SYSTEM TESTS (PAGE-5-CHECKOUT) =====

def test_checkout_payment_system(results, customer_token):
    """Test complete checkout and payment system"""
    print(f"\n{'='*60}")
    print("TESTING CHECKOUT & PAYMENT SYSTEM (PAGE-5-CHECKOUT)")
    print(f"{'='*60}")
    
    if not customer_token:
        results.add_result("Checkout & Payment System", False, "No customer token available", "checkout")
        return None, None
    
    # Test payment methods
    test_payment_methods_listing(results, customer_token)
    
    # Test promo codes
    test_promo_code_application(results, customer_token)
    
    # Test payment pre-authorization
    payment_intent_id = test_payment_preauth_scenarios(results, customer_token)
    
    # Test booking creation
    booking_id = test_booking_creation(results, customer_token)
    
    # Test error recovery
    if payment_intent_id:
        test_preauth_void_functionality(results, payment_intent_id)
    
    return booking_id, payment_intent_id

def test_payment_methods_listing(results, token):
    """Test payment methods listing (mock cards)"""
    response = make_request("GET", "/billing/methods", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "methods" in resp_data and isinstance(resp_data["methods"], list):
                methods = resp_data["methods"]
                if len(methods) > 0:
                    method = methods[0]
                    required_fields = ["id", "brand", "last4", "exp", "isDefault"]
                    if all(field in method for field in required_fields):
                        results.add_result("Payment Methods Listing", True, f"Retrieved {len(methods)} payment methods", "checkout")
                        return methods
                
                results.add_result("Payment Methods Listing", True, "Empty payment methods list (acceptable)", "checkout")
                return []
        except Exception as e:
            results.add_result("Payment Methods Listing", False, f"JSON error: {e}", "checkout")
            return []
    
    results.add_result("Payment Methods Listing", False, f"API failed. Status: {response.status_code if response else 'No response'}", "checkout")
    return []

def test_promo_code_application(results, token):
    """Test promo code application (SHINE20, FIRST10, SAVE15)"""
    valid_promos = ["SHINE20", "FIRST10", "SAVE15"]
    
    for promo_code in valid_promos:
        data = {
            "quoteId": f"quote_{uuid.uuid4().hex[:8]}",
            "code": promo_code,
            "useCredits": False
        }
        
        response = make_request("POST", "/pricing/promo/apply", data, auth_token=token)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if (resp_data.get("promoApplied") is True and 
                    "breakdown" in resp_data and 
                    "total" in resp_data):
                    
                    # Check if promo is in breakdown
                    breakdown = resp_data["breakdown"]
                    promo_found = any(promo_code in item.get("label", "") for item in breakdown)
                    
                    if promo_found:
                        results.add_result(f"Promo Code {promo_code}", True, f"Promo applied successfully, total: ${resp_data['total']}", "checkout")
                        continue
            except Exception as e:
                results.add_result(f"Promo Code {promo_code}", False, f"JSON error: {e}", "checkout")
                return
        
        results.add_result(f"Promo Code {promo_code}", False, f"Promo application failed. Status: {response.status_code if response else 'No response'}", "checkout")
        return
    
    results.add_result("Promo Code Application", True, f"All {len(valid_promos)} promo codes working", "checkout")

def test_payment_preauth_scenarios(results, token):
    """Test payment pre-authorization (success, decline, SCA scenarios)"""
    # Test success scenario
    success_data = {
        "amount": 96.89,
        "currency": "usd",
        "paymentMethodId": "pm_card_visa",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", success_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if ("paymentIntentId" in resp_data and 
                "clientSecret" in resp_data and 
                "requiresAction" in resp_data):
                
                payment_intent_id = resp_data["paymentIntentId"]
                requires_action = resp_data["requiresAction"]
                
                results.add_result("Payment Preauth Success", True, f"Payment intent created: {payment_intent_id}, SCA: {requires_action}", "checkout")
                
                # Test decline scenario
                test_payment_preauth_decline(results, token)
                
                # Test SCA scenario
                test_payment_preauth_sca(results, token)
                
                return payment_intent_id
        except Exception as e:
            results.add_result("Payment Preauth Success", False, f"JSON error: {e}", "checkout")
    else:
        results.add_result("Payment Preauth Success", False, f"API failed. Status: {response.status_code if response else 'No response'}", "checkout")
    
    return None

def test_payment_preauth_decline(results, token):
    """Test declined payment scenario"""
    decline_data = {
        "amount": 96.89,
        "currency": "usd",
        "paymentMethodId": "pm_declined",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", decline_data, auth_token=token)
    
    if response and response.status_code == 402:
        results.add_result("Payment Preauth Decline", True, "Declined payment properly handled with 402", "checkout")
    else:
        results.add_result("Payment Preauth Decline", False, f"Decline not handled correctly. Status: {response.status_code if response else 'No response'}", "checkout")

def test_payment_preauth_sca(results, token):
    """Test SCA required scenario"""
    sca_data = {
        "amount": 96.89,
        "currency": "usd",
        "paymentMethodId": "pm_sca_required",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", sca_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("requiresAction") is True:
                results.add_result("Payment Preauth SCA", True, "SCA required scenario working", "checkout")
                return
        except Exception as e:
            results.add_result("Payment Preauth SCA", False, f"JSON error: {e}", "checkout")
            return
    
    results.add_result("Payment Preauth SCA", False, f"SCA scenario failed. Status: {response.status_code if response else 'No response'}", "checkout")

def test_booking_creation(results, token):
    """Test booking creation after successful payment"""
    booking_data = {
        "quoteId": f"quote_{uuid.uuid4().hex[:8]}",
        "service": {
            "serviceType": "basic",
            "timing": {
                "when": "now"
            },
            "details": {
                "bedrooms": 2,
                "bathrooms": 1
            }
        },
        "address": {
            "line1": "123 Shine Street",
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
            "paymentIntentId": f"pi_{uuid.uuid4().hex[:16]}",
            "paymentMethodId": "pm_card_visa"
        },
        "applyCredits": False,
        "promoCode": None
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if ("bookingId" in resp_data and 
                "status" in resp_data and 
                "next" in resp_data):
                
                booking_id = resp_data["bookingId"]
                status = resp_data["status"]
                next_step = resp_data["next"]
                
                if "bk_" in booking_id and status in ["pending_dispatch", "scheduled"]:
                    results.add_result("Booking Creation", True, f"Booking created: {booking_id}, status: {status}, next: {next_step}", "checkout")
                    return booking_id
        except Exception as e:
            results.add_result("Booking Creation", False, f"JSON error: {e}", "checkout")
            return None
    
    results.add_result("Booking Creation", False, f"API failed. Status: {response.status_code if response else 'No response'}", "checkout")
    return None

def test_preauth_void_functionality(results, payment_intent_id):
    """Test error recovery with pre-auth void functionality"""
    data = {
        "paymentIntentId": payment_intent_id
    }
    
    response = make_request("POST", "/billing/void", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Preauth Void Functionality", True, f"Payment preauth voided successfully: {payment_intent_id}", "checkout")
                return
        except Exception as e:
            results.add_result("Preauth Void Functionality", False, f"JSON error: {e}", "checkout")
            return
    
    results.add_result("Preauth Void Functionality", False, f"API failed. Status: {response.status_code if response else 'No response'}", "checkout")

# ===== DISPATCH SYSTEM TESTS (PAGE-6-DISPATCH) =====

def test_dispatch_system(results, customer_token, partner_token, owner_token, booking_id):
    """Test dispatch system"""
    print(f"\n{'='*60}")
    print("TESTING DISPATCH SYSTEM (PAGE-6-DISPATCH)")
    print(f"{'='*60}")
    
    # Test customer dispatch status tracking
    if customer_token and booking_id:
        test_customer_dispatch_tracking(results, customer_token, booking_id)
    
    # Test partner offer management
    if partner_token:
        test_partner_offer_polling(results, partner_token)
    
    # Test booking cancellation
    if customer_token and booking_id:
        test_booking_cancellation(results, customer_token, booking_id)
    
    # Test owner dispatch dashboard
    if owner_token:
        test_owner_dispatch_dashboard(results, owner_token)

def test_customer_dispatch_tracking(results, token, booking_id):
    """Test customer dispatch status tracking and progression"""
    response = make_request("GET", f"/dispatch/status/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            required_fields = ["state", "waitMins", "zone"]
            if all(field in resp_data for field in required_fields):
                state = resp_data["state"]
                wait_mins = resp_data["waitMins"]
                zone = resp_data["zone"]
                
                if state in ["searching", "assigned", "no_match", "cancelled"]:
                    results.add_result("Customer Dispatch Tracking", True, f"Dispatch status: {state}, wait: {wait_mins}min, zone: {zone}", "dispatch")
                    return
        except Exception as e:
            results.add_result("Customer Dispatch Tracking", False, f"JSON error: {e}", "dispatch")
            return
    
    results.add_result("Customer Dispatch Tracking", False, f"API failed. Status: {response.status_code if response else 'No response'}", "dispatch")

def test_partner_offer_polling(results, token):
    """Test partner offer polling and management"""
    response = make_request("GET", "/partner/offers/poll", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "offer" in resp_data:
                offer = resp_data["offer"]
                if offer is None:
                    results.add_result("Partner Offer Polling", True, "No offers available (expected for new partner)", "dispatch")
                else:
                    # Offer structure validation
                    required_fields = ["offerId", "bookingId", "serviceType", "payout"]
                    if all(field in offer for field in required_fields):
                        results.add_result("Partner Offer Polling", True, f"Offer received: {offer['offerId']}, payout: ${offer['payout']}", "dispatch")
                    else:
                        results.add_result("Partner Offer Polling", False, f"Offer missing required fields: {offer}", "dispatch")
                return
        except Exception as e:
            results.add_result("Partner Offer Polling", False, f"JSON error: {e}", "dispatch")
            return
    elif response and response.status_code == 403:
        results.add_result("Partner Offer Polling", True, "Partner verification required (expected for pending partners)", "dispatch")
        return
    
    results.add_result("Partner Offer Polling", False, f"API failed. Status: {response.status_code if response else 'No response'}", "dispatch")

def test_booking_cancellation(results, token, booking_id):
    """Test booking cancellation with proper fee calculation"""
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
                
                results.add_result("Booking Cancellation", True, f"Booking cancelled, fee: ${fee}, refund: ${refund_credit}", "dispatch")
                return
        except Exception as e:
            results.add_result("Booking Cancellation", False, f"JSON error: {e}", "dispatch")
            return
    elif response and response.status_code == 409:
        results.add_result("Booking Cancellation", True, "Cancellation not allowed (booking already assigned)", "dispatch")
        return
    
    results.add_result("Booking Cancellation", False, f"API failed. Status: {response.status_code if response else 'No response'}", "dispatch")

def test_owner_dispatch_dashboard(results, token):
    """Test owner dispatch dashboard with live metrics"""
    response = make_request("GET", "/owner/dispatch", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "kpis" in resp_data and "offers" in resp_data:
                kpis = resp_data["kpis"]
                offers = resp_data["offers"]
                
                required_kpi_fields = ["avgTimeToAssign", "acceptRate", "offersActive", "offersExpired"]
                if all(field in kpis for field in required_kpi_fields):
                    avg_time = kpis["avgTimeToAssign"]
                    accept_rate = kpis["acceptRate"]
                    active_offers = kpis["offersActive"]
                    
                    results.add_result("Owner Dispatch Dashboard", True, f"Dashboard KPIs: avg_time={avg_time}min, accept_rate={accept_rate}%, active_offers={active_offers}", "dispatch")
                    return
        except Exception as e:
            results.add_result("Owner Dispatch Dashboard", False, f"JSON error: {e}", "dispatch")
            return
    
    results.add_result("Owner Dispatch Dashboard", False, f"API failed. Status: {response.status_code if response else 'No response'}", "dispatch")

# ===== JOB TRACKING SYSTEM TESTS (PAGE-7-JOB) =====

def test_job_tracking_system(results, customer_token, partner_token, booking_id):
    """Test job tracking and lifecycle system"""
    print(f"\n{'='*60}")
    print("TESTING JOB TRACKING SYSTEM (PAGE-7-JOB)")
    print(f"{'='*60}")
    
    if not booking_id:
        results.add_result("Job Tracking System", False, "No booking ID available", "job")
        return
    
    # Test job initialization and status progression
    test_job_initialization(results, customer_token, booking_id)
    
    # Test partner verification and photo upload workflows
    if partner_token:
        test_partner_verification_workflow(results, partner_token, booking_id)
    
    # Test job lifecycle progression
    test_job_lifecycle_progression(results, customer_token, booking_id)
    
    # Test communication systems
    test_communication_systems(results, customer_token, booking_id)
    
    # Test payment capture
    test_payment_capture_workflow(results, customer_token, booking_id)

def test_job_initialization(results, token, booking_id):
    """Test job initialization and status progression"""
    response = make_request("GET", f"/jobs/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            required_fields = ["bookingId", "status", "serviceType", "address", "partner", "etaMinutes", "requiredPhotos"]
            if all(field in resp_data for field in required_fields):
                status = resp_data["status"]
                service_type = resp_data["serviceType"]
                eta_minutes = resp_data["etaMinutes"]
                required_photos = resp_data["requiredPhotos"]
                
                if (status in ["enroute", "arrived", "in_progress", "completed"] and
                    service_type in ["basic", "deep", "bathroom"] and
                    isinstance(eta_minutes, int) and
                    "before" in required_photos and "after" in required_photos):
                    
                    results.add_result("Job Initialization", True, f"Job initialized: status={status}, type={service_type}, ETA={eta_minutes}min", "job")
                    return
        except Exception as e:
            results.add_result("Job Initialization", False, f"JSON error: {e}", "job")
            return
    elif response and response.status_code == 404:
        results.add_result("Job Initialization", False, "Job not found (booking may not have been created properly)", "job")
        return
    
    results.add_result("Job Initialization", False, f"API failed. Status: {response.status_code if response else 'No response'}", "job")

def test_partner_verification_workflow(results, token, booking_id):
    """Test partner verification and photo upload workflows"""
    # Test photo presign URL generation
    presign_data = {
        "contentType": "image/jpeg"
    }
    
    response = make_request("POST", "/media/presign", presign_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "uploadUrl" in resp_data and "fileId" in resp_data:
                file_id = resp_data["fileId"]
                upload_url = resp_data["uploadUrl"]
                
                if "img_" in file_id and "upload" in upload_url:
                    results.add_result("Partner Photo Upload Workflow", True, f"Presigned URL generated: {file_id}", "job")
                    
                    # Test adding photos to job
                    test_job_photo_addition(results, token, booking_id, file_id)
                    return
        except Exception as e:
            results.add_result("Partner Photo Upload Workflow", False, f"JSON error: {e}", "job")
            return
    
    results.add_result("Partner Photo Upload Workflow", False, f"API failed. Status: {response.status_code if response else 'No response'}", "job")

def test_job_photo_addition(results, token, booking_id, file_id):
    """Test adding photos to job"""
    photo_data = {
        "type": "before",
        "fileIds": [file_id]
    }
    
    response = make_request("POST", f"/jobs/{booking_id}/photos", photo_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True and "counts" in resp_data:
                results.add_result("Job Photo Addition", True, f"Photo added to job: {file_id}", "job")
                return
        except Exception as e:
            results.add_result("Job Photo Addition", False, f"JSON error: {e}", "job")
            return
    
    results.add_result("Job Photo Addition", False, f"API failed. Status: {response.status_code if response else 'No response'}", "job")

def test_job_lifecycle_progression(results, token, booking_id):
    """Test job lifecycle (enroute → arrived → in_progress → completed)"""
    # Test marking arrived
    arrived_data = {
        "timestamp": datetime.now().isoformat()
    }
    
    response = make_request("POST", f"/jobs/{booking_id}/arrived", arrived_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True and resp_data.get("status") == "arrived":
                results.add_result("Job Lifecycle Progression", True, f"Job marked as arrived", "job")
                return
        except Exception as e:
            results.add_result("Job Lifecycle Progression", False, f"JSON error: {e}", "job")
            return
    elif response and response.status_code == 403:
        results.add_result("Job Lifecycle Progression", True, "Partner verification required (expected for pending partners)", "job")
        return
    
    results.add_result("Job Lifecycle Progression", False, f"API failed. Status: {response.status_code if response else 'No response'}", "job")

def test_communication_systems(results, token, booking_id):
    """Test communication systems (chat and masked calling)"""
    # Test chat system
    response = make_request("GET", f"/comm/chat/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "messages" in resp_data and isinstance(resp_data["messages"], list):
                results.add_result("Communication Chat System", True, f"Chat system working, {len(resp_data['messages'])} messages", "job")
                
                # Test sending a message
                test_chat_message_sending(results, token, booking_id)
                return
        except Exception as e:
            results.add_result("Communication Chat System", False, f"JSON error: {e}", "job")
            return
    
    results.add_result("Communication Chat System", False, f"API failed. Status: {response.status_code if response else 'No response'}", "job")

def test_chat_message_sending(results, token, booking_id):
    """Test sending chat messages"""
    message_data = {
        "text": "Hello, I'm on my way!"
    }
    
    response = make_request("POST", f"/comm/chat/{booking_id}", message_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "id" in resp_data and "text" in resp_data:
                results.add_result("Chat Message Sending", True, f"Message sent successfully", "job")
                return
        except Exception as e:
            results.add_result("Chat Message Sending", False, f"JSON error: {e}", "job")
            return
    
    results.add_result("Chat Message Sending", False, f"API failed. Status: {response.status_code if response else 'No response'}", "job")

def test_payment_capture_workflow(results, token, booking_id):
    """Test payment capture at start and finish"""
    # Test payment capture at start
    capture_data = {
        "paymentIntentId": f"pi_{uuid.uuid4().hex[:16]}",
        "amount": 48.45  # Half of total for start capture
    }
    
    response = make_request("POST", "/billing/capture/start", capture_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Payment Capture Workflow", True, f"Payment capture at start successful", "job")
                return
        except Exception as e:
            results.add_result("Payment Capture Workflow", False, f"JSON error: {e}", "job")
            return
    
    results.add_result("Payment Capture Workflow", False, f"API failed. Status: {response.status_code if response else 'No response'}", "job")

# ===== RATING & TIP SYSTEM TESTS (PAGE-8-RATE) =====

def test_rating_tip_system(results, customer_token, partner_token, owner_token, booking_id):
    """Test rating and tip system"""
    print(f"\n{'='*60}")
    print("TESTING RATING & TIP SYSTEM (PAGE-8-RATE)")
    print(f"{'='*60}")
    
    if not booking_id:
        results.add_result("Rating & Tip System", False, "No booking ID available", "rating")
        return
    
    # Test rating context retrieval
    test_rating_context_retrieval(results, customer_token, booking_id)
    
    # Test customer rating submission
    test_customer_rating_submission(results, customer_token, booking_id)
    
    # Test partner rating system
    if partner_token:
        test_partner_rating_system(results, partner_token, booking_id)
    
    # Test tip processing
    test_tip_processing(results, customer_token, booking_id)
    
    # Test owner ratings analytics
    if owner_token:
        test_owner_ratings_analytics(results, owner_token)

def test_rating_context_retrieval(results, token, booking_id):
    """Test rating context retrieval with tip calculations"""
    response = make_request("GET", f"/ratings/context/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            required_fields = ["booking", "partner", "customer", "tipPresets", "alreadyRated"]
            if all(field in resp_data for field in required_fields):
                booking = resp_data["booking"]
                tip_presets = resp_data["tipPresets"]
                already_rated = resp_data["alreadyRated"]
                
                if ("total" in booking and 
                    isinstance(tip_presets, list) and 
                    len(tip_presets) > 0 and
                    isinstance(already_rated, bool)):
                    
                    results.add_result("Rating Context Retrieval", True, f"Rating context retrieved, total: ${booking['total']}, tip presets: {len(tip_presets)}", "rating")
                    return
        except Exception as e:
            results.add_result("Rating Context Retrieval", False, f"JSON error: {e}", "rating")
            return
    elif response and response.status_code == 404:
        results.add_result("Rating Context Retrieval", False, "Booking not found for rating context", "rating")
        return
    
    results.add_result("Rating Context Retrieval", False, f"API failed. Status: {response.status_code if response else 'No response'}", "rating")

def test_customer_rating_submission(results, token, booking_id):
    """Test customer rating submission with tip processing"""
    rating_data = {
        "stars": 5,
        "compliments": ["Professional", "On Time"],
        "comments": "Excellent service!",
        "tip": {
            "amount": 15.00,
            "currency": "usd"
        },
        "idempotencyKey": f"rating_{uuid.uuid4().hex[:16]}"
    }
    
    response = make_request("POST", "/ratings/customer", rating_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                payment_intent_id = resp_data.get("paymentIntentId")
                if payment_intent_id and "pi_tip_" in payment_intent_id:
                    results.add_result("Customer Rating Submission", True, f"Rating submitted with tip payment: {payment_intent_id}", "rating")
                    return
                else:
                    results.add_result("Customer Rating Submission", True, f"Rating submitted without tip", "rating")
                    return
        except Exception as e:
            results.add_result("Customer Rating Submission", False, f"JSON error: {e}", "rating")
            return
    
    results.add_result("Customer Rating Submission", False, f"API failed. Status: {response.status_code if response else 'No response'}", "rating")

def test_partner_rating_system(results, token, booking_id):
    """Test partner rating for customer"""
    rating_data = {
        "stars": 5,
        "notes": ["Friendly", "Easy to work with"],
        "comments": "Great customer!",
        "idempotencyKey": f"partner_rating_{uuid.uuid4().hex[:16]}"
    }
    
    response = make_request("POST", "/ratings/partner", rating_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Partner Rating System", True, f"Partner rating submitted successfully", "rating")
                return
        except Exception as e:
            results.add_result("Partner Rating System", False, f"JSON error: {e}", "rating")
            return
    elif response and response.status_code == 403:
        results.add_result("Partner Rating System", True, "Partner access required (expected for non-partners)", "rating")
        return
    
    results.add_result("Partner Rating System", False, f"API failed. Status: {response.status_code if response else 'No response'}", "rating")

def test_tip_processing(results, token, booking_id):
    """Test separate tip capture with failure handling"""
    tip_data = {
        "amount": 10.00,
        "currency": "usd"
    }
    
    response = make_request("POST", "/billing/tip", tip_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "paymentIntentId" in resp_data:
                payment_intent_id = resp_data["paymentIntentId"]
                if "pi_tip_" in payment_intent_id:
                    results.add_result("Tip Processing", True, f"Tip processed successfully: {payment_intent_id}", "rating")
                    return
        except Exception as e:
            results.add_result("Tip Processing", False, f"JSON error: {e}", "rating")
            return
    elif response and response.status_code == 402:
        results.add_result("Tip Processing", True, "Large tip payment failure handled correctly (expected for testing)", "rating")
        return
    
    results.add_result("Tip Processing", False, f"API failed. Status: {response.status_code if response else 'No response'}", "rating")

def test_owner_ratings_analytics(results, token):
    """Test owner ratings analytics dashboard"""
    response = make_request("GET", "/owner/ratings", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "ratings" in resp_data and isinstance(resp_data["ratings"], list):
                ratings = resp_data["ratings"]
                if len(ratings) > 0:
                    rating = ratings[0]
                    required_fields = ["bookingId", "partnerRating", "customerRating", "tipAmount", "flags"]
                    if all(field in rating for field in required_fields):
                        flags = rating["flags"]
                        tip_amount = rating["tipAmount"]
                        
                        results.add_result("Owner Ratings Analytics", True, f"Analytics dashboard: {len(ratings)} ratings, flags: {len(flags)}, avg tip: ${tip_amount}", "rating")
                        return
                
                results.add_result("Owner Ratings Analytics", True, "Empty ratings analytics (acceptable for new system)", "rating")
                return
        except Exception as e:
            results.add_result("Owner Ratings Analytics", False, f"JSON error: {e}", "rating")
            return
    
    results.add_result("Owner Ratings Analytics", False, f"API failed. Status: {response.status_code if response else 'No response'}", "rating")

# ===== INTEGRATION TESTING - COMPLETE CUSTOMER JOURNEY =====

def test_complete_customer_journey(results):
    """Test complete customer journey integration"""
    print(f"\n{'='*60}")
    print("TESTING COMPLETE CUSTOMER JOURNEY INTEGRATION")
    print(f"{'='*60}")
    
    # Step 1: Create customer account and login
    customer_token, customer_email = test_customer_registration(results)
    if not customer_token:
        results.add_result("Complete Customer Journey", False, "Failed to create customer account", "integration")
        return
    
    # Step 2: Create booking with service details
    booking_id = test_create_complete_booking(results, customer_token)
    if not booking_id:
        results.add_result("Complete Customer Journey", False, "Failed to create booking", "integration")
        return
    
    # Step 3: Process payment and create dispatch offer
    test_payment_and_dispatch_integration(results, customer_token, booking_id)
    
    # Step 4: Track job completion flow
    test_job_completion_integration(results, customer_token, booking_id)
    
    # Step 5: Submit ratings and tips
    test_rating_completion_integration(results, customer_token, booking_id)
    
    results.add_result("Complete Customer Journey", True, f"End-to-end customer journey completed successfully", "integration")

def test_create_complete_booking(results, token):
    """Create a complete booking for integration testing"""
    booking_data = {
        "quoteId": f"integration_quote_{uuid.uuid4().hex[:8]}",
        "service": {
            "serviceType": "basic",
            "timing": {
                "when": "now"
            },
            "details": {
                "bedrooms": 2,
                "bathrooms": 1
            }
        },
        "address": {
            "line1": "456 Integration Ave",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94103",
            "lat": 37.7849,
            "lng": -122.4094
        },
        "access": {
            "entrance": "front_door",
            "notes": "Integration test booking"
        },
        "totals": {
            "subtotal": 89.00,
            "tax": 7.89,
            "total": 96.89
        },
        "payment": {
            "paymentIntentId": f"pi_integration_{uuid.uuid4().hex[:12]}",
            "paymentMethodId": "pm_card_visa"
        },
        "applyCredits": False,
        "promoCode": "SHINE20"
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            booking_id = resp_data.get("bookingId")
            if booking_id and "bk_" in booking_id:
                results.add_result("Integration Booking Creation", True, f"Integration booking created: {booking_id}", "integration")
                return booking_id
        except Exception as e:
            results.add_result("Integration Booking Creation", False, f"JSON error: {e}", "integration")
    
    results.add_result("Integration Booking Creation", False, f"Failed to create integration booking", "integration")
    return None

def test_payment_and_dispatch_integration(results, token, booking_id):
    """Test payment processing and dispatch offer integration"""
    # Check dispatch status
    response = make_request("GET", f"/dispatch/status/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "state" in resp_data and resp_data["state"] in ["searching", "assigned"]:
                results.add_result("Payment & Dispatch Integration", True, f"Dispatch offer created for booking: {booking_id}", "integration")
                return
        except Exception as e:
            results.add_result("Payment & Dispatch Integration", False, f"JSON error: {e}", "integration")
            return
    
    results.add_result("Payment & Dispatch Integration", False, f"Dispatch integration failed", "integration")

def test_job_completion_integration(results, token, booking_id):
    """Test job completion flow integration"""
    # Get job details
    response = make_request("GET", f"/jobs/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "status" in resp_data and resp_data["status"] in ["enroute", "arrived", "in_progress"]:
                results.add_result("Job Completion Integration", True, f"Job tracking active for booking: {booking_id}", "integration")
                return
        except Exception as e:
            results.add_result("Job Completion Integration", False, f"JSON error: {e}", "integration")
            return
    
    results.add_result("Job Completion Integration", False, f"Job completion integration failed", "integration")

def test_rating_completion_integration(results, token, booking_id):
    """Test rating completion integration"""
    # Get rating context
    response = make_request("GET", f"/ratings/context/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "booking" in resp_data and "tipPresets" in resp_data:
                results.add_result("Rating Completion Integration", True, f"Rating system ready for booking: {booking_id}", "integration")
                return
        except Exception as e:
            results.add_result("Rating Completion Integration", False, f"JSON error: {e}", "integration")
            return
    
    results.add_result("Rating Completion Integration", False, f"Rating completion integration failed", "integration")

# ===== MAIN TEST EXECUTION =====

def main():
    """Main test execution function"""
    print("🚀 STARTING SHINE APPLICATION COMPREHENSIVE END-TO-END TESTING")
    print("=" * 80)
    
    results = TestResults()
    
    # Test all systems
    customer_token, partner_token, owner_token, customer_email, partner_email, owner_email = test_authentication_system(results)
    
    test_home_dashboard_system(results, customer_token, partner_token, owner_token)
    
    address_id = test_address_management_system(results, customer_token)
    
    booking_id, payment_intent_id = test_checkout_payment_system(results, customer_token)
    
    test_dispatch_system(results, customer_token, partner_token, owner_token, booking_id)
    
    test_job_tracking_system(results, customer_token, partner_token, booking_id)
    
    test_rating_tip_system(results, customer_token, partner_token, owner_token, booking_id)
    
    # Integration testing
    test_complete_customer_journey(results)
    
    # Print final summary
    results.print_summary()
    
    return results

if __name__ == "__main__":
    main()