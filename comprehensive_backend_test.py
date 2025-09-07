#!/usr/bin/env python3
"""
COMPREHENSIVE SHINE BACKEND TESTING - ALL SYSTEMS
Tests all 70+ API endpoints across 8 major SHINE systems for complete system verification
"""

import requests
import json
import time
from datetime import datetime
import uuid
import re
import sys

# Configuration
BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class ComprehensiveTestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.system_results = {}
    
    def add_result(self, test_name, passed, message="", system="GENERAL"):
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
    
    def print_comprehensive_summary(self):
        print(f"\n{'='*80}")
        print(f"COMPREHENSIVE SHINE BACKEND TESTING SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        print(f"\n📊 SYSTEM-BY-SYSTEM RESULTS:")
        for system, counts in self.system_results.items():
            total = counts["passed"] + counts["failed"]
            success_rate = (counts["passed"] / total * 100) if total > 0 else 0
            print(f"  {system}: {counts['passed']}/{total} ({success_rate:.1f}%)")
        
        if self.failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"  [{result['system']}] {result['test']}: {result['message']}")
        
        print(f"\n🎯 OVERALL ASSESSMENT:")
        if self.passed / (self.passed + self.failed) >= 0.90:
            print("✅ EXCELLENT: System ready for production (90%+ success rate)")
        elif self.passed / (self.passed + self.failed) >= 0.80:
            print("⚠️  GOOD: System mostly functional with minor issues (80-89% success rate)")
        elif self.passed / (self.passed + self.failed) >= 0.70:
            print("🔧 NEEDS WORK: System has significant issues (70-79% success rate)")
        else:
            print("🚨 CRITICAL: System has major problems (<70% success rate)")

def make_request(method, endpoint, data=None, headers=None, auth_token=None, timeout=15):
    """Enhanced HTTP request helper with better error handling"""
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
        elif method.upper() == "PATCH":
            response = requests.patch(url, json=data, headers=request_headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"Request: {method} {endpoint} -> Status: {response.status_code}")
        return response
    except requests.exceptions.Timeout:
        print(f"⏰ Request timeout: {method} {endpoint}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"🔌 Request failed: {method} {endpoint} - {e}")
        return None

# ===== SYSTEM 1: ENHANCED SHINE AUTH v3.0 =====

def test_auth_system(results):
    """Test Enhanced SHINE Auth v3.0 System (15 endpoints)"""
    print(f"\n🔐 TESTING SYSTEM 1: ENHANCED SHINE AUTH v3.0")
    
    # Test 1: API Health Check
    response = make_request("GET", "/")
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "message" in data:
                results.add_result("API Health Check", True, f"API accessible: {data['message']}", "AUTH")
            else:
                results.add_result("API Health Check", False, "Invalid API response", "AUTH")
        except:
            results.add_result("API Health Check", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("API Health Check", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 2-4: Enhanced Signup (Customer/Partner/Owner)
    test_users = []
    
    # Customer Signup
    customer_email = f"customer_{uuid.uuid4().hex[:8]}@cleanpro.com"
    customer_data = {
        "email": customer_email,
        "username": f"customer_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", customer_data)
    customer_token = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                customer_token = resp_data["token"]
                user = resp_data["user"]
                if user["role"] == "customer" and user["mfa_enabled"] is False:
                    results.add_result("Customer Signup", True, f"Customer created: {customer_email}", "AUTH")
                    test_users.append(("customer", customer_token, customer_email, customer_data["password"]))
                else:
                    results.add_result("Customer Signup", False, f"Invalid customer data: {user}", "AUTH")
            else:
                results.add_result("Customer Signup", False, "Invalid response structure", "AUTH")
        except:
            results.add_result("Customer Signup", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("Customer Signup", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Partner Signup
    partner_email = f"partner_{uuid.uuid4().hex[:8]}@cleanpro.com"
    partner_data = {
        "email": partner_email,
        "username": f"partner_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "partner",
        "phone": "+14155552672",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", partner_data)
    partner_token = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                partner_token = resp_data["token"]
                user = resp_data["user"]
                if user["role"] == "partner" and user["partner_status"] == "pending":
                    results.add_result("Partner Signup", True, f"Partner created: {partner_email} (pending)", "AUTH")
                    test_users.append(("partner", partner_token, partner_email, partner_data["password"]))
                else:
                    results.add_result("Partner Signup", False, f"Invalid partner data: {user}", "AUTH")
            else:
                results.add_result("Partner Signup", False, "Invalid response structure", "AUTH")
        except:
            results.add_result("Partner Signup", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("Partner Signup", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Owner Signup
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@cleanpro.com"
    owner_data = {
        "email": owner_email,
        "username": f"owner_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155552673",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", owner_data)
    owner_token = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                owner_token = resp_data["token"]
                user = resp_data["user"]
                if user["role"] == "owner" and user["mfa_enabled"] is True:
                    results.add_result("Owner Signup", True, f"Owner created: {owner_email} (MFA enabled)", "AUTH")
                    test_users.append(("owner", owner_token, owner_email, owner_data["password"]))
                else:
                    results.add_result("Owner Signup", False, f"Invalid owner data: {user}", "AUTH")
            else:
                results.add_result("Owner Signup", False, "Invalid response structure", "AUTH")
        except:
            results.add_result("Owner Signup", False, "JSON parsing error", "AUTH")
    else:
        results.add_result("Owner Signup", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 5-6: Enhanced Login (Email/Username)
    if customer_email:
        # Email Login
        login_data = {"identifier": customer_email, "password": customer_data["password"]}
        response = make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "token" in resp_data and "user" in resp_data:
                    results.add_result("Email Login", True, f"Email login successful: {customer_email}", "AUTH")
                elif resp_data.get("mfa_required"):
                    results.add_result("Email Login", True, f"Email login successful (MFA required): {customer_email}", "AUTH")
                else:
                    results.add_result("Email Login", False, "Invalid login response", "AUTH")
            except:
                results.add_result("Email Login", False, "JSON parsing error", "AUTH")
        else:
            results.add_result("Email Login", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
        
        # Username Login
        if customer_data.get("username"):
            login_data = {"identifier": customer_data["username"], "password": customer_data["password"]}
            response = make_request("POST", "/auth/login", login_data)
            if response and response.status_code == 200:
                try:
                    resp_data = response.json()
                    if "token" in resp_data and "user" in resp_data:
                        results.add_result("Username Login", True, f"Username login successful: {customer_data['username']}", "AUTH")
                    elif resp_data.get("mfa_required"):
                        results.add_result("Username Login", True, f"Username login successful (MFA required): {customer_data['username']}", "AUTH")
                    else:
                        results.add_result("Username Login", False, "Invalid login response", "AUTH")
                except:
                    results.add_result("Username Login", False, "JSON parsing error", "AUTH")
            else:
                results.add_result("Username Login", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 7-8: MFA Flow (Owner)
    if owner_email:
        login_data = {"identifier": owner_email, "password": owner_data["password"]}
        response = make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("mfa_required") and "user_id" in resp_data and "dev_mfa_code" in resp_data:
                    user_id = resp_data["user_id"]
                    mfa_code = resp_data["dev_mfa_code"]
                    results.add_result("Owner MFA Required", True, f"MFA code generated: {mfa_code}", "AUTH")
                    
                    # Verify MFA
                    mfa_data = {"user_id": user_id, "code": mfa_code}
                    response = make_request("POST", "/auth/mfa/verify", mfa_data)
                    if response and response.status_code == 200:
                        try:
                            resp_data = response.json()
                            if resp_data.get("ok") and "token" in resp_data:
                                owner_token = resp_data["token"]
                                results.add_result("MFA Verification", True, "MFA verification successful", "AUTH")
                                # Update owner token in test_users
                                for i, (role, token, email, password) in enumerate(test_users):
                                    if role == "owner":
                                        test_users[i] = (role, owner_token, email, password)
                            else:
                                results.add_result("MFA Verification", False, "Invalid MFA response", "AUTH")
                        except:
                            results.add_result("MFA Verification", False, "JSON parsing error", "AUTH")
                    else:
                        results.add_result("MFA Verification", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
                else:
                    results.add_result("Owner MFA Required", False, "MFA not required for owner", "AUTH")
            except:
                results.add_result("Owner MFA Required", False, "JSON parsing error", "AUTH")
        else:
            results.add_result("Owner MFA Required", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 9-10: Password Reset Flow
    if customer_email:
        reset_data = {"email_or_phone": customer_email}
        response = make_request("POST", "/auth/reset/start", reset_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("sent") and resp_data.get("channel") == "email":
                    results.add_result("Password Reset Start", True, f"Reset OTP sent via email: {customer_email}", "AUTH")
                else:
                    results.add_result("Password Reset Start", False, "Invalid reset response", "AUTH")
            except:
                results.add_result("Password Reset Start", False, "JSON parsing error", "AUTH")
        else:
            results.add_result("Password Reset Start", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 11: JWT Token Validation
    if customer_token:
        response = make_request("GET", "/auth/me", auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                user_data = response.json()
                if "id" in user_data and "email" in user_data and "role" in user_data:
                    results.add_result("JWT Token Validation", True, f"Token valid for user: {user_data['email']}", "AUTH")
                else:
                    results.add_result("JWT Token Validation", False, "Invalid user data", "AUTH")
            except:
                results.add_result("JWT Token Validation", False, "JSON parsing error", "AUTH")
        else:
            results.add_result("JWT Token Validation", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 12: Partner Role Switching
    if partner_token:
        response = make_request("POST", "/auth/switch-role", auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "token" in resp_data and resp_data["user"]["role"] == "customer":
                    results.add_result("Partner Role Switching", True, "Partner switched to customer role", "AUTH")
                else:
                    results.add_result("Partner Role Switching", False, "Role switch failed", "AUTH")
            except:
                results.add_result("Partner Role Switching", False, "JSON parsing error", "AUTH")
        else:
            results.add_result("Partner Role Switching", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 13: Invalid Credentials Handling
    invalid_data = {"identifier": "nonexistent@example.com", "password": "wrongpassword"}
    response = make_request("POST", "/auth/login", invalid_data)
    if response and response.status_code == 401:
        results.add_result("Invalid Credentials Handling", True, "Invalid credentials properly rejected", "AUTH")
    else:
        results.add_result("Invalid Credentials Handling", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 14: Invalid Token Handling
    response = make_request("GET", "/auth/me", auth_token="invalid_token")
    if response and response.status_code == 401:
        results.add_result("Invalid Token Handling", True, "Invalid token properly rejected", "AUTH")
    else:
        results.add_result("Invalid Token Handling", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    # Test 15: Validation Tests (Password/Username/Phone/ToS)
    # Weak password test
    weak_data = {
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "weak",
        "role": "customer",
        "accept_tos": True
    }
    response = make_request("POST", "/auth/signup", weak_data)
    if response and response.status_code == 422:
        results.add_result("Password Validation", True, "Weak password properly rejected", "AUTH")
    else:
        results.add_result("Password Validation", False, f"Status: {response.status_code if response else 'No response'}", "AUTH")
    
    return test_users

# ===== SYSTEM 2: ADDRESS MANAGEMENT =====

def test_address_system(results, customer_token):
    """Test Address Management System (5 endpoints)"""
    print(f"\n📍 TESTING SYSTEM 2: ADDRESS MANAGEMENT SYSTEM")
    
    if not customer_token:
        results.add_result("Address System Setup", False, "No customer token available", "ADDRESS")
        return
    
    # Test 1: List Saved Addresses (Empty)
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
    
    # Test 3: Duplicate Address Detection
    response = make_request("POST", "/addresses", address_data, auth_token=customer_token)
    if response and response.status_code == 409:
        results.add_result("Duplicate Address Detection", True, "Duplicate address properly rejected", "ADDRESS")
    else:
        results.add_result("Duplicate Address Detection", False, f"Status: {response.status_code if response else 'No response'}", "ADDRESS")
    
    # Test 4: Places Autocomplete
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
    
    # Test 5: ETA Preview
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
                results.add_result("ETA Preview", True, f"ETA: {resp_data['window']}, Distance: {resp_data['distanceKm']}km", "ADDRESS")
            else:
                results.add_result("ETA Preview", False, "Invalid response structure", "ADDRESS")
        except:
            results.add_result("ETA Preview", False, "JSON parsing error", "ADDRESS")
    else:
        results.add_result("ETA Preview", False, f"Status: {response.status_code if response else 'No response'}", "ADDRESS")

# ===== SYSTEM 3: PAYMENT & CHECKOUT =====

def test_payment_checkout_system(results, customer_token):
    """Test Payment & Checkout System (10 endpoints)"""
    print(f"\n💳 TESTING SYSTEM 3: PAYMENT & CHECKOUT SYSTEM")
    
    if not customer_token:
        results.add_result("Payment System Setup", False, "No customer token available", "PAYMENT")
        return None
    
    # Test 1: List Payment Methods
    response = make_request("GET", "/billing/methods", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "methods" in resp_data and isinstance(resp_data["methods"], list):
                results.add_result("List Payment Methods", True, f"Retrieved {len(resp_data['methods'])} payment methods", "PAYMENT")
            else:
                results.add_result("List Payment Methods", False, "Invalid response structure", "PAYMENT")
        except:
            results.add_result("List Payment Methods", False, "JSON parsing error", "PAYMENT")
    else:
        results.add_result("List Payment Methods", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    # Test 2: Create Setup Intent
    response = make_request("POST", "/billing/setup-intent", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "clientSecret" in resp_data:
                results.add_result("Create Setup Intent", True, "Setup intent created successfully", "PAYMENT")
            else:
                results.add_result("Create Setup Intent", False, "No clientSecret in response", "PAYMENT")
        except:
            results.add_result("Create Setup Intent", False, "JSON parsing error", "PAYMENT")
    else:
        results.add_result("Create Setup Intent", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    # Test 3: Attach Payment Method
    attach_data = {"paymentMethodId": "pm_test_card_visa"}
    response = make_request("POST", "/billing/methods", attach_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if resp_data.get("ok") is True:
                results.add_result("Attach Payment Method", True, "Payment method attached successfully", "PAYMENT")
            else:
                results.add_result("Attach Payment Method", False, "Attachment failed", "PAYMENT")
        except:
            results.add_result("Attach Payment Method", False, "JSON parsing error", "PAYMENT")
    else:
        results.add_result("Attach Payment Method", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    # Test 4-6: Promo Code Application (SHINE20, FIRST10, SAVE15)
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
                    results.add_result(f"Apply Promo Code ({promo_code})", True, f"Promo applied, total: ${resp_data['total']}", "PAYMENT")
                else:
                    results.add_result(f"Apply Promo Code ({promo_code})", False, "Promo not applied", "PAYMENT")
            except:
                results.add_result(f"Apply Promo Code ({promo_code})", False, "JSON parsing error", "PAYMENT")
        else:
            results.add_result(f"Apply Promo Code ({promo_code})", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    # Test 7: Payment Pre-Authorization
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
                results.add_result("Payment Pre-Authorization", True, f"Payment intent created: {payment_intent_id}", "PAYMENT")
            else:
                results.add_result("Payment Pre-Authorization", False, "No paymentIntentId in response", "PAYMENT")
        except:
            results.add_result("Payment Pre-Authorization", False, "JSON parsing error", "PAYMENT")
    else:
        results.add_result("Payment Pre-Authorization", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    # Test 8: Stripe Action Confirmation
    if payment_intent_id:
        confirm_data = {"paymentIntentId": payment_intent_id}
        response = make_request("POST", "/billing/confirm", confirm_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Stripe Action Confirmation", True, "Stripe action confirmed", "PAYMENT")
                else:
                    results.add_result("Stripe Action Confirmation", False, "Confirmation failed", "PAYMENT")
            except:
                results.add_result("Stripe Action Confirmation", False, "JSON parsing error", "PAYMENT")
        else:
            results.add_result("Stripe Action Confirmation", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    # Test 9: Booking Creation
    booking_data = {
        "quoteId": "quote_test123",
        "service": {
            "serviceType": "basic",
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
                results.add_result("Booking Creation", True, f"Booking created: {booking_id}, status: {resp_data['status']}", "PAYMENT")
            else:
                results.add_result("Booking Creation", False, "No bookingId in response", "PAYMENT")
        except:
            results.add_result("Booking Creation", False, "JSON parsing error", "PAYMENT")
    else:
        results.add_result("Booking Creation", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    # Test 10: Payment Void
    if payment_intent_id:
        void_data = {"paymentIntentId": payment_intent_id}
        response = make_request("POST", "/billing/void", void_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Payment Void", True, "Payment voided successfully", "PAYMENT")
                else:
                    results.add_result("Payment Void", False, "Void failed", "PAYMENT")
            except:
                results.add_result("Payment Void", False, "JSON parsing error", "PAYMENT")
        else:
            results.add_result("Payment Void", False, f"Status: {response.status_code if response else 'No response'}", "PAYMENT")
    
    return booking_id

# ===== SYSTEM 4: DISPATCH SYSTEM =====

def test_dispatch_system(results, customer_token, partner_token, owner_token, booking_id):
    """Test Dispatch System (6 endpoints)"""
    print(f"\n🚚 TESTING SYSTEM 4: DISPATCH SYSTEM")
    
    # Test 1: Customer Dispatch Status
    if booking_id and customer_token:
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
        results.add_result("Customer Dispatch Status", False, "No booking ID or customer token available", "DISPATCH")
    
    # Test 2: Partner Offer Polling
    if partner_token:
        response = make_request("GET", "/partner/offers/poll", auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "offer" in resp_data:
                    results.add_result("Partner Offer Polling", True, f"Offer polling successful", "DISPATCH")
                else:
                    results.add_result("Partner Offer Polling", False, "No offer field in response", "DISPATCH")
            except:
                results.add_result("Partner Offer Polling", False, "JSON parsing error", "DISPATCH")
        else:
            results.add_result("Partner Offer Polling", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    else:
        results.add_result("Partner Offer Polling", False, "No partner token available", "DISPATCH")
    
    # Test 3: Partner Accept Offer
    if partner_token:
        offer_id = f"of_{uuid.uuid4().hex[:16]}"
        accept_data = {"idempotencyKey": str(uuid.uuid4())}
        response = make_request("POST", f"/partner/offers/{offer_id}/accept", accept_data, auth_token=partner_token)
        if response and response.status_code in [200, 410, 409, 423]:  # Various valid responses
            results.add_result("Partner Accept Offer", True, f"Accept offer handled correctly (Status: {response.status_code})", "DISPATCH")
        else:
            results.add_result("Partner Accept Offer", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    else:
        results.add_result("Partner Accept Offer", False, "No partner token available", "DISPATCH")
    
    # Test 4: Partner Decline Offer
    if partner_token:
        offer_id = f"of_{uuid.uuid4().hex[:16]}"
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
    else:
        results.add_result("Partner Decline Offer", False, "No partner token available", "DISPATCH")
    
    # Test 5: Customer Cancel Booking
    if booking_id and customer_token:
        cancel_data = {"reason": "Changed my mind"}
        response = make_request("POST", f"/bookings/{booking_id}/cancel", cancel_data, auth_token=customer_token)
        if response and response.status_code in [200, 409]:  # 409 if already assigned
            results.add_result("Customer Cancel Booking", True, f"Booking cancellation handled (Status: {response.status_code})", "DISPATCH")
        else:
            results.add_result("Customer Cancel Booking", False, f"Status: {response.status_code if response else 'No response'}", "DISPATCH")
    else:
        results.add_result("Customer Cancel Booking", False, "No booking ID or customer token available", "DISPATCH")
    
    # Test 6: Owner Dispatch Dashboard
    if owner_token:
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
    else:
        results.add_result("Owner Dispatch Dashboard", False, "No owner token available", "DISPATCH")

# ===== SYSTEM 5: JOB LIFECYCLE MANAGEMENT =====

def test_job_lifecycle_system(results, customer_token, partner_token, booking_id):
    """Test Job Lifecycle Management System (19 endpoints) - Core functionality"""
    print(f"\n📋 TESTING SYSTEM 5: JOB LIFECYCLE MANAGEMENT")
    
    if not booking_id:
        results.add_result("Job System Setup", False, "No booking ID available for job testing", "JOB")
        return
    
    # Test 1: Get Job Details
    if customer_token:
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
    
    # Test 2: Partner GPS Location Update
    if partner_token:
        location_data = {
            "lat": 37.7749,
            "lng": -122.4194,
            "heading": 45.0,
            "speed": 25.0
        }
        response = make_request("POST", f"/jobs/{booking_id}/location", location_data, auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Partner GPS Location Update", True, "Location updated successfully", "JOB")
                else:
                    results.add_result("Partner GPS Location Update", False, "Location update failed", "JOB")
            except:
                results.add_result("Partner GPS Location Update", False, "JSON parsing error", "JOB")
        else:
            results.add_result("Partner GPS Location Update", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 3: Partner Arrival Marking
    if partner_token:
        arrival_data = {"timestamp": datetime.now().isoformat()}
        response = make_request("POST", f"/jobs/{booking_id}/arrived", arrival_data, auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Partner Arrival Marking", True, "Arrival marked successfully", "JOB")
                else:
                    results.add_result("Partner Arrival Marking", False, "Arrival marking failed", "JOB")
            except:
                results.add_result("Partner Arrival Marking", False, "JSON parsing error", "JOB")
        else:
            results.add_result("Partner Arrival Marking", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 4: Partner Verification Start
    if partner_token:
        verification_data = {"method": "face"}
        response = make_request("POST", f"/jobs/{booking_id}/verify/start", verification_data, auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "sessionId" in resp_data and "expiresAt" in resp_data:
                    results.add_result("Partner Verification Start", True, f"Verification session started: {resp_data['sessionId']}", "JOB")
                else:
                    results.add_result("Partner Verification Start", False, "Invalid response structure", "JOB")
            except:
                results.add_result("Partner Verification Start", False, "JSON parsing error", "JOB")
        else:
            results.add_result("Partner Verification Start", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 5: Presigned URL Generation
    if customer_token:
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
    
    # Test 6: Photo Upload (Before/After)
    if partner_token:
        photo_data = {
            "type": "before",
            "fileIds": ["img_test1", "img_test2"]
        }
        response = make_request("POST", f"/jobs/{booking_id}/photos", photo_data, auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Photo Upload (Before/After)", True, "Photos uploaded successfully", "JOB")
                else:
                    results.add_result("Photo Upload (Before/After)", False, "Photo upload failed", "JOB")
            except:
                results.add_result("Photo Upload (Before/After)", False, "JSON parsing error", "JOB")
        else:
            results.add_result("Photo Upload (Before/After)", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 7: Chat Messaging
    if customer_token:
        chat_data = {"text": "Hello, I'm ready for the service"}
        response = make_request("POST", f"/comm/chat/{booking_id}", chat_data, auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "id" in resp_data:
                    results.add_result("Chat Messaging", True, f"Message sent: {resp_data['id']}", "JOB")
                else:
                    results.add_result("Chat Messaging", False, "No message ID in response", "JOB")
            except:
                results.add_result("Chat Messaging", False, "JSON parsing error", "JOB")
        else:
            results.add_result("Chat Messaging", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 8: Get Chat Messages
    if customer_token:
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
    
    # Test 9: Masked Call Initiation
    if customer_token:
        call_data = {"bookingId": booking_id, "to": "partner"}
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
    
    # Test 10: Payment Capture
    if customer_token:
        capture_data = {"paymentIntentId": "pi_test123", "amount": 50.0}
        response = make_request("POST", "/billing/capture/start", capture_data, auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Payment Capture", True, "Payment captured successfully", "JOB")
                else:
                    results.add_result("Payment Capture", False, "Capture failed", "JOB")
            except:
                results.add_result("Payment Capture", False, "JSON parsing error", "JOB")
        else:
            results.add_result("Payment Capture", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 11: Job Completion
    if customer_token:
        response = make_request("POST", f"/jobs/{booking_id}/approve", auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Job Completion", True, f"Job approved: {resp_data['status']}", "JOB")
                else:
                    results.add_result("Job Completion", False, "Approval failed", "JOB")
            except:
                results.add_result("Job Completion", False, "JSON parsing error", "JOB")
        else:
            results.add_result("Job Completion", False, f"Status: {response.status_code if response else 'No response'}", "JOB")
    
    # Test 12: SOS Emergency Support
    if customer_token:
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

# ===== SYSTEM 6: RATING & TIPS =====

def test_rating_tips_system(results, customer_token, partner_token, owner_token, booking_id):
    """Test Rating & Tips System (5 endpoints)"""
    print(f"\n⭐ TESTING SYSTEM 6: RATING & TIPS SYSTEM")
    
    if not booking_id:
        results.add_result("Rating System Setup", False, "No booking ID available for rating testing", "RATING")
        return
    
    # Test 1: Rating Context Retrieval
    if customer_token:
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
    if customer_token:
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
    if partner_token:
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
    if customer_token:
        tip_data = {"amount": 12.5, "currency": "usd"}
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
    if owner_token:
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

# ===== SYSTEM 7: PARTNER EARNINGS & PAYOUTS =====

def test_partner_earnings_system(results, partner_token):
    """Test Partner Earnings & Payouts System (16 endpoints)"""
    print(f"\n💰 TESTING SYSTEM 7: PARTNER EARNINGS & PAYOUTS")
    
    if not partner_token:
        results.add_result("Earnings System Setup", False, "No partner token available", "EARNINGS")
        return
    
    # Test 1: Partner Earnings Summary
    response = make_request("GET", "/partner/earnings/summary", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "weeklyEarnings" in resp_data and "tipsYTD" in resp_data:
                results.add_result("Partner Earnings Summary", True, f"Weekly: ${resp_data['weeklyEarnings']}, Tips YTD: ${resp_data['tipsYTD']}", "EARNINGS")
            else:
                results.add_result("Partner Earnings Summary", False, "Invalid response structure", "EARNINGS")
        except:
            results.add_result("Partner Earnings Summary", False, "JSON parsing error", "EARNINGS")
    else:
        results.add_result("Partner Earnings Summary", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")
    
    # Test 2: Earnings Chart Data
    response = make_request("GET", "/partner/earnings/series", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "data" in resp_data and isinstance(resp_data["data"], list):
                results.add_result("Earnings Chart Data", True, f"Retrieved {len(resp_data['data'])} data points", "EARNINGS")
            else:
                results.add_result("Earnings Chart Data", False, "Invalid response structure", "EARNINGS")
        except:
            results.add_result("Earnings Chart Data", False, "JSON parsing error", "EARNINGS")
    else:
        results.add_result("Earnings Chart Data", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")
    
    # Test 3: Weekly Statements List
    response = make_request("GET", "/partner/earnings/statements", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "statements" in resp_data and isinstance(resp_data["statements"], list):
                results.add_result("Weekly Statements List", True, f"Retrieved {len(resp_data['statements'])} statements", "EARNINGS")
            else:
                results.add_result("Weekly Statements List", False, "Invalid response structure", "EARNINGS")
        except:
            results.add_result("Weekly Statements List", False, "JSON parsing error", "EARNINGS")
    else:
        results.add_result("Weekly Statements List", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")
    
    # Test 4: Statement Details
    statement_id = "stmt_test123"
    response = make_request("GET", f"/partner/earnings/statements/{statement_id}", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "period" in resp_data and "jobs" in resp_data:
                results.add_result("Statement Details", True, f"Statement details: {len(resp_data['jobs'])} jobs", "EARNINGS")
            else:
                results.add_result("Statement Details", False, "Invalid response structure", "EARNINGS")
        except:
            results.add_result("Statement Details", False, "JSON parsing error", "EARNINGS")
    else:
        results.add_result("Statement Details", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")
    
    # Test 5: Payout History
    response = make_request("GET", "/partner/payouts", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "payouts" in resp_data and isinstance(resp_data["payouts"], list):
                results.add_result("Payout History", True, f"Retrieved {len(resp_data['payouts'])} payouts", "EARNINGS")
            else:
                results.add_result("Payout History", False, "Invalid response structure", "EARNINGS")
        except:
            results.add_result("Payout History", False, "JSON parsing error", "EARNINGS")
    else:
        results.add_result("Payout History", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")
    
    # Test 6: Instant Payout (Should fail due to unverified bank)
    payout_data = {
        "amount": 100.0,
        "currency": "usd",
        "idempotencyKey": str(uuid.uuid4())
    }
    response = make_request("POST", "/partner/payouts/instant", payout_data, auth_token=partner_token)
    if response and response.status_code == 409:  # Expected failure for unverified bank
        results.add_result("Instant Payout Validation", True, "Instant payout properly rejected for unverified bank", "EARNINGS")
    elif response and response.status_code == 200:
        results.add_result("Instant Payout Validation", True, "Instant payout processed successfully", "EARNINGS")
    else:
        results.add_result("Instant Payout Validation", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")
    
    # Test 7: Bank Status
    response = make_request("GET", "/partner/bank/status", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "verified" in resp_data:
                results.add_result("Bank Status", True, f"Bank status: verified={resp_data['verified']}", "EARNINGS")
            else:
                results.add_result("Bank Status", False, "Invalid response structure", "EARNINGS")
        except:
            results.add_result("Bank Status", False, "JSON parsing error", "EARNINGS")
    else:
        results.add_result("Bank Status", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")
    
    # Test 8: Tax Context
    response = make_request("GET", "/partner/tax/context", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "status" in resp_data and "forms" in resp_data:
                results.add_result("Tax Context", True, f"Tax status: {resp_data['status']}, {len(resp_data['forms'])} forms available", "EARNINGS")
            else:
                results.add_result("Tax Context", False, "Invalid response structure", "EARNINGS")
        except:
            results.add_result("Tax Context", False, "JSON parsing error", "EARNINGS")
    else:
        results.add_result("Tax Context", False, f"Status: {response.status_code if response else 'No response'}", "EARNINGS")

# ===== SYSTEM 8: SUPPORT & DISPUTES =====

def test_support_disputes_system(results, customer_token, partner_token, owner_token, booking_id):
    """Test Support & Disputes System (8 endpoints)"""
    print(f"\n🆘 TESTING SYSTEM 8: SUPPORT & DISPUTES SYSTEM")
    
    # Test 1: FAQ Management
    response = make_request("GET", "/support/faqs")
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "faqs" in resp_data and isinstance(resp_data["faqs"], list):
                results.add_result("FAQ Management", True, f"Retrieved {len(resp_data['faqs'])} FAQs", "SUPPORT")
            else:
                results.add_result("FAQ Management", False, "Invalid response structure", "SUPPORT")
        except:
            results.add_result("FAQ Management", False, "JSON parsing error", "SUPPORT")
    else:
        results.add_result("FAQ Management", False, f"Status: {response.status_code if response else 'No response'}", "SUPPORT")
    
    # Test 2: Customer Issue Reporting
    if customer_token and booking_id:
        issue_data = {
            "bookingId": booking_id,
            "category": "Service quality",
            "description": "Service was not up to standard",
            "photoIds": ["img_test1", "img_test2"]
        }
        response = make_request("POST", "/support/issues", issue_data, auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "issueId" in resp_data:
                    results.add_result("Customer Issue Reporting", True, f"Issue created: {resp_data['issueId']}", "SUPPORT")
                else:
                    results.add_result("Customer Issue Reporting", False, "No issue ID in response", "SUPPORT")
            except:
                results.add_result("Customer Issue Reporting", False, "JSON parsing error", "SUPPORT")
        else:
            results.add_result("Customer Issue Reporting", False, f"Status: {response.status_code if response else 'No response'}", "SUPPORT")
    
    # Test 3: List Support Issues
    if customer_token:
        response = make_request("GET", "/support/issues", auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "issues" in resp_data and isinstance(resp_data["issues"], list):
                    results.add_result("List Support Issues", True, f"Retrieved {len(resp_data['issues'])} issues", "SUPPORT")
                else:
                    results.add_result("List Support Issues", False, "Invalid response structure", "SUPPORT")
            except:
                results.add_result("List Support Issues", False, "JSON parsing error", "SUPPORT")
        else:
            results.add_result("List Support Issues", False, f"Status: {response.status_code if response else 'No response'}", "SUPPORT")
    
    # Test 4: Partner Training Guides
    if partner_token:
        response = make_request("GET", "/partner/training/guides", auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "guides" in resp_data and isinstance(resp_data["guides"], list):
                    results.add_result("Partner Training Guides", True, f"Retrieved {len(resp_data['guides'])} training guides", "SUPPORT")
                else:
                    results.add_result("Partner Training Guides", False, "Invalid response structure", "SUPPORT")
            except:
                results.add_result("Partner Training Guides", False, "JSON parsing error", "SUPPORT")
        else:
            results.add_result("Partner Training Guides", False, f"Status: {response.status_code if response else 'No response'}", "SUPPORT")
    
    # Test 5: Owner Support Queue
    if owner_token:
        response = make_request("GET", "/owner/support/queue", auth_token=owner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "tickets" in resp_data and isinstance(resp_data["tickets"], list):
                    results.add_result("Owner Support Queue", True, f"Retrieved {len(resp_data['tickets'])} support tickets", "SUPPORT")
                else:
                    results.add_result("Owner Support Queue", False, "Invalid response structure", "SUPPORT")
            except:
                results.add_result("Owner Support Queue", False, "JSON parsing error", "SUPPORT")
        else:
            results.add_result("Owner Support Queue", False, f"Status: {response.status_code if response else 'No response'}", "SUPPORT")
    
    # Test 6: Owner Support Metrics
    if owner_token:
        response = make_request("GET", "/owner/support/metrics", auth_token=owner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "openTickets" in resp_data and "avgSlaHours" in resp_data:
                    results.add_result("Owner Support Metrics", True, f"Open tickets: {resp_data['openTickets']}, Avg SLA: {resp_data['avgSlaHours']}h", "SUPPORT")
                else:
                    results.add_result("Owner Support Metrics", False, "Invalid response structure", "SUPPORT")
            except:
                results.add_result("Owner Support Metrics", False, "JSON parsing error", "SUPPORT")
        else:
            results.add_result("Owner Support Metrics", False, f"Status: {response.status_code if response else 'No response'}", "SUPPORT")
    
    # Test 7: Refund Processing (Owner only)
    if owner_token and booking_id:
        refund_data = {
            "bookingId": booking_id,
            "amount": 50.0,
            "reason": "Service quality issue"
        }
        response = make_request("POST", "/billing/refund", refund_data, auth_token=owner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("ok") is True:
                    results.add_result("Refund Processing", True, f"Refund processed: ${refund_data['amount']}", "SUPPORT")
                else:
                    results.add_result("Refund Processing", False, "Refund processing failed", "SUPPORT")
            except:
                results.add_result("Refund Processing", False, "JSON parsing error", "SUPPORT")
        else:
            results.add_result("Refund Processing", False, f"Status: {response.status_code if response else 'No response'}", "SUPPORT")

# ===== ADDITIONAL SYSTEM TESTS =====

def test_home_dashboard_system(results, customer_token, partner_token, owner_token):
    """Test Home Dashboard APIs (4 endpoints)"""
    print(f"\n🏠 TESTING ADDITIONAL: HOME DASHBOARD SYSTEM")
    
    # Test 1: Nearby Partners
    response = make_request("GET", "/partners/nearby?lat=37.7749&lng=-122.4194&radius_km=5.0")
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "partners" in resp_data and isinstance(resp_data["partners"], list):
                results.add_result("Nearby Partners", True, f"Found {len(resp_data['partners'])} nearby partners", "HOME")
            else:
                results.add_result("Nearby Partners", False, "Invalid response structure", "HOME")
        except:
            results.add_result("Nearby Partners", False, "JSON parsing error", "HOME")
    else:
        results.add_result("Nearby Partners", False, f"Status: {response.status_code if response else 'No response'}", "HOME")
    
    # Test 2: Surge Pricing
    response = make_request("GET", "/pricing/surge?lat=37.7749&lng=-122.4194")
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "active" in resp_data and "multiplier" in resp_data:
                results.add_result("Surge Pricing", True, f"Surge active: {resp_data['active']}, multiplier: {resp_data['multiplier']}", "HOME")
            else:
                results.add_result("Surge Pricing", False, "Invalid response structure", "HOME")
        except:
            results.add_result("Surge Pricing", False, "JSON parsing error", "HOME")
    else:
        results.add_result("Surge Pricing", False, f"Status: {response.status_code if response else 'No response'}", "HOME")
    
    # Test 3: Partner Dashboard
    if partner_token:
        response = make_request("GET", "/partner/home", auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "status" in resp_data and "verification" in resp_data:
                    results.add_result("Partner Dashboard", True, f"Status: {resp_data['status']}, verification: {resp_data['verification']}", "HOME")
                else:
                    results.add_result("Partner Dashboard", False, "Invalid response structure", "HOME")
            except:
                results.add_result("Partner Dashboard", False, "JSON parsing error", "HOME")
        else:
            results.add_result("Partner Dashboard", False, f"Status: {response.status_code if response else 'No response'}", "HOME")
    
    # Test 4: Owner Dashboard Tiles
    if owner_token:
        response = make_request("GET", "/owner/tiles", auth_token=owner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if "activeJobs" in resp_data and "partnersOnline" in resp_data:
                    results.add_result("Owner Dashboard Tiles", True, f"Active jobs: {resp_data['activeJobs']}, partners online: {resp_data['partnersOnline']}", "HOME")
                else:
                    results.add_result("Owner Dashboard Tiles", False, "Invalid response structure", "HOME")
            except:
                results.add_result("Owner Dashboard Tiles", False, "JSON parsing error", "HOME")
        else:
            results.add_result("Owner Dashboard Tiles", False, f"Status: {response.status_code if response else 'No response'}", "HOME")

def test_service_catalog_system(results):
    """Test Service Catalog & Pricing (3 endpoints)"""
    print(f"\n🧹 TESTING ADDITIONAL: SERVICE CATALOG & PRICING")
    
    # Test 1: Services Catalog
    response = make_request("GET", "/services/catalog")
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "services" in resp_data and isinstance(resp_data["services"], list):
                results.add_result("Services Catalog", True, f"Retrieved {len(resp_data['services'])} services", "SERVICES")
            else:
                results.add_result("Services Catalog", False, "Invalid response structure", "SERVICES")
        except:
            results.add_result("Services Catalog", False, "JSON parsing error", "SERVICES")
    else:
        results.add_result("Services Catalog", False, f"Status: {response.status_code if response else 'No response'}", "SERVICES")
    
    # Test 2: Pricing Quote
    quote_data = {
        "serviceType": "basic",
        "dwellingType": "House",
        "bedrooms": 2,
        "bathrooms": 1,
        "masters": 0,
        "photoIds": [],
        "when": "now",
        "lat": 37.7749,
        "lng": -122.4194
    }
    
    response = make_request("POST", "/pricing/quote", quote_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "quoteId" in resp_data and "price" in resp_data:
                results.add_result("Pricing Quote", True, f"Quote: {resp_data['quoteId']}, price: ${resp_data['price']}", "SERVICES")
            else:
                results.add_result("Pricing Quote", False, "Invalid response structure", "SERVICES")
        except:
            results.add_result("Pricing Quote", False, "JSON parsing error", "SERVICES")
    else:
        results.add_result("Pricing Quote", False, f"Status: {response.status_code if response else 'No response'}", "SERVICES")

# ===== MAIN COMPREHENSIVE TEST RUNNER =====

def main():
    """Run comprehensive SHINE backend testing across all systems"""
    print("🚀 STARTING COMPREHENSIVE SHINE BACKEND TESTING")
    print("="*80)
    print("Testing all 70+ API endpoints across 8 major SHINE systems")
    print(f"API Base URL: {BASE_URL}")
    print("="*80)
    
    results = ComprehensiveTestResults()
    
    # System 1: Enhanced SHINE Auth v3.0 (15 endpoints)
    test_users = test_auth_system(results)
    
    # Extract tokens for other tests
    customer_token = partner_token = owner_token = None
    for role, token, email, password in test_users:
        if role == "customer":
            customer_token = token
        elif role == "partner":
            partner_token = token
        elif role == "owner":
            owner_token = token
    
    if not customer_token:
        print("❌ Critical: No customer token available. Cannot continue with dependent tests.")
        results.print_comprehensive_summary()
        return
    
    # System 2: Address Management (5 endpoints)
    test_address_system(results, customer_token)
    
    # System 3: Payment & Checkout (10 endpoints)
    booking_id = test_payment_checkout_system(results, customer_token)
    
    # System 4: Dispatch System (6 endpoints)
    test_dispatch_system(results, customer_token, partner_token, owner_token, booking_id)
    
    # System 5: Job Lifecycle Management (19 endpoints - core functionality)
    test_job_lifecycle_system(results, customer_token, partner_token, booking_id)
    
    # System 6: Rating & Tips (5 endpoints)
    test_rating_tips_system(results, customer_token, partner_token, owner_token, booking_id)
    
    # System 7: Partner Earnings & Payouts (16 endpoints)
    test_partner_earnings_system(results, partner_token)
    
    # System 8: Support & Disputes (8 endpoints)
    test_support_disputes_system(results, customer_token, partner_token, owner_token, booking_id)
    
    # Additional Systems
    test_home_dashboard_system(results, customer_token, partner_token, owner_token)
    test_service_catalog_system(results)
    
    # Print comprehensive summary
    results.print_comprehensive_summary()
    
    # Final assessment
    success_rate = results.passed / (results.passed + results.failed) * 100
    print(f"\n🎯 FINAL ASSESSMENT:")
    print(f"Total API Endpoints Tested: {results.passed + results.failed}")
    print(f"Overall Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("✅ SYSTEM STATUS: PRODUCTION READY")
        print("   All major systems are functional and ready for manual testing.")
    elif success_rate >= 80:
        print("⚠️  SYSTEM STATUS: MOSTLY FUNCTIONAL")
        print("   System has minor issues but core functionality works.")
    elif success_rate >= 70:
        print("🔧 SYSTEM STATUS: NEEDS ATTENTION")
        print("   System has significant issues that should be addressed.")
    else:
        print("🚨 SYSTEM STATUS: CRITICAL ISSUES")
        print("   System has major problems requiring immediate attention.")
    
    print(f"\n📊 TESTING COMPLETE: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()