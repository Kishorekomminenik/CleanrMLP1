#!/usr/bin/env python3
"""
SHINE Application Comprehensive End-to-End Testing
Tests all implemented systems, user journeys, and integrations for production readiness
"""

import requests
import json
import time
from datetime import datetime
import uuid
import re

# Configuration
BASE_URL = "https://shine-app-debug.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class E2ETestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.critical_issues = []
        self.user_journeys = {}
    
    def add_result(self, test_name, passed, message="", critical=False):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "critical": critical,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            if critical:
                self.critical_issues.append(f"{test_name}: {message}")
        
        status = "✅ PASS" if passed else ("🚨 CRITICAL FAIL" if critical else "❌ FAIL")
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
    
    def add_journey_result(self, journey_name, step, passed, message=""):
        if journey_name not in self.user_journeys:
            self.user_journeys[journey_name] = {"steps": [], "success": True}
        
        self.user_journeys[journey_name]["steps"].append({
            "step": step,
            "passed": passed,
            "message": message
        })
        
        if not passed:
            self.user_journeys[journey_name]["success"] = False
    
    def print_summary(self):
        print(f"\n{'='*80}")
        print(f"SHINE APPLICATION COMPREHENSIVE END-TO-END TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.critical_issues:
            print(f"\n🚨 CRITICAL ISSUES FOUND ({len(self.critical_issues)}):")
            for issue in self.critical_issues:
                print(f"- {issue}")
        
        print(f"\n📊 USER JOURNEY RESULTS:")
        for journey, data in self.user_journeys.items():
            status = "✅ SUCCESS" if data["success"] else "❌ FAILED"
            print(f"{status}: {journey}")
            failed_steps = [s for s in data["steps"] if not s["passed"]]
            if failed_steps:
                for step in failed_steps:
                    print(f"   ❌ {step['step']}: {step['message']}")

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
            response = requests.get(url, headers=request_headers, timeout=15)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=15)
        elif method.upper() == "PATCH":
            response = requests.patch(url, json=data, headers=request_headers, timeout=15)
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
                results.add_result("API Health Check", True, f"API accessible: {data['message']}")
                return True
        except:
            pass
    
    results.add_result("API Health Check", False, f"API not accessible. Status: {response.status_code if response else 'No response'}", critical=True)
    return False

# ===== COMPLETE CUSTOMER JOURNEY =====

def test_complete_customer_journey(results):
    """Test complete customer journey from signup to service completion"""
    journey_name = "Complete Customer Journey"
    print(f"\n🛍️ TESTING {journey_name.upper()}...")
    
    # Step 1: Customer Signup & Authentication
    customer_email = f"customer_{uuid.uuid4().hex[:8]}@cleanservice.com"
    customer_username = f"customer_{uuid.uuid4().hex[:8]}"
    
    signup_data = {
        "email": customer_email,
        "username": customer_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155551234",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            customer_token = resp_data["token"]
            results.add_journey_result(journey_name, "Customer Signup", True, f"Registered: {customer_email}")
        except:
            results.add_journey_result(journey_name, "Customer Signup", False, "Invalid signup response")
            return None
    else:
        results.add_journey_result(journey_name, "Customer Signup", False, f"Signup failed: {response.status_code if response else 'No response'}")
        return None
    
    # Step 2: Address Management
    address_data = {
        "label": "Home",
        "line1": "123 Main Street",
        "city": "San Francisco",
        "state": "CA",
        "postalCode": "94102",
        "country": "USA",
        "lat": 37.7749,
        "lng": -122.4194
    }
    
    response = make_request("POST", "/addresses", address_data, auth_token=customer_token)
    if response and response.status_code == 200:
        results.add_journey_result(journey_name, "Save Address", True, "Address saved successfully")
    else:
        results.add_journey_result(journey_name, "Save Address", False, f"Address save failed: {response.status_code if response else 'No response'}")
    
    # Step 3: Service Selection & Pricing
    pricing_data = {
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
    
    response = make_request("POST", "/pricing/quote", pricing_data)
    if response and response.status_code == 200:
        try:
            quote_data = response.json()
            quote_id = quote_data["quoteId"]
            results.add_journey_result(journey_name, "Get Pricing Quote", True, f"Quote: ${quote_data['price']}")
        except:
            results.add_journey_result(journey_name, "Get Pricing Quote", False, "Invalid quote response")
            return None
    else:
        results.add_journey_result(journey_name, "Get Pricing Quote", False, f"Pricing failed: {response.status_code if response else 'No response'}")
        return None
    
    # Step 4: Payment Method Setup
    response = make_request("GET", "/billing/methods", auth_token=customer_token)
    if response and response.status_code == 200:
        results.add_journey_result(journey_name, "List Payment Methods", True, "Payment methods retrieved")
    else:
        results.add_journey_result(journey_name, "List Payment Methods", False, f"Payment methods failed: {response.status_code if response else 'No response'}")
    
    # Step 5: Promo Code Application
    promo_data = {
        "quoteId": quote_id,
        "code": "SHINE20",
        "useCredits": False
    }
    
    response = make_request("POST", "/pricing/promo/apply", promo_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            promo_resp = response.json()
            results.add_journey_result(journey_name, "Apply Promo Code", True, f"Discount applied: ${promo_resp['total']}")
        except:
            results.add_journey_result(journey_name, "Apply Promo Code", False, "Invalid promo response")
    else:
        results.add_journey_result(journey_name, "Apply Promo Code", False, f"Promo failed: {response.status_code if response else 'No response'}")
    
    # Step 6: Payment Pre-Authorization
    preauth_data = {
        "amount": 100.0,
        "currency": "usd",
        "paymentMethodId": "pm_1Abc123Def456",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", preauth_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            preauth_resp = response.json()
            payment_intent_id = preauth_resp["paymentIntentId"]
            results.add_journey_result(journey_name, "Payment Pre-Auth", True, f"Pre-auth: {payment_intent_id}")
        except:
            results.add_journey_result(journey_name, "Payment Pre-Auth", False, "Invalid preauth response")
            return None
    else:
        results.add_journey_result(journey_name, "Payment Pre-Auth", False, f"Pre-auth failed: {response.status_code if response else 'No response'}")
        return None
    
    # Step 7: Booking Creation
    booking_data = {
        "quoteId": quote_id,
        "service": {
            "serviceType": "basic",
            "timing": {"when": "now"}
        },
        "address": address_data,
        "access": {"notes": "Ring doorbell"},
        "totals": {"total": 100.0},
        "payment": {"paymentIntentId": payment_intent_id},
        "applyCredits": False,
        "promoCode": "SHINE20"
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            booking_resp = response.json()
            booking_id = booking_resp["bookingId"]
            results.add_journey_result(journey_name, "Create Booking", True, f"Booking: {booking_id}")
        except:
            results.add_journey_result(journey_name, "Create Booking", False, "Invalid booking response")
            return None
    else:
        results.add_journey_result(journey_name, "Create Booking", False, f"Booking failed: {response.status_code if response else 'No response'}")
        return None
    
    # Step 8: Dispatch Tracking
    response = make_request("GET", f"/dispatch/status/{booking_id}", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            dispatch_resp = response.json()
            results.add_journey_result(journey_name, "Track Dispatch", True, f"Status: {dispatch_resp['state']}")
        except:
            results.add_journey_result(journey_name, "Track Dispatch", False, "Invalid dispatch response")
    else:
        results.add_journey_result(journey_name, "Track Dispatch", False, f"Dispatch tracking failed: {response.status_code if response else 'No response'}")
    
    # Step 9: Job Tracking
    response = make_request("GET", f"/jobs/{booking_id}", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            job_resp = response.json()
            results.add_journey_result(journey_name, "Track Job", True, f"Job status: {job_resp['status']}")
        except:
            results.add_journey_result(journey_name, "Track Job", False, "Invalid job response")
    else:
        results.add_journey_result(journey_name, "Track Job", False, f"Job tracking failed: {response.status_code if response else 'No response'}")
    
    # Step 10: Communication (Chat)
    chat_data = {
        "text": "Hi, I'm ready for the service!"
    }
    
    response = make_request("POST", f"/comm/chat/{booking_id}", chat_data, auth_token=customer_token)
    if response and response.status_code == 200:
        results.add_journey_result(journey_name, "Send Chat Message", True, "Message sent successfully")
    else:
        results.add_journey_result(journey_name, "Send Chat Message", False, f"Chat failed: {response.status_code if response else 'No response'}")
    
    # Step 11: Service Completion Approval
    response = make_request("POST", f"/jobs/{booking_id}/approve", {}, auth_token=customer_token)
    if response and response.status_code == 200:
        results.add_journey_result(journey_name, "Approve Service", True, "Service approved")
    else:
        results.add_journey_result(journey_name, "Approve Service", False, f"Approval failed: {response.status_code if response else 'No response'}")
    
    # Step 12: Rating & Tip Submission
    rating_data = {
        "bookingId": booking_id,
        "stars": 5,
        "compliments": ["Professional", "On time"],
        "comments": "Excellent service!",
        "tip": {
            "amount": 15.0,
            "paymentMethodId": "pm_1Abc123Def456"
        },
        "idempotencyKey": f"rating_{uuid.uuid4().hex[:16]}"
    }
    
    response = make_request("POST", "/ratings/customer", rating_data, auth_token=customer_token)
    if response and response.status_code == 200:
        results.add_journey_result(journey_name, "Submit Rating & Tip", True, "Rating and tip submitted")
    else:
        results.add_journey_result(journey_name, "Submit Rating & Tip", False, f"Rating failed: {response.status_code if response else 'No response'}")
    
    return customer_token, booking_id

# ===== COMPLETE PARTNER JOURNEY =====

def test_complete_partner_journey(results):
    """Test complete partner journey from signup to earnings"""
    journey_name = "Complete Partner Journey"
    print(f"\n👷 TESTING {journey_name.upper()}...")
    
    # Step 1: Partner Signup
    partner_email = f"partner_{uuid.uuid4().hex[:8]}@cleanpro.com"
    partner_username = f"partner_{uuid.uuid4().hex[:8]}"
    
    signup_data = {
        "email": partner_email,
        "username": partner_username,
        "password": "SecurePass123!",
        "role": "partner",
        "phone": "+14155552345",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            partner_token = resp_data["token"]
            partner_status = resp_data["user"]["partner_status"]
            results.add_journey_result(journey_name, "Partner Signup", True, f"Registered: {partner_email}, Status: {partner_status}")
        except:
            results.add_journey_result(journey_name, "Partner Signup", False, "Invalid signup response")
            return None
    else:
        results.add_journey_result(journey_name, "Partner Signup", False, f"Signup failed: {response.status_code if response else 'No response'}")
        return None
    
    # Step 2: Partner Dashboard Access
    response = make_request("GET", "/partner/home", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            dashboard_resp = response.json()
            results.add_journey_result(journey_name, "Access Dashboard", True, f"Verification: {dashboard_resp['verification']}")
        except:
            results.add_journey_result(journey_name, "Access Dashboard", False, "Invalid dashboard response")
    else:
        results.add_journey_result(journey_name, "Access Dashboard", False, f"Dashboard failed: {response.status_code if response else 'No response'}")
    
    # Step 3: Earnings Summary
    response = make_request("GET", "/partner/earnings/summary", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            earnings_resp = response.json()
            results.add_journey_result(journey_name, "View Earnings", True, f"Weekly: ${earnings_resp['weeklyEarnings']}")
        except:
            results.add_journey_result(journey_name, "View Earnings", False, "Invalid earnings response")
    else:
        results.add_journey_result(journey_name, "View Earnings", False, f"Earnings failed: {response.status_code if response else 'No response'}")
    
    # Step 4: Bank Setup
    response = make_request("GET", "/partner/bank/status", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            bank_resp = response.json()
            results.add_journey_result(journey_name, "Check Bank Status", True, f"Status: {bank_resp['verified']}")
        except:
            results.add_journey_result(journey_name, "Check Bank Status", False, "Invalid bank response")
    else:
        results.add_journey_result(journey_name, "Check Bank Status", False, f"Bank status failed: {response.status_code if response else 'No response'}")
    
    # Step 5: Training Guides Access
    response = make_request("GET", "/partner/training/guides", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            training_resp = response.json()
            results.add_journey_result(journey_name, "Access Training", True, f"Guides: {len(training_resp['guides'])}")
        except:
            results.add_journey_result(journey_name, "Access Training", False, "Invalid training response")
    else:
        results.add_journey_result(journey_name, "Access Training", False, f"Training failed: {response.status_code if response else 'No response'}")
    
    # Step 6: Offer Polling (will show pending status restriction)
    response = make_request("GET", "/partner/offers/poll", auth_token=partner_token)
    if response and response.status_code == 403:
        results.add_journey_result(journey_name, "Offer Polling (Pending)", True, "Correctly restricted for pending partners")
    else:
        results.add_journey_result(journey_name, "Offer Polling (Pending)", False, f"Should be restricted: {response.status_code if response else 'No response'}")
    
    return partner_token

# ===== COMPLETE OWNER JOURNEY =====

def test_complete_owner_journey(results):
    """Test complete owner journey with MFA and management features"""
    journey_name = "Complete Owner Journey"
    print(f"\n👔 TESTING {journey_name.upper()}...")
    
    # Step 1: Owner Signup with MFA
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@shine.com"
    owner_username = f"owner_{uuid.uuid4().hex[:8]}"
    
    signup_data = {
        "email": owner_email,
        "username": owner_username,
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155553456",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            owner_token = resp_data["token"]
            mfa_enabled = resp_data["user"]["mfa_enabled"]
            results.add_journey_result(journey_name, "Owner Signup", True, f"Registered: {owner_email}, MFA: {mfa_enabled}")
        except:
            results.add_journey_result(journey_name, "Owner Signup", False, "Invalid signup response")
            return None
    else:
        results.add_journey_result(journey_name, "Owner Signup", False, f"Signup failed: {response.status_code if response else 'No response'}")
        return None
    
    # Step 2: MFA Login Flow
    login_data = {
        "identifier": owner_email,
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    if response and response.status_code == 200:
        try:
            login_resp = response.json()
            if "mfa_required" in login_resp and login_resp["mfa_required"]:
                user_id = login_resp["user_id"]
                mfa_code = login_resp.get("dev_mfa_code", "123456")
                results.add_journey_result(journey_name, "MFA Required", True, f"MFA code: {mfa_code}")
                
                # Verify MFA
                mfa_data = {
                    "user_id": user_id,
                    "code": mfa_code
                }
                
                response = make_request("POST", "/auth/mfa/verify", mfa_data)
                if response and response.status_code == 200:
                    try:
                        mfa_resp = response.json()
                        owner_token = mfa_resp["token"]
                        results.add_journey_result(journey_name, "MFA Verification", True, "MFA verified successfully")
                    except:
                        results.add_journey_result(journey_name, "MFA Verification", False, "Invalid MFA response")
                        return None
                else:
                    results.add_journey_result(journey_name, "MFA Verification", False, f"MFA failed: {response.status_code if response else 'No response'}")
                    return None
            else:
                results.add_journey_result(journey_name, "MFA Required", False, "MFA not required for owner")
        except:
            results.add_journey_result(journey_name, "MFA Required", False, "Invalid login response")
            return None
    else:
        results.add_journey_result(journey_name, "MFA Required", False, f"Login failed: {response.status_code if response else 'No response'}")
        return None
    
    # Step 3: Owner Dashboard Tiles
    response = make_request("GET", "/owner/tiles", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            tiles_resp = response.json()
            results.add_journey_result(journey_name, "Dashboard Tiles", True, f"Active Jobs: {tiles_resp['activeJobs']}")
        except:
            results.add_journey_result(journey_name, "Dashboard Tiles", False, "Invalid tiles response")
    else:
        results.add_journey_result(journey_name, "Dashboard Tiles", False, f"Tiles failed: {response.status_code if response else 'No response'}")
    
    # Step 4: Dispatch Management
    response = make_request("GET", "/owner/dispatch", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            dispatch_resp = response.json()
            results.add_journey_result(journey_name, "Dispatch Dashboard", True, f"Accept Rate: {dispatch_resp['kpis']['acceptRate']}%")
        except:
            results.add_journey_result(journey_name, "Dispatch Dashboard", False, "Invalid dispatch response")
    else:
        results.add_journey_result(journey_name, "Dispatch Dashboard", False, f"Dispatch failed: {response.status_code if response else 'No response'}")
    
    # Step 5: Support Queue Management
    response = make_request("GET", "/owner/support/queue", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            support_resp = response.json()
            results.add_journey_result(journey_name, "Support Queue", True, f"Tickets: {len(support_resp['tickets'])}")
        except:
            results.add_journey_result(journey_name, "Support Queue", False, "Invalid support response")
    else:
        results.add_journey_result(journey_name, "Support Queue", False, f"Support failed: {response.status_code if response else 'No response'}")
    
    # Step 6: Ratings Analytics
    response = make_request("GET", "/owner/ratings", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            ratings_resp = response.json()
            results.add_journey_result(journey_name, "Ratings Analytics", True, f"Rating Items: {len(ratings_resp['items'])}")
        except:
            results.add_journey_result(journey_name, "Ratings Analytics", False, "Invalid ratings response")
    else:
        results.add_journey_result(journey_name, "Ratings Analytics", False, f"Ratings failed: {response.status_code if response else 'No response'}")
    
    return owner_token

# ===== SYSTEM INTEGRATION TESTS =====

def test_system_integrations(results):
    """Test critical system integrations"""
    print(f"\n🔗 TESTING SYSTEM INTEGRATIONS...")
    
    # Test 1: Authentication Integration
    test_email = f"integration_{uuid.uuid4().hex[:8]}@test.com"
    signup_data = {
        "email": test_email,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            token = resp_data["token"]
            
            # Test token validation across different endpoints
            endpoints_to_test = [
                "/auth/me",
                "/addresses",
                "/billing/methods",
                "/partner/earnings/summary"  # Should fail for customer
            ]
            
            auth_working = 0
            for endpoint in endpoints_to_test[:3]:  # First 3 should work
                test_resp = make_request("GET", endpoint, auth_token=token)
                if test_resp and test_resp.status_code in [200, 403]:  # 403 is ok for role restrictions
                    auth_working += 1
            
            if auth_working >= 2:
                results.add_result("JWT Authentication Integration", True, f"Token works across {auth_working}/3 endpoints")
            else:
                results.add_result("JWT Authentication Integration", False, f"Token only works on {auth_working}/3 endpoints")
                
        except:
            results.add_result("JWT Authentication Integration", False, "Token extraction failed")
    else:
        results.add_result("JWT Authentication Integration", False, "Signup failed for integration test")
    
    # Test 2: Role-Based Access Control
    customer_token = token if 'token' in locals() else None
    if customer_token:
        # Test customer accessing partner endpoints (should fail)
        partner_endpoints = [
            "/partner/offers/poll",
            "/partner/earnings/summary",
            "/partner/training/guides"
        ]
        
        blocked_count = 0
        for endpoint in partner_endpoints:
            test_resp = make_request("GET", endpoint, auth_token=customer_token)
            if test_resp and test_resp.status_code == 403:
                blocked_count += 1
        
        if blocked_count == len(partner_endpoints):
            results.add_result("Role-Based Access Control", True, f"Customer properly blocked from {blocked_count} partner endpoints")
        else:
            results.add_result("Role-Based Access Control", False, f"Only {blocked_count}/{len(partner_endpoints)} endpoints properly secured", critical=True)
    
    # Test 3: Data Flow Integration (Booking -> Dispatch -> Job)
    if customer_token:
        # Create a booking
        booking_data = {
            "quoteId": f"quote_{uuid.uuid4().hex[:8]}",
            "service": {"serviceType": "basic", "timing": {"when": "now"}},
            "address": {"line1": "123 Test St", "lat": 37.7749, "lng": -122.4194},
            "access": {"notes": "Test booking"},
            "totals": {"total": 100.0},
            "payment": {"paymentIntentId": f"pi_{uuid.uuid4().hex[:16]}"}
        }
        
        response = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                booking_resp = response.json()
                booking_id = booking_resp["bookingId"]
                
                # Test dispatch status
                dispatch_resp = make_request("GET", f"/dispatch/status/{booking_id}", auth_token=customer_token)
                dispatch_ok = dispatch_resp and dispatch_resp.status_code == 200
                
                # Test job details
                job_resp = make_request("GET", f"/jobs/{booking_id}", auth_token=customer_token)
                job_ok = job_resp and job_resp.status_code == 200
                
                if dispatch_ok and job_ok:
                    results.add_result("Data Flow Integration", True, f"Booking {booking_id} flows through dispatch and job systems")
                else:
                    results.add_result("Data Flow Integration", False, f"Data flow broken: dispatch={dispatch_ok}, job={job_ok}")
                    
            except:
                results.add_result("Data Flow Integration", False, "Booking response parsing failed")
        else:
            results.add_result("Data Flow Integration", False, "Booking creation failed for integration test")

# ===== PERFORMANCE & LOAD TESTS =====

def test_performance_metrics(results):
    """Test API performance and response times"""
    print(f"\n⚡ TESTING PERFORMANCE METRICS...")
    
    # Test response times for critical endpoints
    critical_endpoints = [
        ("GET", "/", None),
        ("GET", "/services/catalog", None),
        ("GET", "/places/autocomplete?q=Main Street", None),
        ("POST", "/eta/preview", {"lat": 37.7749, "lng": -122.4194, "timing": {"when": "now"}})
    ]
    
    response_times = []
    for method, endpoint, data in critical_endpoints:
        start_time = time.time()
        response = make_request(method, endpoint, data)
        end_time = time.time()
        
        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
        response_times.append(response_time)
        
        if response and response.status_code == 200 and response_time < 2000:  # Under 2 seconds
            results.add_result(f"Performance: {endpoint}", True, f"Response time: {response_time:.0f}ms")
        else:
            results.add_result(f"Performance: {endpoint}", False, f"Slow response: {response_time:.0f}ms or failed")
    
    avg_response_time = sum(response_times) / len(response_times)
    if avg_response_time < 1000:  # Under 1 second average
        results.add_result("Overall Performance", True, f"Average response time: {avg_response_time:.0f}ms")
    else:
        results.add_result("Overall Performance", False, f"Slow average response: {avg_response_time:.0f}ms", critical=True)

# ===== MAIN TEST EXECUTION =====

def main():
    """Run comprehensive end-to-end tests"""
    print("🚀 Starting SHINE Application Comprehensive End-to-End Testing")
    print(f"Testing API at: {BASE_URL}")
    print("="*80)
    
    results = E2ETestResults()
    
    # Test API health first
    if not test_api_health(results):
        print("❌ API is not accessible. Stopping tests.")
        results.print_summary()
        return False
    
    # Test complete user journeys
    customer_token, booking_id = test_complete_customer_journey(results) or (None, None)
    partner_token = test_complete_partner_journey(results)
    owner_token = test_complete_owner_journey(results)
    
    # Test system integrations
    test_system_integrations(results)
    
    # Test performance metrics
    test_performance_metrics(results)
    
    # Print comprehensive summary
    results.print_summary()
    
    # Determine overall success
    success_rate = (results.passed / (results.passed + results.failed)) * 100
    critical_failures = len(results.critical_issues)
    
    print(f"\n{'='*80}")
    print(f"FINAL ASSESSMENT:")
    print(f"Success Rate: {success_rate:.1f}%")
    print(f"Critical Issues: {critical_failures}")
    
    if success_rate >= 80 and critical_failures == 0:
        print("✅ SYSTEM IS PRODUCTION READY")
        return True
    elif success_rate >= 60 and critical_failures <= 2:
        print("⚠️ SYSTEM NEEDS MINOR FIXES BEFORE PRODUCTION")
        return False
    else:
        print("❌ SYSTEM REQUIRES MAJOR FIXES BEFORE PRODUCTION")
        return False

if __name__ == "__main__":
    success = main()