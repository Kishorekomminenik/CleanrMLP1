#!/usr/bin/env python3
"""
PAGE-12-DISCOVERY Backend API Focused Tests
Tests core discovery functionality with better error handling
"""

import requests
import json
import uuid

# Configuration
BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def make_request(method, endpoint, data=None, auth_token=None):
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=request_headers, params=data, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=request_headers, json=data, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except Exception as e:
        print(f"⚠️  Request error for {method} {endpoint}: {e}")
        return None

def create_test_user(email, password, role="customer"):
    """Create a test user and return auth token"""
    signup_data = {
        "email": email,
        "password": password,
        "role": role,
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    if response and response.status_code == 200:
        return response.json().get("token")
    return None

def test_discovery_core_functionality():
    """Test core discovery functionality"""
    print("🚀 Testing PAGE-12-DISCOVERY Core Functionality...")
    
    # Create test users
    customer_email = f"customer_{uuid.uuid4().hex[:8]}@test.com"
    customer_token = create_test_user(customer_email, "TestPass123!", "customer")
    
    partner_email = f"partner_{uuid.uuid4().hex[:8]}@test.com"
    partner_token = create_test_user(partner_email, "TestPass123!", "partner")
    
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    owner_token = create_test_user(owner_email, "TestPass123!", "owner")
    
    if not all([customer_token, partner_token, owner_token]):
        print("❌ Failed to create test users")
        return False
    
    print(f"✅ Created test users")
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Basic search
    tests_total += 1
    response = make_request("GET", "/discovery/search", {"q": "clean"}, customer_token)
    if response and response.status_code == 200:
        data = response.json()
        if "items" in data and len(data["items"]) > 0:
            print("✅ Basic search working")
            tests_passed += 1
        else:
            print("❌ Basic search returned no results")
    else:
        print("❌ Basic search failed")
    
    # Test 2: Category filtering
    tests_total += 1
    response = make_request("GET", "/discovery/search", {"filter": "Cleaning"}, customer_token)
    if response and response.status_code == 200:
        print("✅ Category filtering working")
        tests_passed += 1
    else:
        print("❌ Category filtering failed")
    
    # Test 3: Partner profile
    tests_total += 1
    response = make_request("GET", "/partners/pa_101/profile", auth_token=customer_token)
    if response and response.status_code == 200:
        data = response.json()
        required_fields = ["partnerId", "name", "rating", "badges", "description", "photos", "services", "recentReviews", "status"]
        if all(field in data for field in required_fields):
            print("✅ Partner profile working")
            tests_passed += 1
        else:
            print("❌ Partner profile missing fields")
    else:
        print("❌ Partner profile failed")
    
    # Test 4: Add favorite
    tests_total += 1
    response = make_request("POST", "/favorites/pa_101", {"fav": True}, customer_token)
    if response and response.status_code == 200:
        print("✅ Add favorite working")
        tests_passed += 1
    else:
        print("❌ Add favorite failed")
    
    # Test 5: List favorites
    tests_total += 1
    response = make_request("GET", "/favorites", auth_token=customer_token)
    if response and response.status_code == 200:
        data = response.json()
        if "items" in data and "pa_101" in data["items"]:
            print("✅ List favorites working")
            tests_passed += 1
        else:
            print("❌ List favorites failed")
    else:
        print("❌ List favorites failed")
    
    # Test 6: Remove favorite
    tests_total += 1
    response = make_request("POST", "/favorites/pa_101", {"fav": False}, customer_token)
    if response and response.status_code == 200:
        print("✅ Remove favorite working")
        tests_passed += 1
    else:
        print("❌ Remove favorite failed")
    
    # Test 7: Owner analytics
    tests_total += 1
    response = make_request("GET", "/analytics/discovery", auth_token=owner_token)
    if response and response.status_code == 200:
        data = response.json()
        if "topSearches" in data and "topFavorites" in data:
            print("✅ Owner analytics working")
            tests_passed += 1
        else:
            print("❌ Owner analytics missing data")
    else:
        print("❌ Owner analytics failed")
    
    # Test 8: Role-based access control (partner trying to access favorites)
    tests_total += 1
    response = make_request("POST", "/favorites/pa_101", {"fav": True}, partner_token)
    if response and response.status_code == 403:
        print("✅ Role-based access control working")
        tests_passed += 1
    else:
        print("❌ Role-based access control failed")
    
    # Test 9: Minimum character validation
    tests_total += 1
    response = make_request("GET", "/discovery/search", {"q": "a"}, customer_token)
    if response and response.status_code == 400:
        print("✅ Minimum character validation working")
        tests_passed += 1
    else:
        print("❌ Minimum character validation failed")
    
    # Test 10: Invalid partner ID
    tests_total += 1
    response = make_request("GET", "/partners/invalid_id/profile", auth_token=customer_token)
    if response and response.status_code == 404:
        print("✅ Invalid partner ID handling working")
        tests_passed += 1
    else:
        print("❌ Invalid partner ID handling failed")
    
    print(f"\n📊 Test Results: {tests_passed}/{tests_total} passed ({(tests_passed/tests_total)*100:.1f}%)")
    
    return tests_passed == tests_total

if __name__ == "__main__":
    success = test_discovery_core_functionality()
    exit(0 if success else 1)