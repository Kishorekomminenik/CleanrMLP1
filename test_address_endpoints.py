#!/usr/bin/env python3
"""
Simple Address Endpoints Test
Tests the newly implemented address API endpoints
"""

import requests
import json
import uuid

BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"

def test_address_endpoints():
    print("🏠 Testing Address API Endpoints")
    print("=" * 50)
    
    # 1. Create a test user
    print("\n1. Creating test user...")
    signup_data = {
        "email": f"address_test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "SecurePass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    if response.status_code != 200:
        print(f"❌ Failed to create user: {response.status_code}")
        return False
    
    token = response.json()["token"]
    print(f"✅ User created successfully")
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # 2. Test authentication required
    print("\n2. Testing authentication requirements...")
    
    # Test without auth
    response = requests.get(f"{BASE_URL}/addresses")
    if response.status_code in [401, 403]:
        print(f"✅ GET /addresses requires auth (Status: {response.status_code})")
    else:
        print(f"❌ GET /addresses auth not enforced (Status: {response.status_code})")
    
    response = requests.post(f"{BASE_URL}/addresses", json={})
    if response.status_code in [401, 403]:
        print(f"✅ POST /addresses requires auth (Status: {response.status_code})")
    else:
        print(f"❌ POST /addresses auth not enforced (Status: {response.status_code})")
    
    # 3. Test listing addresses (empty initially)
    print("\n3. Testing address listing (empty)...")
    response = requests.get(f"{BASE_URL}/addresses", headers=headers)
    if response.status_code == 200:
        data = response.json()
        if "addresses" in data and len(data["addresses"]) == 0:
            print("✅ Empty address list returned")
        else:
            print(f"✅ Address list returned with {len(data.get('addresses', []))} existing addresses")
    else:
        print(f"❌ Failed to list addresses: {response.status_code}")
        return False
    
    # 4. Test saving a valid address
    print("\n4. Testing address saving...")
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
    
    response = requests.post(f"{BASE_URL}/addresses", json=address_data, headers=headers)
    if response.status_code == 200:
        data = response.json()
        if "id" in data:
            address_id = data["id"]
            print(f"✅ Address saved successfully (ID: {address_id})")
        else:
            print(f"❌ Invalid save response: {data}")
            return False
    else:
        print(f"❌ Failed to save address: {response.status_code}")
        return False
    
    # 5. Test listing addresses after saving
    print("\n5. Testing address listing (with data)...")
    response = requests.get(f"{BASE_URL}/addresses", headers=headers)
    if response.status_code == 200:
        data = response.json()
        if "addresses" in data and len(data["addresses"]) > 0:
            address = data["addresses"][0]
            required_fields = ["id", "line1", "city", "state", "postalCode", "country", "lat", "lng"]
            if all(field in address for field in required_fields):
                print(f"✅ Address list returned with {len(data['addresses'])} addresses")
            else:
                print(f"❌ Address missing required fields: {address}")
                return False
        else:
            print("❌ No addresses found after saving")
            return False
    else:
        print(f"❌ Failed to list addresses: {response.status_code}")
        return False
    
    # 6. Test saving duplicate address
    print("\n6. Testing duplicate address handling...")
    response = requests.post(f"{BASE_URL}/addresses", json=address_data, headers=headers)
    if response.status_code == 409:
        data = response.json()
        print(f"✅ Duplicate address properly rejected (409): {data.get('detail', 'No detail')}")
    else:
        print(f"❌ Duplicate address not handled correctly: {response.status_code}")
        return False
    
    # 7. Test autocomplete endpoints
    print("\n7. Testing autocomplete endpoints...")
    
    # Short query
    response = requests.get(f"{BASE_URL}/places/autocomplete?q=ab")
    if response.status_code == 200:
        data = response.json()
        if "candidates" in data:
            print(f"✅ Short query autocomplete works ({len(data['candidates'])} candidates)")
        else:
            print(f"❌ Invalid autocomplete response: {data}")
            return False
    else:
        print(f"❌ Autocomplete failed: {response.status_code}")
        return False
    
    # Normal query
    response = requests.get(f"{BASE_URL}/places/autocomplete?q=Main Street")
    if response.status_code == 200:
        data = response.json()
        if "candidates" in data and len(data["candidates"]) > 0:
            candidate = data["candidates"][0]
            required_fields = ["placeId", "label", "line1", "city", "state", "postalCode", "country", "lat", "lng"]
            if all(field in candidate for field in required_fields):
                print(f"✅ Normal query autocomplete works ({len(data['candidates'])} candidates)")
            else:
                print(f"❌ Candidate missing required fields: {candidate}")
                return False
        else:
            print("❌ Normal query returns no candidates")
            return False
    else:
        print(f"❌ Autocomplete failed: {response.status_code}")
        return False
    
    # 8. Test ETA preview endpoints
    print("\n8. Testing ETA preview endpoints...")
    
    # ETA with "now" timing
    eta_data = {
        "lat": 37.7749,
        "lng": -122.4194,
        "timing": {"when": "now"}
    }
    
    response = requests.post(f"{BASE_URL}/eta/preview", json=eta_data)
    if response.status_code == 200:
        data = response.json()
        if "window" in data and "distanceKm" in data:
            print(f"✅ ETA preview (now) works: {data['window']}, {data['distanceKm']}km")
        else:
            print(f"❌ Invalid ETA response: {data}")
            return False
    else:
        print(f"❌ ETA preview failed: {response.status_code}")
        return False
    
    # ETA with "schedule" timing
    eta_data = {
        "lat": 40.7128,
        "lng": -74.0060,
        "timing": {
            "when": "schedule",
            "scheduleAt": "2024-01-15T14:30:00Z"
        }
    }
    
    response = requests.post(f"{BASE_URL}/eta/preview", json=eta_data)
    if response.status_code == 200:
        data = response.json()
        if "window" in data and "distanceKm" in data:
            print(f"✅ ETA preview (scheduled) works: {data['window']}, {data['distanceKm']}km")
        else:
            print(f"❌ Invalid ETA response: {data}")
            return False
    else:
        print(f"❌ ETA preview failed: {response.status_code}")
        return False
    
    print("\n" + "=" * 50)
    print("🎉 ALL ADDRESS ENDPOINT TESTS PASSED!")
    return True

if __name__ == "__main__":
    success = test_address_endpoints()
    exit(0 if success else 1)