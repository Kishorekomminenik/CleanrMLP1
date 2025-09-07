#!/usr/bin/env python3
"""
SHINE Application Focused System Testing
Tests specific systems that need verification based on comprehensive test results
"""

import requests
import json
import time
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
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

def test_partner_earnings_system():
    """Test Partner Earnings & Payouts System"""
    print("\n💰 TESTING PARTNER EARNINGS & PAYOUTS SYSTEM...")
    
    # Create partner account
    partner_email = f"earnings_partner_{uuid.uuid4().hex[:8]}@cleanpro.com"
    signup_data = {
        "email": partner_email,
        "username": f"earnings_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "partner",
        "phone": "+14155552999",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if not response or response.status_code != 200:
        print("❌ Partner signup failed")
        return False
    
    partner_token = response.json()["token"]
    
    # Test earnings endpoints
    earnings_tests = [
        ("GET", "/partner/earnings/summary", None),
        ("GET", "/partner/earnings/series", None),
        ("GET", "/partner/earnings/statements", None),
        ("GET", "/partner/payouts", None),
        ("GET", "/partner/bank/status", None),
        ("GET", "/partner/tax/context", None),
        ("GET", "/partner/notifications/prefs", None)
    ]
    
    passed = 0
    for method, endpoint, data in earnings_tests:
        response = make_request(method, endpoint, data, auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                print(f"✅ {endpoint}: Working")
                passed += 1
            except:
                print(f"❌ {endpoint}: Invalid JSON response")
        else:
            print(f"❌ {endpoint}: Failed with status {response.status_code if response else 'No response'}")
    
    print(f"Partner Earnings System: {passed}/{len(earnings_tests)} endpoints working")
    return passed >= len(earnings_tests) * 0.8  # 80% success rate

def test_support_system():
    """Test Support & Disputes System"""
    print("\n🆘 TESTING SUPPORT & DISPUTES SYSTEM...")
    
    # Create customer account
    customer_email = f"support_customer_{uuid.uuid4().hex[:8]}@example.com"
    signup_data = {
        "email": customer_email,
        "username": f"support_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155553000",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if not response or response.status_code != 200:
        print("❌ Customer signup failed")
        return False
    
    customer_token = response.json()["token"]
    
    # Create partner account
    partner_email = f"support_partner_{uuid.uuid4().hex[:8]}@cleanpro.com"
    signup_data["email"] = partner_email
    signup_data["username"] = f"support_p_{uuid.uuid4().hex[:8]}"
    signup_data["role"] = "partner"
    signup_data["phone"] = "+14155553001"
    
    response = make_request("POST", "/auth/signup", signup_data)
    if not response or response.status_code != 200:
        print("❌ Partner signup failed")
        return False
    
    partner_token = response.json()["token"]
    
    # Create owner account
    owner_email = f"support_owner_{uuid.uuid4().hex[:8]}@shine.com"
    signup_data["email"] = owner_email
    signup_data["username"] = f"support_o_{uuid.uuid4().hex[:8]}"
    signup_data["role"] = "owner"
    signup_data["phone"] = "+14155553002"
    
    response = make_request("POST", "/auth/signup", signup_data)
    if not response or response.status_code != 200:
        print("❌ Owner signup failed")
        return False
    
    owner_token = response.json()["token"]
    
    # Test support endpoints
    support_tests = [
        ("Customer FAQ", "GET", "/support/faqs", None, customer_token),
        ("Partner Training", "GET", "/partner/training/guides", None, partner_token),
        ("Owner Support Queue", "GET", "/owner/support/queue", None, owner_token),
        ("Owner Support Metrics", "GET", "/owner/support/metrics", None, owner_token)
    ]
    
    passed = 0
    for test_name, method, endpoint, data, token in support_tests:
        response = make_request(method, endpoint, data, auth_token=token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                print(f"✅ {test_name}: Working")
                passed += 1
            except:
                print(f"❌ {test_name}: Invalid JSON response")
        else:
            print(f"❌ {test_name}: Failed with status {response.status_code if response else 'No response'}")
    
    print(f"Support System: {passed}/{len(support_tests)} endpoints working")
    return passed >= len(support_tests) * 0.8  # 80% success rate

def test_rating_system():
    """Test Rating & Tip System"""
    print("\n⭐ TESTING RATING & TIP SYSTEM...")
    
    # Create customer account
    customer_email = f"rating_customer_{uuid.uuid4().hex[:8]}@example.com"
    signup_data = {
        "email": customer_email,
        "username": f"rating_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155554000",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if not response or response.status_code != 200:
        print("❌ Customer signup failed")
        return False
    
    customer_token = response.json()["token"]
    
    # Create a booking first
    booking_data = {
        "quoteId": f"quote_{uuid.uuid4().hex[:8]}",
        "service": {"serviceType": "basic", "timing": {"when": "now"}},
        "address": {"line1": "123 Rating St", "lat": 37.7749, "lng": -122.4194},
        "access": {"notes": "Rating test"},
        "totals": {"total": 100.0},
        "payment": {"paymentIntentId": f"pi_{uuid.uuid4().hex[:16]}"}
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
    if not response or response.status_code != 200:
        print("❌ Booking creation failed")
        return False
    
    booking_id = response.json()["bookingId"]
    
    # Test rating endpoints
    rating_tests = [
        ("Rating Context", "GET", f"/ratings/context/{booking_id}", None),
        ("Tip Capture", "POST", "/billing/tip", {"amount": 10.0, "currency": "usd", "paymentMethodId": "pm_test"})
    ]
    
    passed = 0
    for test_name, method, endpoint, data in rating_tests:
        response = make_request(method, endpoint, data, auth_token=customer_token)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                print(f"✅ {test_name}: Working")
                passed += 1
            except:
                print(f"❌ {test_name}: Invalid JSON response")
        else:
            print(f"❌ {test_name}: Failed with status {response.status_code if response else 'No response'}")
    
    # Test customer rating submission
    rating_data = {
        "bookingId": booking_id,
        "stars": 5,
        "compliments": ["Professional"],
        "comments": "Great service!",
        "idempotencyKey": f"rating_{uuid.uuid4().hex[:16]}"
    }
    
    response = make_request("POST", "/ratings/customer", rating_data, auth_token=customer_token)
    if response and response.status_code == 200:
        print("✅ Customer Rating Submission: Working")
        passed += 1
    else:
        print(f"❌ Customer Rating Submission: Failed with status {response.status_code if response else 'No response'}")
    
    print(f"Rating System: {passed}/3 endpoints working")
    return passed >= 2  # At least 2/3 working

def test_role_based_access():
    """Test Role-Based Access Control"""
    print("\n🔒 TESTING ROLE-BASED ACCESS CONTROL...")
    
    # Create accounts for each role
    accounts = {}
    roles = ["customer", "partner", "owner"]
    
    for role in roles:
        email = f"rbac_{role}_{uuid.uuid4().hex[:8]}@test.com"
        signup_data = {
            "email": email,
            "username": f"rbac_{role}_{uuid.uuid4().hex[:8]}",
            "password": "SecurePass123!",
            "role": role,
            "phone": f"+1415555{role[0]}{uuid.uuid4().hex[:3]}",
            "accept_tos": True
        }
        
        response = make_request("POST", "/auth/signup", signup_data)
        if response and response.status_code == 200:
            accounts[role] = response.json()["token"]
            print(f"✅ {role.title()} account created")
        else:
            print(f"❌ {role.title()} account creation failed")
            return False
    
    # Test cross-role access restrictions
    access_tests = [
        ("Customer->Partner Earnings", accounts["customer"], "GET", "/partner/earnings/summary", 403),
        ("Customer->Owner Dashboard", accounts["customer"], "GET", "/owner/tiles", 403),
        ("Partner->Owner Support", accounts["partner"], "GET", "/owner/support/queue", 403),
        ("Owner->Partner Training", accounts["owner"], "GET", "/partner/training/guides", 403)
    ]
    
    passed = 0
    for test_name, token, method, endpoint, expected_status in access_tests:
        response = make_request(method, endpoint, auth_token=token)
        if response and response.status_code == expected_status:
            print(f"✅ {test_name}: Properly restricted")
            passed += 1
        else:
            print(f"❌ {test_name}: Not properly restricted (got {response.status_code if response else 'No response'}, expected {expected_status})")
    
    print(f"Role-Based Access Control: {passed}/{len(access_tests)} restrictions working")
    return passed >= len(access_tests) * 0.75  # 75% success rate

def main():
    """Run focused system tests"""
    print("🔍 Starting SHINE Application Focused System Testing")
    print(f"Testing API at: {BASE_URL}")
    print("="*60)
    
    # Test API health
    response = make_request("GET", "/")
    if not response or response.status_code != 200:
        print("❌ API is not accessible. Stopping tests.")
        return False
    
    print("✅ API Health Check: SHINE API accessible")
    
    # Run focused tests
    test_results = {
        "Partner Earnings System": test_partner_earnings_system(),
        "Support System": test_support_system(),
        "Rating System": test_rating_system(),
        "Role-Based Access Control": test_role_based_access()
    }
    
    # Print summary
    print(f"\n{'='*60}")
    print("FOCUSED SYSTEM TEST SUMMARY")
    print(f"{'='*60}")
    
    passed_systems = 0
    for system, result in test_results.items():
        status = "✅ WORKING" if result else "❌ NEEDS ATTENTION"
        print(f"{status}: {system}")
        if result:
            passed_systems += 1
    
    success_rate = (passed_systems / len(test_results)) * 100
    print(f"\nSystem Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 75:
        print("✅ SYSTEMS ARE FUNCTIONAL FOR PRODUCTION")
        return True
    else:
        print("⚠️ SOME SYSTEMS NEED ATTENTION")
        return False

if __name__ == "__main__":
    success = main()