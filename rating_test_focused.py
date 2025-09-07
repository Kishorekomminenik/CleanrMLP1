#!/usr/bin/env python3
"""
Focused PAGE-8-RATE API Testing
Tests specifically the rating and tip endpoints
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def make_request(method, endpoint, data=None, auth_token=None):
    """Helper function to make HTTP requests"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
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
    except Exception as e:
        print(f"Request failed: {method} {endpoint} - {e}")
        return None

def create_test_users():
    """Create test users for rating tests"""
    print("Creating test users...")
    
    # Create customer
    customer_data = {
        "email": f"rating_customer_{uuid.uuid4().hex[:8]}@example.com",
        "username": f"rating_customer_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", customer_data)
    customer_token = None
    if response and response.status_code == 200:
        customer_token = response.json()["token"]
        print(f"✅ Customer created: {customer_data['email']}")
    
    # Create partner
    partner_data = {
        "email": f"rating_partner_{uuid.uuid4().hex[:8]}@example.com",
        "username": f"rating_partner_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "partner",
        "phone": "+14155552672",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", partner_data)
    partner_token = None
    if response and response.status_code == 200:
        partner_token = response.json()["token"]
        print(f"✅ Partner created: {partner_data['email']}")
    
    # Create owner
    owner_data = {
        "email": f"rating_owner_{uuid.uuid4().hex[:8]}@example.com",
        "username": f"rating_owner_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "owner",
        "phone": "+14155552673",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", owner_data)
    owner_token = None
    if response and response.status_code == 200:
        # Handle MFA for owner
        if "mfa_required" in response.json():
            mfa_data = response.json()
            user_id = mfa_data["user_id"]
            mfa_code = mfa_data["dev_mfa_code"]
            
            verify_response = make_request("POST", "/auth/mfa/verify", {
                "user_id": user_id,
                "code": mfa_code
            })
            
            if verify_response and verify_response.status_code == 200:
                owner_token = verify_response.json()["token"]
                print(f"✅ Owner created with MFA: {owner_data['email']}")
        else:
            owner_token = response.json()["token"]
            print(f"✅ Owner created: {owner_data['email']}")
    
    return customer_token, partner_token, owner_token

def create_test_booking(customer_token):
    """Create a test booking for rating tests"""
    print("Creating test booking...")
    
    booking_data = {
        "quoteId": "quote_rating_test",
        "service": {
            "type": "basic",
            "timing": {"when": "now"},
            "details": {"bedrooms": 2, "bathrooms": 1}
        },
        "address": {
            "line1": "123 Rating Test Street",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94102",
            "lat": 37.7749,
            "lng": -122.4194
        },
        "access": {
            "entrance": "front_door",
            "notes": "Test booking for ratings"
        },
        "totals": {
            "subtotal": 89.00,
            "tax": 7.89,
            "total": 96.89
        },
        "payment": {
            "paymentIntentId": "pi_rating_test",
            "paymentMethodId": "pm_card_visa"
        },
        "applyCredits": False,
        "promoCode": None
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
    
    if response and response.status_code == 200:
        booking_id = response.json()["bookingId"]
        print(f"✅ Booking created: {booking_id}")
        return booking_id
    else:
        print(f"❌ Failed to create booking")
        return None

def test_rating_context(customer_token, booking_id):
    """Test GET /api/ratings/context/{booking_id}"""
    print("\n🔍 Testing Rating Context Retrieval...")
    
    response = make_request("GET", f"/ratings/context/{booking_id}", auth_token=customer_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            print(f"✅ Rating context retrieved successfully")
            print(f"   Booking ID: {data.get('bookingId')}")
            print(f"   Total: ${data.get('total')}")
            print(f"   Currency: {data.get('currency')}")
            print(f"   Partner: {data.get('partner', {}).get('name')}")
            print(f"   Customer: {data.get('customer', {}).get('name')}")
            print(f"   Tip Presets: {data.get('eligibleTipPresets')}")
            print(f"   Already Rated: {data.get('alreadyRated')}")
            return True
        except Exception as e:
            print(f"❌ JSON parsing error: {e}")
    else:
        print(f"❌ Rating context failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_customer_rating_submission(customer_token, booking_id):
    """Test POST /api/ratings/customer"""
    print("\n⭐ Testing Customer Rating Submission...")
    
    rating_data = {
        "bookingId": booking_id,
        "stars": 5,
        "compliments": ["Professional", "On Time", "Thorough"],
        "comment": "Excellent service! Very thorough cleaning and arrived exactly on time.",
        "tip": {
            "amount": 15.0,
            "currency": "usd"
        },
        "idempotencyKey": f"rating_{uuid.uuid4().hex[:16]}"
    }
    
    response = make_request("POST", "/ratings/customer", rating_data, auth_token=customer_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            print(f"✅ Customer rating submitted successfully")
            print(f"   OK: {data.get('ok')}")
            print(f"   Tip Capture OK: {data.get('tipCapture', {}).get('ok')}")
            print(f"   Payment Intent ID: {data.get('tipCapture', {}).get('paymentIntentId')}")
            return rating_data["idempotencyKey"]
        except Exception as e:
            print(f"❌ JSON parsing error: {e}")
    else:
        print(f"❌ Customer rating failed. Status: {response.status_code if response else 'No response'}")
        if response:
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('detail')}")
            except:
                pass
    
    return None

def test_customer_rating_validation(customer_token):
    """Test customer rating validation (stars must be 1-5)"""
    print("\n🔍 Testing Customer Rating Validation...")
    
    invalid_ratings = [0, 6, -1, 10]
    validation_passed = 0
    
    for invalid_stars in invalid_ratings:
        rating_data = {
            "bookingId": f"bk_validation_{uuid.uuid4().hex[:8]}",
            "stars": invalid_stars,
            "compliments": [],
            "tip": {"amount": 0, "currency": "usd"},
            "idempotencyKey": f"invalid_{uuid.uuid4().hex[:8]}"
        }
        
        response = make_request("POST", "/ratings/customer", rating_data, auth_token=customer_token)
        
        if response and response.status_code == 400:
            validation_passed += 1
            print(f"   ✅ Invalid stars ({invalid_stars}) properly rejected")
        else:
            print(f"   ❌ Invalid stars ({invalid_stars}) not rejected. Status: {response.status_code if response else 'No response'}")
    
    if validation_passed == len(invalid_ratings):
        print(f"✅ All {validation_passed} invalid star ratings properly rejected")
        return True
    else:
        print(f"❌ Validation failed. Only {validation_passed}/{len(invalid_ratings)} invalid ratings rejected")
        return False

def test_partner_rating_submission(partner_token, booking_id):
    """Test POST /api/ratings/partner"""
    print("\n⭐ Testing Partner Rating Submission...")
    
    rating_data = {
        "bookingId": booking_id,
        "stars": 4,
        "notes": ["Polite", "Prepared"],
        "comment": "Customer was ready and provided clear instructions.",
        "idempotencyKey": f"partner_rating_{uuid.uuid4().hex[:16]}"
    }
    
    response = make_request("POST", "/ratings/partner", rating_data, auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            print(f"✅ Partner rating submitted successfully")
            print(f"   OK: {data.get('ok')}")
            return rating_data["idempotencyKey"]
        except Exception as e:
            print(f"❌ JSON parsing error: {e}")
    else:
        print(f"❌ Partner rating failed. Status: {response.status_code if response else 'No response'}")
        if response:
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('detail')}")
            except:
                pass
    
    return None

def test_separate_tip_capture(customer_token):
    """Test POST /api/billing/tip"""
    print("\n💰 Testing Separate Tip Capture...")
    
    tip_data = {
        "bookingId": f"bk_tip_test_{uuid.uuid4().hex[:8]}",
        "amount": 12.50,
        "currency": "usd"
    }
    
    response = make_request("POST", "/billing/tip", tip_data, auth_token=customer_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            print(f"✅ Tip captured separately")
            print(f"   OK: {data.get('ok')}")
            print(f"   Payment Intent ID: {data.get('paymentIntentId')}")
            return True
        except Exception as e:
            print(f"❌ JSON parsing error: {e}")
    else:
        print(f"❌ Separate tip capture failed. Status: {response.status_code if response else 'No response'}")
        if response:
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('detail')}")
            except:
                pass
    
    return False

def test_tip_capture_large_amount_failure(customer_token):
    """Test tip payment failure for large amounts (>$50)"""
    print("\n💰 Testing Tip Capture Large Amount Failure...")
    
    tip_data = {
        "bookingId": f"bk_large_tip_{uuid.uuid4().hex[:8]}",
        "amount": 75.0,  # Large amount should trigger failure
        "currency": "usd"
    }
    
    response = make_request("POST", "/billing/tip", tip_data, auth_token=customer_token)
    
    if response and response.status_code == 402:
        try:
            error_data = response.json()
            print(f"✅ Large tip amount properly declined")
            print(f"   Error: {error_data.get('detail')}")
            return True
        except:
            print(f"✅ Large tip amount properly declined (402 status)")
            return True
    else:
        print(f"❌ Large tip amount failure not handled correctly. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_owner_ratings_dashboard(owner_token):
    """Test GET /api/owner/ratings"""
    print("\n📊 Testing Owner Ratings Dashboard...")
    
    response = make_request("GET", "/owner/ratings", auth_token=owner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            items = data.get("items", [])
            print(f"✅ Owner ratings dashboard retrieved")
            print(f"   Items count: {len(items)}")
            
            if len(items) > 0:
                item = items[0]
                print(f"   Sample item:")
                print(f"     Booking ID: {item.get('bookingId')}")
                print(f"     Partner Rating: {item.get('partnerRating')}")
                print(f"     Customer Rating: {item.get('customerRating')}")
                print(f"     Tip: ${item.get('tip')}")
                print(f"     Flags: {item.get('flags')}")
            
            return True
        except Exception as e:
            print(f"❌ JSON parsing error: {e}")
    else:
        print(f"❌ Owner ratings dashboard failed. Status: {response.status_code if response else 'No response'}")
    
    return False

def test_role_access_control(customer_token, partner_token, owner_token):
    """Test role-based access control for rating endpoints"""
    print("\n🔒 Testing Role-Based Access Control...")
    
    test_booking_id = f"bk_access_test_{uuid.uuid4().hex[:8]}"
    
    # Test customer endpoints with wrong roles
    customer_rating_data = {
        "bookingId": test_booking_id,
        "stars": 5,
        "compliments": [],
        "tip": {"amount": 0, "currency": "usd"},
        "idempotencyKey": f"access_test_{uuid.uuid4().hex[:8]}"
    }
    
    # Partner should not be able to submit customer ratings
    response = make_request("POST", "/ratings/customer", customer_rating_data, auth_token=partner_token)
    if response and response.status_code == 403:
        print("   ✅ Partner properly denied customer rating access")
    else:
        print(f"   ❌ Partner not denied customer rating access. Status: {response.status_code if response else 'No response'}")
        return False
    
    # Test partner endpoints with wrong roles
    partner_rating_data = {
        "bookingId": test_booking_id,
        "stars": 4,
        "notes": [],
        "idempotencyKey": f"access_test_{uuid.uuid4().hex[:8]}"
    }
    
    # Customer should not be able to submit partner ratings
    response = make_request("POST", "/ratings/partner", partner_rating_data, auth_token=customer_token)
    if response and response.status_code == 403:
        print("   ✅ Customer properly denied partner rating access")
    else:
        print(f"   ❌ Customer not denied partner rating access. Status: {response.status_code if response else 'No response'}")
        return False
    
    # Test owner endpoints with wrong roles
    response = make_request("GET", "/owner/ratings", auth_token=customer_token)
    if response and response.status_code == 403:
        print("   ✅ Customer properly denied owner dashboard access")
    else:
        print(f"   ❌ Customer not denied owner dashboard access. Status: {response.status_code if response else 'No response'}")
        return False
    
    print("✅ All role-based access controls working correctly")
    return True

def main():
    """Run focused rating API tests"""
    print("🚀 Starting PAGE-8-RATE API Focused Tests")
    print(f"Testing API at: {BASE_URL}")
    print("="*60)
    
    # Create test users
    customer_token, partner_token, owner_token = create_test_users()
    
    if not all([customer_token, partner_token, owner_token]):
        print("❌ Failed to create test users. Stopping tests.")
        return False
    
    # Create test booking
    booking_id = create_test_booking(customer_token)
    
    if not booking_id:
        print("❌ Failed to create test booking. Stopping tests.")
        return False
    
    print("\n" + "="*60)
    print("RUNNING RATING & TIP API TESTS")
    print("="*60)
    
    # Test rating context
    test_rating_context(customer_token, booking_id)
    
    # Test customer rating submission
    customer_idempotency_key = test_customer_rating_submission(customer_token, booking_id)
    
    # Test customer rating validation
    test_customer_rating_validation(customer_token)
    
    # Test partner rating submission
    partner_idempotency_key = test_partner_rating_submission(partner_token, booking_id)
    
    # Test separate tip capture
    test_separate_tip_capture(customer_token)
    
    # Test tip capture failure for large amounts
    test_tip_capture_large_amount_failure(customer_token)
    
    # Test owner ratings dashboard
    test_owner_ratings_dashboard(owner_token)
    
    # Test role-based access control
    test_role_access_control(customer_token, partner_token, owner_token)
    
    print("\n" + "="*60)
    print("PAGE-8-RATE API TESTS COMPLETED")
    print("="*60)
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)