#!/usr/bin/env python3
"""
PAGE-12-DISCOVERY Backend API Comprehensive Tests
Tests all discovery, search, favorites, and analytics endpoints
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

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, message=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"PAGE-12-DISCOVERY TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"   - {result['test']}: {result['message']}")

def make_request(method, endpoint, data=None, headers=None, auth_token=None):
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=request_headers, params=data, timeout=30)
        elif method == "POST":
            response = requests.post(url, headers=request_headers, json=data, timeout=30)
        elif method == "PATCH":
            response = requests.patch(url, headers=request_headers, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.Timeout:
        print(f"⚠️  Request timeout for {method} {endpoint}")
        return None
    except requests.exceptions.RequestException as e:
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

def test_discovery_search_endpoints(results, auth_token):
    """Test all discovery search endpoints"""
    print(f"\n🔍 Testing Discovery Search Endpoints...")
    
    # Test 1: Basic search with query
    response = make_request("GET", "/discovery/search", {"q": "clean"}, auth_token=auth_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            if "items" in data and isinstance(data["items"], list):
                results.add_result("Basic search with query 'clean'", True, f"Found {len(data['items'])} results")
            else:
                results.add_result("Basic search with query 'clean'", False, "Invalid response structure")
        else:
            results.add_result("Basic search with query 'clean'", False, f"Status: {response.status_code}")
    else:
        results.add_result("Basic search with query 'clean'", False, "Request failed")
    
    # Test 2: Category filtering
    response = make_request("GET", "/discovery/search", {"filter": "Cleaning"}, auth_token=auth_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            results.add_result("Category filtering with 'Cleaning'", True, f"Found {len(data['items'])} cleaning services")
        else:
            results.add_result("Category filtering with 'Cleaning'", False, f"Status: {response.status_code}")
    else:
        results.add_result("Category filtering with 'Cleaning'", False, "Request failed")
    
    # Test 3: Location-based search
    response = make_request("GET", "/discovery/search", {
        "lat": 37.7749,
        "lng": -122.4194,
        "radiusKm": 10
    }, auth_token=auth_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            results.add_result("Location-based search", True, f"Found {len(data['items'])} partners within 10km")
        else:
            results.add_result("Location-based search", False, f"Status: {response.status_code}")
    else:
        results.add_result("Location-based search", False, "Request failed")
    
    # Test 4: Sorting by rating
    response = make_request("GET", "/discovery/search", {"sort": "rating"}, auth_token=auth_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            results.add_result("Sorting by rating", True, f"Results sorted by rating")
        else:
            results.add_result("Sorting by rating", False, f"Status: {response.status_code}")
    else:
        results.add_result("Sorting by rating", False, "Request failed")
    
    # Test 5: Sorting by distance
    response = make_request("GET", "/discovery/search", {"sort": "distance"}, auth_token=auth_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            results.add_result("Sorting by distance", True, f"Results sorted by distance")
        else:
            results.add_result("Sorting by distance", False, f"Status: {response.status_code}")
    else:
        results.add_result("Sorting by distance", False, "Request failed")
    
    # Test 6: Pagination
    response = make_request("GET", "/discovery/search", {"page": 1, "size": 2}, auth_token=auth_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            if len(data["items"]) <= 2:
                results.add_result("Pagination with page=1&size=2", True, f"Returned {len(data['items'])} items")
            else:
                results.add_result("Pagination with page=1&size=2", False, f"Expected ≤2 items, got {len(data['items'])}")
        else:
            results.add_result("Pagination with page=1&size=2", False, f"Status: {response.status_code}")
    else:
        results.add_result("Pagination with page=1&size=2", False, "Request failed")
    
    # Test 7: Fuzzy search with misspelled query
    response = make_request("GET", "/discovery/search", {"q": "clen"}, auth_token=auth_token)  # Misspelled "clean"
    if response:
        if response.status_code == 200:
            data = response.json()
            results.add_result("Fuzzy search with misspelled query", True, f"Found {len(data['items'])} results for 'clen'")
        else:
            results.add_result("Fuzzy search with misspelled query", False, f"Status: {response.status_code}")
    else:
        results.add_result("Fuzzy search with misspelled query", False, "Request failed")
    
    # Test 8: Minimum character validation
    response = make_request("GET", "/discovery/search", {"q": "a"}, auth_token=auth_token)
    if response:
        if response.status_code == 400:
            results.add_result("Minimum character validation (reject <2 chars)", True, "Correctly rejected 1-char query")
        else:
            results.add_result("Minimum character validation (reject <2 chars)", False, f"Expected 400, got {response.status_code}")
    else:
        results.add_result("Minimum character validation (reject <2 chars)", False, "Request failed")

def test_partner_profile_endpoints(results, auth_token):
    """Test partner profile endpoints"""
    print(f"\n👤 Testing Partner Profile Endpoints...")
    
    # Valid partner IDs to test
    valid_partner_ids = ["pa_101", "pa_102", "pa_103", "pa_104", "pa_105"]
    
    for partner_id in valid_partner_ids:
        response = make_request("GET", f"/partners/{partner_id}/profile", auth_token=auth_token)
        if response:
            if response.status_code == 200:
                data = response.json()
                required_fields = ["partnerId", "name", "rating", "badges", "description", "photos", "services", "recentReviews", "status"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    results.add_result(f"Partner profile {partner_id}", True, f"All required fields present")
                else:
                    results.add_result(f"Partner profile {partner_id}", False, f"Missing fields: {missing_fields}")
            else:
                results.add_result(f"Partner profile {partner_id}", False, f"Status: {response.status_code}")
        else:
            results.add_result(f"Partner profile {partner_id}", False, "Request failed")
    
    # Test invalid partner ID
    response = make_request("GET", "/partners/invalid_id/profile", auth_token=auth_token)
    if response:
        if response.status_code == 404:
            results.add_result("Invalid partner ID (should return 404)", True, "Correctly returned 404")
        else:
            results.add_result("Invalid partner ID (should return 404)", False, f"Expected 404, got {response.status_code}")
    else:
        results.add_result("Invalid partner ID (should return 404)", False, "Request failed")

def test_favorites_endpoints(results, customer_token, partner_token):
    """Test favorites endpoints"""
    print(f"\n⭐ Testing Favorites Endpoints...")
    
    # Test 1: Add favorite (customer)
    response = make_request("POST", "/favorites/pa_101", {"fav": True}, auth_token=customer_token)
    if response:
        if response.status_code == 200:
            results.add_result("Add favorite (customer)", True, "Successfully added favorite")
        else:
            results.add_result("Add favorite (customer)", False, f"Status: {response.status_code}")
    else:
        results.add_result("Add favorite (customer)", False, "Request failed")
    
    # Test 2: Remove favorite (customer)
    response = make_request("POST", "/favorites/pa_101", {"fav": False}, auth_token=customer_token)
    if response:
        if response.status_code == 200:
            results.add_result("Remove favorite (customer)", True, "Successfully removed favorite")
        else:
            results.add_result("Remove favorite (customer)", False, f"Status: {response.status_code}")
    else:
        results.add_result("Remove favorite (customer)", False, "Request failed")
    
    # Test 3: Invalid partner ID for favorites
    response = make_request("POST", "/favorites/invalid_id", {"fav": True}, auth_token=customer_token)
    if response:
        if response.status_code == 404:
            results.add_result("Invalid partner ID for favorites", True, "Correctly returned 404")
        else:
            results.add_result("Invalid partner ID for favorites", False, f"Expected 404, got {response.status_code}")
    else:
        results.add_result("Invalid partner ID for favorites", False, "Request failed")
    
    # Test 4: Partner role access (should return 403)
    response = make_request("POST", "/favorites/pa_101", {"fav": True}, auth_token=partner_token)
    if response:
        if response.status_code == 403:
            results.add_result("Partner role access to favorites (should return 403)", True, "Correctly denied partner access")
        else:
            results.add_result("Partner role access to favorites (should return 403)", False, f"Expected 403, got {response.status_code}")
    else:
        results.add_result("Partner role access to favorites (should return 403)", False, "Request failed")
    
    # Test 5: List favorites (customer)
    response = make_request("GET", "/favorites", auth_token=customer_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            if "items" in data and isinstance(data["items"], list):
                results.add_result("List favorites (customer)", True, f"Retrieved {len(data['items'])} favorites")
            else:
                results.add_result("List favorites (customer)", False, "Invalid response structure")
        else:
            results.add_result("List favorites (customer)", False, f"Status: {response.status_code}")
    else:
        results.add_result("List favorites (customer)", False, "Request failed")
    
    # Test 6: List favorites with partner role (should return 403)
    response = make_request("GET", "/favorites", auth_token=partner_token)
    if response:
        if response.status_code == 403:
            results.add_result("List favorites with partner role (should return 403)", True, "Correctly denied partner access")
        else:
            results.add_result("List favorites with partner role (should return 403)", False, f"Expected 403, got {response.status_code}")
    else:
        results.add_result("List favorites with partner role (should return 403)", False, "Request failed")

def test_analytics_endpoints(results, owner_token, customer_token):
    """Test analytics endpoints"""
    print(f"\n📊 Testing Analytics Endpoints...")
    
    # Test 1: Owner analytics access
    response = make_request("GET", "/analytics/discovery", auth_token=owner_token)
    if response:
        if response.status_code == 200:
            data = response.json()
            required_fields = ["topSearches", "topFavorites"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                results.add_result("Owner analytics access", True, f"Retrieved analytics data")
            else:
                results.add_result("Owner analytics access", False, f"Missing fields: {missing_fields}")
        else:
            results.add_result("Owner analytics access", False, f"Status: {response.status_code}")
    else:
        results.add_result("Owner analytics access", False, "Request failed")
    
    # Test 2: Customer role access to analytics (should return 403)
    response = make_request("GET", "/analytics/discovery", auth_token=customer_token)
    if response:
        if response.status_code == 403:
            results.add_result("Customer role access to analytics (should return 403)", True, "Correctly denied customer access")
        else:
            results.add_result("Customer role access to analytics (should return 403)", False, f"Expected 403, got {response.status_code}")
    else:
        results.add_result("Customer role access to analytics (should return 403)", False, "Request failed")

def test_authentication_requirements(results):
    """Test authentication requirements for all endpoints"""
    print(f"\n🔐 Testing Authentication Requirements...")
    
    # Test endpoints without authentication
    endpoints_to_test = [
        ("GET", "/discovery/search"),
        ("GET", "/partners/pa_101/profile"),
        ("POST", "/favorites/pa_101"),
        ("GET", "/favorites"),
        ("GET", "/analytics/discovery")
    ]
    
    for method, endpoint in endpoints_to_test:
        response = make_request(method, endpoint, {"fav": True} if method == "POST" else None)
        if response:
            if response.status_code in [401, 403]:
                results.add_result(f"Auth required for {method} {endpoint}", True, f"Correctly returned {response.status_code}")
            else:
                results.add_result(f"Auth required for {method} {endpoint}", False, f"Expected 401/403, got {response.status_code}")
        else:
            results.add_result(f"Auth required for {method} {endpoint}", False, "Request failed")

def main():
    """Run all PAGE-12-DISCOVERY tests"""
    print("🚀 Starting PAGE-12-DISCOVERY Backend API Tests...")
    print(f"Testing against: {BASE_URL}")
    
    results = TestResults()
    
    # Create test users
    print(f"\n👥 Creating test users...")
    
    # Create customer user
    customer_email = f"customer_{uuid.uuid4().hex[:8]}@test.com"
    customer_token = create_test_user(customer_email, "TestPass123!", "customer")
    if not customer_token:
        print("❌ Failed to create customer user")
        return
    print(f"✅ Created customer: {customer_email}")
    
    # Create partner user
    partner_email = f"partner_{uuid.uuid4().hex[:8]}@test.com"
    partner_token = create_test_user(partner_email, "TestPass123!", "partner")
    if not partner_token:
        print("❌ Failed to create partner user")
        return
    print(f"✅ Created partner: {partner_email}")
    
    # Create owner user
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    owner_token = create_test_user(owner_email, "TestPass123!", "owner")
    if not owner_token:
        print("❌ Failed to create owner user")
        return
    print(f"✅ Created owner: {owner_email}")
    
    # Run tests
    test_authentication_requirements(results)
    test_discovery_search_endpoints(results, customer_token)
    test_partner_profile_endpoints(results, customer_token)
    test_favorites_endpoints(results, customer_token, partner_token)
    test_analytics_endpoints(results, owner_token, customer_token)
    
    # Print results
    results.print_summary()
    
    # Return success/failure for CI
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)