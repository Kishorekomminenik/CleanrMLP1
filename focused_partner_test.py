#!/usr/bin/env python3
"""
Focused Partner Authentication and Endpoint Testing
Tests partner-specific endpoints with proper authentication
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://4d887c9a-9eda-43bf-b7bc-8ea882f55f7b.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def make_request(method, endpoint, data=None, auth_token=None, timeout=10):
    """HTTP request helper"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, timeout=timeout)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=timeout)
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

def create_fresh_partner():
    """Create a fresh partner account that hasn't been role-switched"""
    print("🔧 Creating fresh partner account...")
    
    partner_email = f"fresh_partner_{uuid.uuid4().hex[:8]}@cleanpro.com"
    partner_data = {
        "email": partner_email,
        "username": f"fresh_partner_{uuid.uuid4().hex[:8]}",
        "password": "SecurePass123!",
        "role": "partner",
        "phone": "+14155552999",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", partner_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                partner_token = resp_data["token"]
                user = resp_data["user"]
                if user["role"] == "partner" and user["partner_status"] == "pending":
                    print(f"✅ Fresh partner created: {partner_email} (pending status)")
                    return partner_token, partner_email
                else:
                    print(f"❌ Invalid partner data: {user}")
            else:
                print("❌ Invalid response structure")
        except:
            print("❌ JSON parsing error")
    else:
        print(f"❌ Partner signup failed. Status: {response.status_code if response else 'No response'}")
    
    return None, None

def test_partner_endpoints(partner_token):
    """Test key partner endpoints with fresh token"""
    print(f"\n🧪 Testing Partner Endpoints with Fresh Token")
    
    results = []
    
    # Test 1: Partner Home Dashboard
    response = make_request("GET", "/partner/home", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "status" in resp_data and "verification" in resp_data:
                results.append(("Partner Home Dashboard", True, f"Status: {resp_data['status']}, verification: {resp_data['verification']}"))
            else:
                results.append(("Partner Home Dashboard", False, "Invalid response structure"))
        except:
            results.append(("Partner Home Dashboard", False, "JSON parsing error"))
    else:
        results.append(("Partner Home Dashboard", False, f"Status: {response.status_code if response else 'No response'}"))
    
    # Test 2: Partner Offer Polling
    response = make_request("GET", "/partner/offers/poll", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "offer" in resp_data:
                results.append(("Partner Offer Polling", True, f"Offer polling successful"))
            else:
                results.append(("Partner Offer Polling", False, "No offer field in response"))
        except:
            results.append(("Partner Offer Polling", False, "JSON parsing error"))
    elif response and response.status_code == 423:
        # Expected for pending partners
        results.append(("Partner Offer Polling", True, "Correctly rejected for pending partner (423)"))
    else:
        results.append(("Partner Offer Polling", False, f"Status: {response.status_code if response else 'No response'}"))
    
    # Test 3: Partner Earnings Summary
    response = make_request("GET", "/partner/earnings/summary", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "weeklyEarnings" in resp_data and "tipsYTD" in resp_data:
                results.append(("Partner Earnings Summary", True, f"Weekly: ${resp_data['weeklyEarnings']}, Tips YTD: ${resp_data['tipsYTD']}"))
            else:
                results.append(("Partner Earnings Summary", False, "Invalid response structure"))
        except:
            results.append(("Partner Earnings Summary", False, "JSON parsing error"))
    else:
        results.append(("Partner Earnings Summary", False, f"Status: {response.status_code if response else 'No response'}"))
    
    # Test 4: Partner Training Guides
    response = make_request("GET", "/partner/training/guides", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "guides" in resp_data and isinstance(resp_data["guides"], list):
                results.append(("Partner Training Guides", True, f"Retrieved {len(resp_data['guides'])} training guides"))
            else:
                results.append(("Partner Training Guides", False, "Invalid response structure"))
        except:
            results.append(("Partner Training Guides", False, "JSON parsing error"))
    else:
        results.append(("Partner Training Guides", False, f"Status: {response.status_code if response else 'No response'}"))
    
    return results

def test_authentication_edge_cases():
    """Test authentication edge cases"""
    print(f"\n🔍 Testing Authentication Edge Cases")
    
    results = []
    
    # Test 1: Invalid Credentials
    invalid_data = {"identifier": "nonexistent@example.com", "password": "wrongpassword"}
    response = make_request("POST", "/auth/login", invalid_data)
    if response and response.status_code == 401:
        results.append(("Invalid Credentials Handling", True, "Invalid credentials properly rejected"))
    else:
        results.append(("Invalid Credentials Handling", False, f"Status: {response.status_code if response else 'No response'}"))
    
    # Test 2: Invalid Token
    response = make_request("GET", "/auth/me", auth_token="invalid_token")
    if response and response.status_code == 401:
        results.append(("Invalid Token Handling", True, "Invalid token properly rejected"))
    else:
        results.append(("Invalid Token Handling", False, f"Status: {response.status_code if response else 'No response'}"))
    
    # Test 3: Weak Password Validation
    weak_data = {
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "weak",
        "role": "customer",
        "accept_tos": True
    }
    response = make_request("POST", "/auth/signup", weak_data)
    if response and response.status_code == 422:
        results.append(("Password Validation", True, "Weak password properly rejected"))
    else:
        results.append(("Password Validation", False, f"Status: {response.status_code if response else 'No response'}"))
    
    return results

def test_rating_system_structure():
    """Test rating system with proper structure"""
    print(f"\n⭐ Testing Rating System Structure")
    
    # First create a booking to test with
    customer_email = f"rating_customer_{uuid.uuid4().hex[:8]}@cleanpro.com"
    customer_data = {
        "email": customer_email,
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", customer_data)
    if not response or response.status_code != 200:
        return [("Rating System Setup", False, "Could not create customer")]
    
    customer_token = response.json()["token"]
    
    # Create a booking
    booking_data = {
        "quoteId": "quote_rating_test",
        "service": {
            "serviceType": "basic",
            "timing": {"when": "now"}
        },
        "address": {
            "line1": "123 Rating Street",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94102",
            "lat": 37.7749,
            "lng": -122.4194
        },
        "access": {"entrance": "front_door"},
        "totals": {"subtotal": 89.00, "tax": 7.89, "total": 96.89},
        "payment": {"paymentIntentId": "pi_rating_test", "paymentMethodId": "pm_card_visa"}
    }
    
    response = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
    if not response or response.status_code != 200:
        return [("Rating System Setup", False, "Could not create booking")]
    
    booking_id = response.json()["bookingId"]
    results = []
    
    # Test Rating Context
    response = make_request("GET", f"/ratings/context/{booking_id}", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            print(f"Rating context response: {json.dumps(resp_data, indent=2)}")
            
            # Check for expected fields
            if "booking" in resp_data and "tipPresets" in resp_data:
                booking_info = resp_data["booking"]
                if "total" in booking_info and "currency" in booking_info:
                    results.append(("Rating Context Structure", True, f"Context retrieved: total=${booking_info['total']}, {len(resp_data['tipPresets'])} tip presets"))
                else:
                    results.append(("Rating Context Structure", False, f"Missing booking fields: {booking_info}"))
            else:
                results.append(("Rating Context Structure", False, f"Missing required fields. Response: {resp_data}"))
        except Exception as e:
            results.append(("Rating Context Structure", False, f"JSON parsing error: {e}"))
    else:
        results.append(("Rating Context Structure", False, f"Status: {response.status_code if response else 'No response'}"))
    
    return results

def main():
    """Run focused partner and authentication testing"""
    print("🎯 FOCUSED PARTNER & AUTHENTICATION TESTING")
    print("="*60)
    
    all_results = []
    
    # Test 1: Create fresh partner and test endpoints
    partner_token, partner_email = create_fresh_partner()
    if partner_token:
        partner_results = test_partner_endpoints(partner_token)
        all_results.extend(partner_results)
    else:
        all_results.append(("Fresh Partner Creation", False, "Could not create fresh partner"))
    
    # Test 2: Authentication edge cases
    auth_results = test_authentication_edge_cases()
    all_results.extend(auth_results)
    
    # Test 3: Rating system structure
    rating_results = test_rating_system_structure()
    all_results.extend(rating_results)
    
    # Print results
    print(f"\n📊 FOCUSED TEST RESULTS")
    print("="*60)
    
    passed = failed = 0
    for test_name, success, message in all_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        
        if success:
            passed += 1
        else:
            failed += 1
    
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"\n🎯 FOCUSED TEST SUMMARY:")
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed > 0:
        print(f"\n❌ FAILED TESTS:")
        for test_name, success, message in all_results:
            if not success:
                print(f"  - {test_name}: {message}")

if __name__ == "__main__":
    main()