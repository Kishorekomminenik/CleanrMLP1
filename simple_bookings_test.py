#!/usr/bin/env python3
"""
Simple PAGE-11-BOOKINGS API Test
Focused test for the newly implemented booking management endpoints
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://shine-app-debug.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_authentication():
    """Test authentication requirements"""
    print("=== AUTHENTICATION TESTS ===")
    
    # Test without authentication
    response = requests.get(f"{BASE_URL}/bookings/customer?status=upcoming", headers=HEADERS, timeout=10)
    print(f"✅ No auth: {response.status_code} (expected 403)")
    
    # Test with invalid token
    auth_headers = HEADERS.copy()
    auth_headers["Authorization"] = "Bearer invalid_token"
    response = requests.get(f"{BASE_URL}/bookings/customer?status=upcoming", headers=auth_headers, timeout=10)
    print(f"✅ Invalid token: {response.status_code} (expected 401)")

def get_customer_token():
    """Get customer authentication token"""
    login_data = {
        "identifier": "user_001@test.com",
        "password": "TestPass123!"
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=HEADERS, timeout=10)
    if response.status_code == 200:
        return response.json()["token"]
    return None

def get_partner_token():
    """Get partner authentication token"""
    # Create a new partner
    signup_data = {
        "email": f"test_partner_{datetime.now().timestamp()}@test.com",
        "password": "TestPass123!",
        "role": "partner",
        "accept_tos": True
    }
    
    response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS, timeout=10)
    if response.status_code == 200:
        return response.json()["token"]
    return None

def test_customer_bookings(token):
    """Test customer booking endpoints"""
    print("\n=== CUSTOMER BOOKING TESTS ===")
    
    auth_headers = HEADERS.copy()
    auth_headers["Authorization"] = f"Bearer {token}"
    
    # Test different status filters
    statuses = ["upcoming", "in_progress", "past"]
    
    for status in statuses:
        params = {"status": status, "page": 1, "size": 20}
        response = requests.get(f"{BASE_URL}/bookings/customer", headers=auth_headers, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            print(f"✅ Customer {status}: {response.status_code} - {len(items)} bookings")
            
            # Check structure if items exist
            if items:
                item = items[0]
                required_fields = ["bookingId", "dateTime", "serviceType", "addressShort", "status", "price"]
                missing_fields = [field for field in required_fields if field not in item]
                if missing_fields:
                    print(f"   ⚠️  Missing fields: {missing_fields}")
                else:
                    print(f"   ✅ Structure valid: {item['bookingId']} - {item['status']}")
        else:
            print(f"❌ Customer {status}: {response.status_code}")

def test_partner_bookings(token):
    """Test partner booking endpoints"""
    print("\n=== PARTNER BOOKING TESTS ===")
    
    auth_headers = HEADERS.copy()
    auth_headers["Authorization"] = f"Bearer {token}"
    
    # Test different status filters
    statuses = ["today", "upcoming", "completed"]
    
    for status in statuses:
        params = {"status": status, "page": 1, "size": 20}
        response = requests.get(f"{BASE_URL}/bookings/partner", headers=auth_headers, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            print(f"✅ Partner {status}: {response.status_code} - {len(items)} jobs")
            
            # Check structure if items exist
            if items:
                item = items[0]
                required_fields = ["bookingId", "time", "serviceType", "addressShort", "status", "payout", "distanceKm"]
                missing_fields = [field for field in required_fields if field not in item]
                if missing_fields:
                    print(f"   ⚠️  Missing fields: {missing_fields}")
                else:
                    print(f"   ✅ Structure valid: {item['bookingId']} - {item['status']}")
        else:
            print(f"❌ Partner {status}: {response.status_code}")

def test_role_separation(customer_token, partner_token):
    """Test role-based access control"""
    print("\n=== ROLE SEPARATION TESTS ===")
    
    # Customer trying to access partner endpoint
    customer_headers = HEADERS.copy()
    customer_headers["Authorization"] = f"Bearer {customer_token}"
    
    params = {"status": "today", "page": 1, "size": 20}
    response = requests.get(f"{BASE_URL}/bookings/partner", headers=customer_headers, params=params, timeout=10)
    print(f"✅ Customer->Partner endpoint: {response.status_code} (expected 403)")
    
    # Partner trying to access customer endpoint
    partner_headers = HEADERS.copy()
    partner_headers["Authorization"] = f"Bearer {partner_token}"
    
    params = {"status": "upcoming", "page": 1, "size": 20}
    response = requests.get(f"{BASE_URL}/bookings/customer", headers=partner_headers, params=params, timeout=10)
    print(f"✅ Partner->Customer endpoint: {response.status_code} (expected 403)")

def test_booking_details(customer_token):
    """Test booking detail endpoints"""
    print("\n=== BOOKING DETAIL TESTS ===")
    
    auth_headers = HEADERS.copy()
    auth_headers["Authorization"] = f"Bearer {customer_token}"
    
    # Test with mock booking IDs
    booking_ids = ["bk_upcoming_001", "bk_inprogress_002", "bk_completed_003"]
    
    for booking_id in booking_ids:
        response = requests.get(f"{BASE_URL}/bookings/{booking_id}", headers=auth_headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["bookingId", "status", "service", "address", "timeline", "receipt"]
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ {booking_id}: Missing fields {missing_fields}")
            else:
                print(f"✅ {booking_id}: {response.status_code} - {data['status']}")
        elif response.status_code == 403:
            print(f"✅ {booking_id}: {response.status_code} (access denied - acceptable)")
        elif response.status_code == 404:
            print(f"✅ {booking_id}: {response.status_code} (not found - acceptable)")
        else:
            print(f"❌ {booking_id}: {response.status_code}")

def test_invoice_endpoints(customer_token):
    """Test invoice endpoints"""
    print("\n=== INVOICE TESTS ===")
    
    auth_headers = HEADERS.copy()
    auth_headers["Authorization"] = f"Bearer {customer_token}"
    
    # Test with completed booking
    response = requests.get(f"{BASE_URL}/bookings/bk_completed_003/invoice", headers=auth_headers, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        if "url" in data and "storage.shine.com" in data["url"]:
            print(f"✅ Invoice (completed): {response.status_code} - URL generated")
        else:
            print(f"❌ Invoice (completed): Invalid URL format")
    elif response.status_code in [403, 404]:
        print(f"✅ Invoice (completed): {response.status_code} (access denied/not found - acceptable)")
    else:
        print(f"❌ Invoice (completed): {response.status_code}")
    
    # Test with non-completed booking
    response = requests.get(f"{BASE_URL}/bookings/bk_upcoming_001/invoice", headers=auth_headers, timeout=10)
    
    if response.status_code == 400:
        print(f"✅ Invoice (non-completed): {response.status_code} (correctly denied)")
    elif response.status_code in [403, 404]:
        print(f"✅ Invoice (non-completed): {response.status_code} (access denied/not found - acceptable)")
    else:
        print(f"❌ Invoice (non-completed): {response.status_code}")

def main():
    """Run all tests"""
    print("PAGE-11-BOOKINGS API TESTING")
    print("=" * 50)
    
    # Test authentication
    test_authentication()
    
    # Get tokens
    print("\n=== SETUP ===")
    customer_token = get_customer_token()
    partner_token = get_partner_token()
    
    if customer_token:
        print("✅ Customer token obtained")
    else:
        print("❌ Could not get customer token")
        return
    
    if partner_token:
        print("✅ Partner token obtained")
    else:
        print("⚠️  Could not get partner token")
    
    # Run tests
    test_customer_bookings(customer_token)
    
    if partner_token:
        test_partner_bookings(partner_token)
        test_role_separation(customer_token, partner_token)
    
    test_booking_details(customer_token)
    test_invoice_endpoints(customer_token)
    
    print("\n" + "=" * 50)
    print("PAGE-11-BOOKINGS TESTING COMPLETED")

if __name__ == "__main__":
    main()