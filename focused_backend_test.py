#!/usr/bin/env python3
"""
SHINE Backend Core Systems Test - Focused Testing
Tests core functionality of all 47 API endpoints across 7 major systems
"""

import requests
import json
import time
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://shine-app-debug.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.system_results = {}
    
    def add_result(self, test_name, passed, message="", system="General"):
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
        print(f"SHINE BACKEND COMPREHENSIVE TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        print(f"\n{'='*80}")
        print(f"SYSTEM BREAKDOWN:")
        print(f"{'='*80}")
        for system, results in self.system_results.items():
            total = results["passed"] + results["failed"]
            success_rate = (results["passed"] / total * 100) if total > 0 else 0
            print(f"{system}: {results['passed']}/{total} ({success_rate:.1f}%)")

def make_request(method, endpoint, data=None, headers=None, auth_token=None, timeout=15):
    """Helper function to make HTTP requests with better error handling"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, timeout=timeout)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.Timeout:
        print(f"   TIMEOUT: {method} {endpoint}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"   ERROR: {method} {endpoint} - {e}")
        return None

def test_system_1_authentication(results):
    """Test Enhanced SHINE Auth v3.0 System (8 endpoints)"""
    print(f"\n🔐 TESTING SYSTEM 1: ENHANCED SHINE AUTH v3.0")
    
    # Test 1: Customer Signup
    customer_email = f"customer_{uuid.uuid4().hex[:8]}@example.com"
    customer_username = f"customer_{uuid.uuid4().hex[:8]}"
    
    signup_data = {
        "email": customer_email,
        "username": customer_username,
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
                customer_token = resp_data["token"]
                results.add_result("Customer Signup", True, f"Customer registered: {customer_email}", "AUTH")
            else:
                results.add_result("Customer Signup", False, "Invalid response structure", "AUTH")
                return None, None, None, None
        except:
            results.add_result("Customer Signup", False, "JSON parsing error", "AUTH")
            return None, None, None, None
    else:
        results.add_result("Customer Signup", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
        return None, None, None, None
    
    # Test 2: Partner Signup
    partner_email = f"partner_{uuid.uuid4().hex[:8]}@example.com"
    partner_username = f"partner_{uuid.uuid4().hex[:8]}"
    
    signup_data["email"] = partner_email
    signup_data["username"] = partner_username
    signup_data["role"] = "partner"
    signup_data["phone"] = "+14155552672"
    
    response = make_request("POST", "/auth/signup", signup_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data["user"]["partner_status"] == "pending":
                partner_token = resp_data["token"]
                results.add_result("Partner Signup", True, f"Partner registered with pending status: {partner_email}", "AUTH")
            else:
                results.add_result("Partner Signup", False, "Partner status not set correctly", "AUTH")
                return customer_token, customer_email, None, None
        except:
            results.add_result("Partner Signup", False, "JSON parsing error", "AUTH")
            return customer_token, customer_email, None, None
    else:
        results.add_result("Partner Signup", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
        return customer_token, customer_email, None, None
    
    # Test 3: Owner Signup with MFA
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@example.com"
    owner_username = f"owner_{uuid.uuid4().hex[:8]}"
    
    signup_data["email"] = owner_email
    signup_data["username"] = owner_username
    signup_data["role"] = "owner"
    signup_data["phone"] = "+14155552673"
    
    response = make_request("POST", "/auth/signup", signup_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data["user"]["mfa_enabled"] is True:
                owner_token = resp_data["token"]
                results.add_result("Owner Signup", True, f"Owner registered with MFA enabled: {owner_email}", "AUTH")
            else:
                results.add_result("Owner Signup", False, "MFA not enabled for owner", "AUTH")
                return customer_token, customer_email, partner_token, partner_email
        except:
            results.add_result("Owner Signup", False, "JSON parsing error", "AUTH")
            return customer_token, customer_email, partner_token, partner_email
    else:
        results.add_result("Owner Signup", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
        return customer_token, customer_email, partner_token, partner_email
    
    # Test 4: Email Login
    login_data = {
        "identifier": customer_email,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data:
                results.add_result("Email Login", True, f"Email login successful: {customer_email}", "AUTH")
            else:
                results.add_result("Email Login", False, "No token in response", "AUTH")
        except:
            results.add_result("Email Login", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("Email Login", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 5: Username Login
    login_data["identifier"] = customer_username
    
    response = make_request("POST", "/auth/login", login_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data:
                results.add_result("Username Login", True, f"Username login successful: {customer_username}", "AUTH")
            else:
                results.add_result("Username Login", False, "No token in response", "AUTH")
        except:
            results.add_result("Username Login", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("Username Login", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 6: Owner MFA Flow
    login_data = {
        "identifier": owner_email,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("mfa_required") is True and "dev_mfa_code" in resp_data:
                user_id = resp_data["user_id"]
                mfa_code = resp_data["dev_mfa_code"]
                results.add_result("Owner MFA Required", True, f"MFA code generated: {mfa_code}", "AUTH")
                
                # Test MFA verification
                mfa_data = {
                    "user_id": user_id,
                    "code": mfa_code
                }
                
                response = make_request("POST", "/auth/mfa/verify", mfa_data)
                if response and response.status_code == 200:
                    try:
                        resp_data = response.json()
                        if resp_data.get("ok") is True and "token" in resp_data:
                            owner_token = resp_data["token"]
                            results.add_result("MFA Verification", True, "MFA verification successful", "AUTH")
                        else:
                            results.add_result("MFA Verification", False, "Invalid MFA response", "AUTH")
                    except:
                        results.add_result("MFA Verification", False, "JSON parsing error", "AUTH")
                else:
                    results.add_result("MFA Verification", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
            else:
                results.add_result("Owner MFA Required", False, "MFA not required or invalid response", "AUTH")
        except:
            results.add_result("Owner MFA Required", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("Owner MFA Required", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 7: JWT Token Validation
    response = make_request("GET", "/auth/me", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            user_data = response.json()
            if "id" in user_data and "email" in user_data:
                results.add_result("JWT Token Validation", True, f"Token validated for: {user_data['email']}", "AUTH")
            else:
                results.add_result("JWT Token Validation", False, "Invalid user data", "AUTH")
        except:
            results.add_result("JWT Token Validation", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("JWT Token Validation", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 8: Password Reset Start
    reset_data = {
        "email_or_phone": customer_email
    }
    
    response = make_request("POST", "/auth/reset/start", reset_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("sent") is True and resp_data.get("channel") == "email":
                results.add_result("Password Reset Start", True, f"Reset OTP sent via email: {customer_email}", "AUTH")
            else:
                results.add_result("Password Reset Start", False, "Invalid reset response", "AUTH")
        except:
            results.add_result("Password Reset Start", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("Password Reset Start", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    return customer_token, customer_email, partner_token, partner_email

def test_system_2_home_dashboard(results, customer_token, partner_token, owner_token):
    """Test Home Dashboard Systems (4 endpoints)"""
    print(f"\n🏠 TESTING SYSTEM 2: HOME DASHBOARD SYSTEMS")
    
    # Test 1: Customer Nearby Partners
    response = make_request("GET", "/partners/nearby?lat=37.7749&lng=-122.4194")
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "partners" in resp_data and isinstance(resp_data["partners"], list):
                results.add_result("Customer Nearby Partners", True, f"Retrieved {len(resp_data['partners'])} nearby partners", "HOME")
            else:
                results.add_result("Customer Nearby Partners", False, "Invalid response structure", "HOME")
        except:
            results.add_result("Customer Nearby Partners", False, "JSON parsing error", "HOME")
    else:
        results.add_result("Customer Nearby Partners", False, f"Status: {response.status_code if response else 'No response'}", "HOME")
    
    # Test 2: Surge Pricing Data
    response = make_request("GET", "/pricing/surge?lat=37.7749&lng=-122.4194")
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "active" in resp_data and "multiplier" in resp_data:
                results.add_result("Surge Pricing Data", True, f"Surge data: active={resp_data['active']}, multiplier={resp_data['multiplier']}", "HOME")
            else:
                results.add_result("Surge Pricing Data", False, "Invalid response structure", "HOME")
        except:
            results.add_result("Surge Pricing Data", False, "JSON parsing error", "HOME")
    else:
        results.add_result("Surge Pricing Data", False, f"Status: {response.status_code if response else 'No response'}", "HOME")
    
    # Test 3: Partner Dashboard
    response = make_request("GET", "/partner/home", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "status" in resp_data and "verification" in resp_data:
                results.add_result("Partner Dashboard", True, f"Dashboard data: status={resp_data['status']}, verification={resp_data['verification']}", "HOME")
            else:
                results.add_result("Partner Dashboard", False, "Invalid response structure", "HOME")
        except:
            results.add_result("Partner Dashboard", False, "JSON parsing error", "HOME")
    else:
        results.add_result("Partner Dashboard", False, f"Status: {response.status_code if response else 'No response'}", "HOME")
    
    # Test 4: Owner Dashboard Tiles
    response = make_request("GET", "/owner/tiles", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "activeJobs" in resp_data and "partnersOnline" in resp_data:
                results.add_result("Owner Dashboard Tiles", True, f"Tiles data: activeJobs={resp_data['activeJobs']}, partnersOnline={resp_data['partnersOnline']}", "HOME")
            else:
                results.add_result("Owner Dashboard Tiles", False, "Invalid response structure", "HOME")
        except:
            results.add_result("Owner Dashboard Tiles", False, "JSON parsing error", "HOME")
    else:
        results.add_result("Owner Dashboard Tiles", False, f"Status: {response.status_code if response else 'No response'}", "HOME")

def test_system_3_address_management(results, customer_token):
    """Test Address Management System (5 endpoints)"""
    print(f"\n📍 TESTING SYSTEM 3: ADDRESS MANAGEMENT SYSTEM")
    
    # Test 1: List Addresses (Empty)
    response = make_request("GET", "/addresses", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "addresses" in resp_data and isinstance(resp_data["addresses"], list):
                results.add_result("List Saved Addresses", True, f"Retrieved {len(resp_data['addresses'])} addresses", "ADDRESS")
            else:
                results.add_result("List Saved Addresses", False, "Invalid response structure", "ADDRESS")
        except:
            results.add_result("List Saved Addresses", False, "JSON parsing error", "ADDRESS")
    else:
        results.add_result("List Saved Addresses", False, f"Status: {response.status_code if response else 'No response'}", "ADDRESS")
    
    # Test 2: Save New Address
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
    
    response = make_request("POST", "/addresses", address_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "id" in resp_data:
                results.add_result("Save New Address", True, f"Address saved with ID: {resp_data['id']}", "ADDRESS")
            else:
                results.add_result("Save New Address", False, "No ID in response", "ADDRESS")
        except:
            results.add_result("Save New Address", False, "JSON parsing error", "ADDRESS")
    else:
        results.add_result("Save New Address", False, f"Status: {response.status_code if response else 'No response'}", "ADDRESS")
    
    # Test 3: Places Autocomplete
    response = make_request("GET", "/places/autocomplete?q=Main Street")
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "candidates" in resp_data and isinstance(resp_data["candidates"], list):
                results.add_result("Places Autocomplete", True, f"Retrieved {len(resp_data['candidates'])} candidates", "ADDRESS")
            else:
                results.add_result("Places Autocomplete", False, "Invalid response structure", "ADDRESS")
        except:
            results.add_result("Places Autocomplete", False, "JSON parsing error", "ADDRESS")
    else:
        results.add_result("Places Autocomplete", False, f"Status: {response.status_code if response else 'No response'}", "ADDRESS")
    
    # Test 4: ETA Preview (Now)
    eta_data = {
        "lat": 37.7749,
        "lng": -122.4194,
        "timing": {"when": "now"}
    }
    
    response = make_request("POST", "/eta/preview", eta_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "window" in resp_data and "distanceKm" in resp_data:
                results.add_result("ETA Preview (Now)", True, f"ETA: {resp_data['window']}, Distance: {resp_data['distanceKm']}km", "ADDRESS")
            else:
                results.add_result("ETA Preview (Now)", False, "Invalid response structure", "ADDRESS")
        except:
            results.add_result("ETA Preview (Now)", False, "JSON parsing error", "ADDRESS")
    else:
        results.add_result("ETA Preview (Now)", False, f"Status: {response.status_code if response else 'No response'}", "ADDRESS")
    
    # Test 5: ETA Preview (Scheduled)
    eta_data["timing"] = {"when": "schedule", "scheduleAt": "2024-01-15T14:30:00Z"}
    
    response = make_request("POST", "/eta/preview", eta_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "window" in resp_data and "distanceKm" in resp_data:
                results.add_result("ETA Preview (Scheduled)", True, f"Scheduled ETA: {resp_data['window']}, Distance: {resp_data['distanceKm']}km", "ADDRESS")
            else:
                results.add_result("ETA Preview (Scheduled)", False, "Invalid response structure", "ADDRESS")
        except:
            results.add_result("ETA Preview (Scheduled)", False, "JSON parsing error", "ADDRESS")
    else:
        results.add_result("ETA Preview (Scheduled)", False, f"Status: {response.status_code if response else 'No response'}", "ADDRESS")

def test_system_4_checkout_payment(results, customer_token):
    """Test Checkout & Payment System (10 endpoints)"""
    print(f"\n💳 TESTING SYSTEM 4: CHECKOUT & PAYMENT SYSTEM")
    
    # Test 1: List Payment Methods
    response = make_request("GET", "/billing/methods", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "methods" in resp_data and isinstance(resp_data["methods"], list):
                results.add_result("List Payment Methods", True, f"Retrieved {len(resp_data['methods'])} payment methods", "CHECKOUT")
            else:
                results.add_result("List Payment Methods", False, "Invalid response structure", "CHECKOUT")
        except:
            results.add_result("List Payment Methods", False, "JSON parsing error", "CHECKOUT")
    else:
        results.add_result("List Payment Methods", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    
    # Test 2: Create Setup Intent
    response = make_request("POST", "/billing/setup-intent", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "clientSecret" in resp_data:
                results.add_result("Create Setup Intent", True, "Setup intent created successfully", "CHECKOUT")
            else:
                results.add_result("Create Setup Intent", False, "No clientSecret in response", "CHECKOUT")
        except:
            results.add_result("Create Setup Intent", False, "JSON parsing error", "CHECKOUT")
    else:
        results.add_result("Create Setup Intent", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    
    # Test 3: Attach Payment Method
    attach_data = {"paymentMethodId": "pm_test_card_visa"}
    
    response = make_request("POST", "/billing/methods", attach_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Attach Payment Method", True, "Payment method attached successfully", "CHECKOUT")
            else:
                results.add_result("Attach Payment Method", False, "Attachment failed", "CHECKOUT")
        except:
            results.add_result("Attach Payment Method", False, "JSON parsing error", "CHECKOUT")
    else:
        results.add_result("Attach Payment Method", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    
    # Test 4-6: Apply Promo Codes (SHINE20, FIRST10, SAVE15)
    promo_codes = ["SHINE20", "FIRST10", "SAVE15"]
    for promo_code in promo_codes:
        promo_data = {
            "quoteId": "quote_test123",
            "code": promo_code,
            "useCredits": False
        }
        
        response = make_request("POST", "/pricing/promo/apply", promo_data, auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("promoApplied") is True:
                    results.add_result(f"Apply Promo Code ({promo_code})", True, f"Promo applied, total: ${resp_data['total']}", "CHECKOUT")
                else:
                    results.add_result(f"Apply Promo Code ({promo_code})", False, "Promo not applied", "CHECKOUT")
            except:
                results.add_result(f"Apply Promo Code ({promo_code})", False, "JSON parsing error", "CHECKOUT")
        else:
            results.add_result(f"Apply Promo Code ({promo_code})", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    
    # Test 7: Payment Pre-Authorization (Success)
    preauth_data = {
        "amount": 89.50,
        "currency": "usd",
        "paymentMethodId": "pm_card_visa",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", preauth_data, auth_token=customer_token)
    payment_intent_id = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "paymentIntentId" in resp_data:
                payment_intent_id = resp_data["paymentIntentId"]
                results.add_result("Payment Pre-Authorization", True, f"Payment intent created: {payment_intent_id}", "CHECKOUT")
            else:
                results.add_result("Payment Pre-Authorization", False, "No paymentIntentId in response", "CHECKOUT")
        except:
            results.add_result("Payment Pre-Authorization", False, "JSON parsing error", "CHECKOUT")
    else:
        results.add_result("Payment Pre-Authorization", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    
    # Test 8: Stripe Action Confirmation
    if payment_intent_id:
        confirm_data = {"paymentIntentId": payment_intent_id}
        
        response = make_request("POST", "/billing/confirm", confirm_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Stripe Action Confirmation", True, "Stripe action confirmed", "CHECKOUT")
                else:
                    results.add_result("Stripe Action Confirmation", False, "Confirmation failed", "CHECKOUT")
            except:
                results.add_result("Stripe Action Confirmation", False, "JSON parsing error", "CHECKOUT")
        else:
            results.add_result("Stripe Action Confirmation", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    else:
        results.add_result("Stripe Action Confirmation", False, "No payment intent ID available", "CHECKOUT")
    
    # Test 9: Booking Creation
    booking_data = {
        "quoteId": "quote_test123",
        "service": {
            "type": "basic",
            "timing": {"when": "now"},
            "details": {"bedrooms": 2, "bathrooms": 1}
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
            "paymentIntentId": payment_intent_id or "pi_test123",
            "paymentMethodId": "pm_card_visa"
        }
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
    booking_id = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "bookingId" in resp_data:
                booking_id = resp_data["bookingId"]
                results.add_result("Booking Creation", True, f"Booking created: {booking_id}, status: {resp_data['status']}", "CHECKOUT")
            else:
                results.add_result("Booking Creation", False, "No bookingId in response", "CHECKOUT")
        except:
            results.add_result("Booking Creation", False, "JSON parsing error", "CHECKOUT")
    else:
        results.add_result("Booking Creation", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    
    # Test 10: Payment Void
    if payment_intent_id:
        void_data = {"paymentIntentId": payment_intent_id}
        
        response = make_request("POST", "/billing/void", void_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Payment Void", True, "Payment voided successfully", "CHECKOUT")
                else:
                    results.add_result("Payment Void", False, "Void failed", "CHECKOUT")
            except:
                results.add_result("Payment Void", False, "JSON parsing error", "CHECKOUT")
        else:
            results.add_result("Payment Void", False, f"Status: {response.status_code if response else 'No response'}", "CHECKOUT")
    else:
        results.add_result("Payment Void", False, "No payment intent ID available", "CHECKOUT")
    
    return booking_id

def test_system_5_dispatch(results, customer_token, partner_token, owner_token, booking_id):
    """Test Dispatch System (6 endpoints)"""
    print(f"\n🚚 TESTING SYSTEM 5: DISPATCH SYSTEM")
    
    # Test 1: Customer Dispatch Status
    if booking_id:
        response = make_request("GET", f"/dispatch/status/{booking_id}", auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "state" in resp_data and "waitMins" in resp_data:
                    results.add_result("Customer Dispatch Status", True, f"Status: {resp_data['state']}, wait: {resp_data['waitMins']}min", "DISPATCH")
                else:
                    results.add_result("Customer Dispatch Status", False, "Invalid response structure", "DISPATCH")
            except:
                results.add_result("Customer Dispatch Status", False, "JSON parsing error", "DISPATCH")
        else:
            results.add_result("Customer Dispatch Status", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    else:
        results.add_result("Customer Dispatch Status", False, "No booking ID available", "DISPATCH")
    
    # Test 2: Partner Offer Polling
    response = make_request("GET", "/partner/offers/poll", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "offer" in resp_data:
                results.add_result("Partner Offer Polling", True, f"Offer polling successful: {resp_data['offer']}", "DISPATCH")
            else:
                results.add_result("Partner Offer Polling", False, "No offer field in response", "DISPATCH")
        except:
            results.add_result("Partner Offer Polling", False, "JSON parsing error", "DISPATCH")
    else:
        results.add_result("Partner Offer Polling", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    
    # Test 3: Partner Accept Offer
    offer_id = f"of_{uuid.uuid4().hex[:16]}"
    accept_data = {"idempotencyKey": str(uuid.uuid4())}
    
    response = make_request("POST", f"/partner/offers/{offer_id}/accept", accept_data, auth_token=partner_token)
    if response and response.status_code in [200, 410, 409, 423]:  # Various valid responses
        results.add_result("Partner Accept Offer", True, f"Accept offer handled correctly (Status: {response.status_code})", "DISPATCH")
    else:
        results.add_result("Partner Accept Offer", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    
    # Test 4: Partner Decline Offer
    response = make_request("POST", f"/partner/offers/{offer_id}/decline", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Partner Decline Offer", True, "Offer declined successfully", "DISPATCH")
            else:
                results.add_result("Partner Decline Offer", False, "Decline failed", "DISPATCH")
        except:
            results.add_result("Partner Decline Offer", False, "JSON parsing error", "DISPATCH")
    else:
        results.add_result("Partner Decline Offer", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    
    # Test 5: Customer Cancel Booking
    if booking_id:
        cancel_data = {"reason": "Changed my mind"}
        
        response = make_request("POST", f"/bookings/{booking_id}/cancel", cancel_data, auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Customer Cancel Booking", True, f"Booking cancelled: fee=${resp_data.get('fee', 0)}", "DISPATCH")
                else:
                    results.add_result("Customer Cancel Booking", False, "Cancellation failed", "DISPATCH")
            except:
                results.add_result("Customer Cancel Booking", False, "JSON parsing error", "DISPATCH")
        else:
            results.add_result("Customer Cancel Booking", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    else:
        results.add_result("Customer Cancel Booking", False, "No booking ID available", "DISPATCH")
    
    # Test 6: Owner Dispatch Dashboard
    response = make_request("GET", "/owner/dispatch", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "kpis" in resp_data and "offers" in resp_data:
                kpis = resp_data["kpis"]
                results.add_result("Owner Dispatch Dashboard", True, f"Dashboard loaded: {kpis['offersActive']} active offers, {kpis['acceptRate']:.1f}% accept rate", "DISPATCH")
            else:
                results.add_result("Owner Dispatch Dashboard", False, "Invalid response structure", "DISPATCH")
        except:
            results.add_result("Owner Dispatch Dashboard", False, "JSON parsing error", "DISPATCH")
    else:
        results.add_result("Owner Dispatch Dashboard", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")

def test_system_6_job_tracking(results, customer_token, partner_token, booking_id):
    """Test Job Tracking System (19 endpoints) - Core functionality"""
    print(f"\n📋 TESTING SYSTEM 6: JOB TRACKING SYSTEM")
    
    if not booking_id:
        results.add_result("Job System Setup", False, "No booking ID available for job testing", "JOB")
        return
    
    # Test 1: Get Job Details
    response = make_request("GET", f"/jobs/{booking_id}", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "bookingId" in resp_data and "status" in resp_data:
                results.add_result("Get Job Details", True, f"Job details: {resp_data['bookingId']}, status: {resp_data['status']}", "JOB")
            else:
                results.add_result("Get Job Details", False, "Invalid response structure", "JOB")
        except:
            results.add_result("Get Job Details", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Get Job Details", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 2: Presigned URL Generation
    presign_data = {"contentType": "image/jpeg"}
    
    response = make_request("POST", "/media/presign", presign_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "uploadUrl" in resp_data and "fileId" in resp_data:
                results.add_result("Presigned URL Generation", True, f"URL generated: {resp_data['fileId']}", "JOB")
            else:
                results.add_result("Presigned URL Generation", False, "Invalid response structure", "JOB")
        except:
            results.add_result("Presigned URL Generation", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Presigned URL Generation", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 3: Chat Messaging (Customer)
    chat_data = {
        "text": "Hello, I'm ready for the service"
    }
    
    response = make_request("POST", f"/comm/chat/{booking_id}", chat_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "id" in resp_data:
                results.add_result("Chat Messaging (Customer)", True, f"Message sent: {resp_data['id']}", "JOB")
            else:
                results.add_result("Chat Messaging (Customer)", False, "No message ID in response", "JOB")
        except:
            results.add_result("Chat Messaging (Customer)", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Chat Messaging (Customer)", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 4: Get Chat Messages
    response = make_request("GET", f"/comm/chat/{booking_id}", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "messages" in resp_data:
                results.add_result("Get Chat Messages", True, f"Retrieved {len(resp_data['messages'])} messages", "JOB")
            else:
                results.add_result("Get Chat Messages", False, "No messages field in response", "JOB")
        except:
            results.add_result("Get Chat Messages", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Get Chat Messages", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 5: Masked Call Initiation
    call_data = {
        "bookingId": booking_id,
        "to": "partner"
    }
    
    response = make_request("POST", "/comm/call", call_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "callId" in resp_data and "proxyNumber" in resp_data:
                results.add_result("Masked Call Initiation", True, f"Call initiated: {resp_data['callId']}", "JOB")
            else:
                results.add_result("Masked Call Initiation", False, "Invalid response structure", "JOB")
        except:
            results.add_result("Masked Call Initiation", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Masked Call Initiation", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 6: Payment Capture Start
    capture_data = {
        "paymentIntentId": "pi_test123",
        "amount": 50.0
    }
    
    response = make_request("POST", "/billing/capture/start", capture_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Payment Capture Start", True, "Payment captured at start", "JOB")
            else:
                results.add_result("Payment Capture Start", False, "Capture failed", "JOB")
        except:
            results.add_result("Payment Capture Start", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Payment Capture Start", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 7: Payment Capture Finish
    response = make_request("POST", "/billing/capture/finish", capture_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Payment Capture Finish", True, "Payment captured at finish", "JOB")
            else:
                results.add_result("Payment Capture Finish", False, "Capture failed", "JOB")
        except:
            results.add_result("Payment Capture Finish", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Payment Capture Finish", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 8: Customer Job Approval
    response = make_request("POST", f"/jobs/{booking_id}/approve", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Customer Job Approval", True, f"Job approved: {resp_data['status']}", "JOB")
            else:
                results.add_result("Customer Job Approval", False, "Approval failed", "JOB")
        except:
            results.add_result("Customer Job Approval", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Customer Job Approval", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 9: Customer Issue Reporting
    issue_data = {
        "reason": "Quality issue with cleaning",
        "photoIds": ["img_test1", "img_test2"]
    }
    
    response = make_request("POST", f"/jobs/{booking_id}/issue", issue_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "ticketId" in resp_data:
                results.add_result("Customer Issue Reporting", True, f"Issue reported: {resp_data['ticketId']}", "JOB")
            else:
                results.add_result("Customer Issue Reporting", False, "No ticket ID in response", "JOB")
        except:
            results.add_result("Customer Issue Reporting", False, "JSON parsing error", "JOB")
    else:
        results.add_result("Customer Issue Reporting", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 10: SOS Emergency Support
    sos_data = {
        "bookingId": booking_id,
        "lat": 37.7749,
        "lng": -122.4194,
        "role": "customer"
    }
    
    response = make_request("POST", "/support/sos", sos_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("SOS Emergency Support", True, "SOS alert sent successfully", "JOB")
            else:
                results.add_result("SOS Emergency Support", False, "SOS failed", "JOB")
        except:
            results.add_result("SOS Emergency Support", False, "JSON parsing error", "JOB")
    else:
        results.add_result("SOS Emergency Support", False, f"Status: {response.status_code if response else 'No response'}", "JOB")

def test_system_7_rating_tip(results, customer_token, partner_token, owner_token, booking_id):
    """Test Rating & Tip System (5 endpoints)"""
    print(f"\n⭐ TESTING SYSTEM 7: RATING & TIP SYSTEM")
    
    if not booking_id:
        results.add_result("Rating System Setup", False, "No booking ID available for rating testing", "RATING")
        return
    
    # Test 1: Rating Context Retrieval
    response = make_request("GET", f"/ratings/context/{booking_id}", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "booking" in resp_data and "tipPresets" in resp_data:
                results.add_result("Rating Context Retrieval", True, f"Context retrieved: total=${resp_data['booking']['total']}, {len(resp_data['tipPresets'])} tip presets", "RATING")
            else:
                results.add_result("Rating Context Retrieval", False, "Invalid response structure", "RATING")
        except:
            results.add_result("Rating Context Retrieval", False, "JSON parsing error", "RATING")
    else:
        results.add_result("Rating Context Retrieval", False, f"Status: {response.status_code if response else 'No response'}", "RATING")
    
    # Test 2: Customer Rating Submission
    rating_data = {
        "bookingId": booking_id,
        "stars": 5,
        "compliments": ["professional", "thorough"],
        "comments": "Excellent service!",
        "tip": {
            "amount": 15.0,
            "currency": "usd"
        },
        "idempotencyKey": str(uuid.uuid4())
    }
    
    response = make_request("POST", "/ratings/customer", rating_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Customer Rating Submission", True, f"Rating submitted with tip: ${rating_data['tip']['amount']}", "RATING")
            else:
                results.add_result("Customer Rating Submission", False, "Rating submission failed", "RATING")
        except:
            results.add_result("Customer Rating Submission", False, "JSON parsing error", "RATING")
    else:
        results.add_result("Customer Rating Submission", False, f"Status: {response.status_code if response else 'No response'}", "RATING")
    
    # Test 3: Partner Rating Submission
    partner_rating_data = {
        "bookingId": booking_id,
        "stars": 5,
        "notes": ["punctual", "communicative"],
        "comments": "Great customer!",
        "idempotencyKey": str(uuid.uuid4())
    }
    
    response = make_request("POST", "/ratings/partner", partner_rating_data, auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Partner Rating Submission", True, "Partner rating submitted successfully", "RATING")
            else:
                results.add_result("Partner Rating Submission", False, "Partner rating submission failed", "RATING")
        except:
            results.add_result("Partner Rating Submission", False, "JSON parsing error", "RATING")
    else:
        results.add_result("Partner Rating Submission", False, f"Status: {response.status_code if response else 'No response'}", "RATING")
    
    # Test 4: Separate Tip Capture
    tip_data = {
        "amount": 12.5,
        "currency": "usd"
    }
    
    response = make_request("POST", "/billing/tip", tip_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "paymentIntentId" in resp_data:
                results.add_result("Separate Tip Capture", True, f"Tip captured: ${tip_data['amount']}, payment_intent: {resp_data['paymentIntentId']}", "RATING")
            else:
                results.add_result("Separate Tip Capture", False, "No payment intent ID in response", "RATING")
        except:
            results.add_result("Separate Tip Capture", False, "JSON parsing error", "RATING")
    else:
        results.add_result("Separate Tip Capture", False, f"Status: {response.status_code if response else 'No response'}", "RATING")
    
    # Test 5: Owner Ratings Dashboard
    response = make_request("GET", "/owner/ratings", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "ratings" in resp_data and isinstance(resp_data["ratings"], list):
                results.add_result("Owner Ratings Dashboard", True, f"Dashboard retrieved with {len(resp_data['ratings'])} rating items", "RATING")
            else:
                results.add_result("Owner Ratings Dashboard", False, "Invalid response structure", "RATING")
        except:
            results.add_result("Owner Ratings Dashboard", False, "JSON parsing error", "RATING")
    else:
        results.add_result("Owner Ratings Dashboard", False, f"Status: {response.status_code if response else 'No response'}", "RATING")

def main():
    """Run comprehensive SHINE backend testing"""
    print("🚀 Starting SHINE Backend Comprehensive Testing")
    print(f"Testing API at: {BASE_URL}")
    print("="*80)
    
    results = TestResults()
    
    # Test API Health
    response = make_request("GET", "/")
    if not response or response.status_code != 200:
        results.add_result("API Health Check", False, f"API not accessible. Status: {response.status_code if response else 'No response'}")
        print("❌ API is not accessible. Stopping tests.")
        results.print_summary()
        return
    
    try:
        data = response.json()
        if "message" in data and "v3.0" in data["message"]:
            results.add_result("API Health Check", True, f"API accessible: {data['message']}")
        else:
            results.add_result("API Health Check", False, "Invalid API response")
            results.print_summary()
            return
    except:
        results.add_result("API Health Check", False, "JSON parsing error")
        results.print_summary()
        return
    
    # Run system tests
    customer_token, customer_email, partner_token, partner_email = test_system_1_authentication(results)
    
    if not customer_token:
        print("❌ Authentication failed. Cannot continue with other tests.")
        results.print_summary()
        return
    
    # Create owner token for testing (simplified)
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@example.com"
    owner_signup_data = {
        "email": owner_email,
        "username": f"owner_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155552673",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", owner_signup_data)
    owner_token = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            owner_token = resp_data["token"]
        except:
            pass
    
    test_system_2_home_dashboard(results, customer_token, partner_token, owner_token)
    test_system_3_address_management(results, customer_token)
    booking_id = test_system_4_checkout_payment(results, customer_token)
    test_system_5_dispatch(results, customer_token, partner_token, owner_token, booking_id)
    test_system_6_job_tracking(results, customer_token, partner_token, booking_id)
    test_system_7_rating_tip(results, customer_token, partner_token, owner_token, booking_id)
    
    results.print_summary()

if __name__ == "__main__":
    main()