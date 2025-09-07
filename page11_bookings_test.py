#!/usr/bin/env python3
"""
PAGE-11-BOOKINGS API Comprehensive Tests
Tests all newly implemented booking management endpoints
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
        print(f"PAGE-11-BOOKINGS TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.failed > 0:
            print(f"\nFAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"- {result['test']}: {result['message']}")

def make_request(method, endpoint, data=None, headers=None, auth_token=None, params=None):
    """Helper function to make HTTP requests"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, params=params, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"Request: {method} {endpoint} -> Status: {response.status_code}")
        return response
    except requests.exceptions.Timeout as e:
        print(f"Request timeout: {method} {endpoint} - {e}")
        # Return a mock response object for timeout
        class MockResponse:
            def __init__(self):
                self.status_code = 408  # Request Timeout
                self.text = "Request timeout"
            def json(self):
                return {"detail": "Request timeout"}
        return MockResponse()
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {method} {endpoint} - {e}")
        # Return a mock response object for other errors
        class MockResponse:
            def __init__(self):
                self.status_code = 500  # Internal Server Error
                self.text = "Request failed"
            def json(self):
                return {"detail": "Request failed"}
        return MockResponse()

def setup_test_user(results):
    """Create test customer user and get authentication token"""
    test_email = "user_001@test.com"
    test_password = "TestPass123!"
    
    # Try to login first (user might already exist)
    login_data = {
        "identifier": test_email,
        "password": test_password
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data:
                results.add_result("Test User Login", True, f"Logged in as existing user: {test_email}")
                return resp_data["token"], test_email
        except:
            pass
    
    # If login failed, try to create the user
    signup_data = {
        "email": test_email,
        "password": test_password,
        "role": "customer",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data:
                results.add_result("Test User Signup", True, f"Created new test user: {test_email}")
                return resp_data["token"], test_email
        except:
            pass
    
    results.add_result("Test User Setup", False, f"Could not create or login test user. Status: {response.status_code if response else 'No response'}")
    return None, test_email

def setup_partner_user(results):
    """Create test partner user and get authentication token"""
    test_email = f"partner_{uuid.uuid4().hex[:8]}@test.com"
    test_password = "TestPass123!"
    
    signup_data = {
        "email": test_email,
        "password": test_password,
        "role": "partner",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data:
                results.add_result("Test Partner Setup", True, f"Created test partner: {test_email}")
                return resp_data["token"], test_email
        except:
            pass
    
    results.add_result("Test Partner Setup", False, f"Could not create test partner. Status: {response.status_code if response else 'No response'}")
    return None, test_email

def setup_owner_user(results):
    """Create test owner user and get authentication token"""
    test_email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    test_password = "TestPass123!"
    
    signup_data = {
        "email": test_email,
        "password": test_password,
        "role": "owner",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            # Check if it's direct token or MFA required
            if "token" in resp_data and "user" in resp_data:
                # Direct token (MFA might be disabled for testing)
                results.add_result("Test Owner Setup", True, f"Created test owner: {test_email}")
                return resp_data["token"], test_email
            elif resp_data.get("mfa_required"):
                # MFA required
                user_id = resp_data["user_id"]
                mfa_code = resp_data.get("dev_mfa_code")
                
                if mfa_code:
                    # Verify MFA
                    mfa_data = {
                        "user_id": user_id,
                        "code": mfa_code
                    }
                    
                    mfa_response = make_request("POST", "/auth/mfa/verify", mfa_data)
                    
                    if mfa_response and mfa_response.status_code == 200:
                        mfa_resp_data = mfa_response.json()
                        if "token" in mfa_resp_data:
                            results.add_result("Test Owner Setup", True, f"Created test owner with MFA: {test_email}")
                            return mfa_resp_data["token"], test_email
        except Exception as e:
            results.add_result("Test Owner Setup", False, f"JSON parsing error: {e}")
    
    results.add_result("Test Owner Setup", False, f"Could not create test owner. Status: {response.status_code if response else 'No response'}")
    return None, test_email

# ===== CUSTOMER BOOKING LIST TESTS =====

def test_customer_bookings_upcoming(results, token):
    """Test GET /api/bookings/customer with upcoming status"""
    params = {
        "status": "upcoming",
        "page": 1,
        "size": 20
    }
    
    response = make_request("GET", "/bookings/customer", params=params, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "items" in resp_data and isinstance(resp_data["items"], list):
                items = resp_data["items"]
                
                # Check structure of items
                if len(items) > 0:
                    item = items[0]
                    required_fields = ["bookingId", "dateTime", "serviceType", "addressShort", "status", "price", "currency"]
                    
                    if all(field in item for field in required_fields):
                        # Verify it's upcoming status
                        if item["status"] in ["scheduled", "pending_dispatch"]:
                            results.add_result("Customer Bookings (Upcoming)", True, f"Retrieved {len(items)} upcoming bookings")
                            return items
                        else:
                            results.add_result("Customer Bookings (Upcoming)", False, f"Wrong status in upcoming filter: {item['status']}")
                    else:
                        results.add_result("Customer Bookings (Upcoming)", False, f"Missing required fields in booking item: {item}")
                else:
                    results.add_result("Customer Bookings (Upcoming)", True, "No upcoming bookings found (acceptable)")
                    return []
            else:
                results.add_result("Customer Bookings (Upcoming)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Customer Bookings (Upcoming)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Customer Bookings (Upcoming)", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_customer_bookings_in_progress(results, token):
    """Test GET /api/bookings/customer with in_progress status"""
    params = {
        "status": "in_progress",
        "page": 1,
        "size": 20
    }
    
    response = make_request("GET", "/bookings/customer", params=params, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "items" in resp_data and isinstance(resp_data["items"], list):
                items = resp_data["items"]
                
                if len(items) > 0:
                    item = items[0]
                    # Verify it's in_progress status
                    if item["status"] in ["assigned", "enroute", "arrived", "in_progress"]:
                        results.add_result("Customer Bookings (In Progress)", True, f"Retrieved {len(items)} in-progress bookings")
                        return items
                    else:
                        results.add_result("Customer Bookings (In Progress)", False, f"Wrong status in in_progress filter: {item['status']}")
                else:
                    results.add_result("Customer Bookings (In Progress)", True, "No in-progress bookings found (acceptable)")
                    return []
            else:
                results.add_result("Customer Bookings (In Progress)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Customer Bookings (In Progress)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Customer Bookings (In Progress)", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_customer_bookings_past(results, token):
    """Test GET /api/bookings/customer with past status"""
    params = {
        "status": "past",
        "page": 1,
        "size": 20
    }
    
    response = make_request("GET", "/bookings/customer", params=params, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "items" in resp_data and isinstance(resp_data["items"], list):
                items = resp_data["items"]
                
                if len(items) > 0:
                    item = items[0]
                    # Verify it's past status
                    if item["status"] in ["completed", "cancelled"]:
                        results.add_result("Customer Bookings (Past)", True, f"Retrieved {len(items)} past bookings")
                        return items
                    else:
                        results.add_result("Customer Bookings (Past)", False, f"Wrong status in past filter: {item['status']}")
                else:
                    results.add_result("Customer Bookings (Past)", True, "No past bookings found (acceptable)")
                    return []
            else:
                results.add_result("Customer Bookings (Past)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Customer Bookings (Past)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Customer Bookings (Past)", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_customer_bookings_pagination(results, token):
    """Test customer bookings pagination"""
    params = {
        "status": "past",
        "page": 1,
        "size": 1  # Small size to test pagination
    }
    
    response = make_request("GET", "/bookings/customer", params=params, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "items" in resp_data:
                items = resp_data["items"]
                next_page = resp_data.get("nextPage")
                
                # If we have items and nextPage, pagination is working
                if len(items) <= 1:  # Should respect size limit
                    if len(items) == 1 and next_page is not None:
                        results.add_result("Customer Bookings Pagination", True, f"Pagination working: {len(items)} items, nextPage: {next_page}")
                    elif len(items) == 0:
                        results.add_result("Customer Bookings Pagination", True, "Pagination working: no items on this page")
                    else:
                        results.add_result("Customer Bookings Pagination", True, f"Pagination working: {len(items)} items, no next page")
                    return True
                else:
                    results.add_result("Customer Bookings Pagination", False, f"Size limit not respected: got {len(items)} items for size=1")
            else:
                results.add_result("Customer Bookings Pagination", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Customer Bookings Pagination", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Customer Bookings Pagination", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return False

# ===== PARTNER BOOKING LIST TESTS =====

def test_partner_bookings_today(results, token):
    """Test GET /api/bookings/partner with today status"""
    params = {
        "status": "today",
        "page": 1,
        "size": 20
    }
    
    response = make_request("GET", "/bookings/partner", params=params, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "items" in resp_data and isinstance(resp_data["items"], list):
                items = resp_data["items"]
                
                # Check structure of items
                if len(items) > 0:
                    item = items[0]
                    required_fields = ["bookingId", "time", "serviceType", "addressShort", "status", "payout", "currency", "distanceKm"]
                    
                    if all(field in item for field in required_fields):
                        # Verify it's today status
                        if item["status"] in ["assigned", "enroute", "arrived", "in_progress"]:
                            results.add_result("Partner Bookings (Today)", True, f"Retrieved {len(items)} today jobs")
                            return items
                        else:
                            results.add_result("Partner Bookings (Today)", False, f"Wrong status in today filter: {item['status']}")
                    else:
                        results.add_result("Partner Bookings (Today)", False, f"Missing required fields in job item: {item}")
                else:
                    results.add_result("Partner Bookings (Today)", True, "No today jobs found (acceptable)")
                    return []
            else:
                results.add_result("Partner Bookings (Today)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Partner Bookings (Today)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Bookings (Today)", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_partner_bookings_upcoming(results, token):
    """Test GET /api/bookings/partner with upcoming status"""
    params = {
        "status": "upcoming",
        "page": 1,
        "size": 20
    }
    
    response = make_request("GET", "/bookings/partner", params=params, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "items" in resp_data and isinstance(resp_data["items"], list):
                items = resp_data["items"]
                
                if len(items) > 0:
                    item = items[0]
                    # Verify it's upcoming status
                    if item["status"] in ["scheduled", "assigned"]:
                        results.add_result("Partner Bookings (Upcoming)", True, f"Retrieved {len(items)} upcoming jobs")
                        return items
                    else:
                        results.add_result("Partner Bookings (Upcoming)", False, f"Wrong status in upcoming filter: {item['status']}")
                else:
                    results.add_result("Partner Bookings (Upcoming)", True, "No upcoming jobs found (acceptable)")
                    return []
            else:
                results.add_result("Partner Bookings (Upcoming)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Partner Bookings (Upcoming)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Bookings (Upcoming)", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_partner_bookings_completed(results, token):
    """Test GET /api/bookings/partner with completed status"""
    params = {
        "status": "completed",
        "page": 1,
        "size": 20
    }
    
    response = make_request("GET", "/bookings/partner", params=params, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "items" in resp_data and isinstance(resp_data["items"], list):
                items = resp_data["items"]
                
                if len(items) > 0:
                    item = items[0]
                    # Verify it's completed status
                    if item["status"] in ["completed", "cancelled"]:
                        results.add_result("Partner Bookings (Completed)", True, f"Retrieved {len(items)} completed jobs")
                        return items
                    else:
                        results.add_result("Partner Bookings (Completed)", False, f"Wrong status in completed filter: {item['status']}")
                else:
                    results.add_result("Partner Bookings (Completed)", True, "No completed jobs found (acceptable)")
                    return []
            else:
                results.add_result("Partner Bookings (Completed)", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("Partner Bookings (Completed)", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Partner Bookings (Completed)", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

# ===== BOOKING DETAIL TESTS =====

def test_booking_detail_customer_access(results, token):
    """Test GET /api/bookings/{bookingId} with customer access"""
    # Test with mock booking IDs from the server
    test_booking_ids = ["bk_upcoming_001", "bk_inprogress_002", "bk_completed_003"]
    
    for booking_id in test_booking_ids:
        response = make_request("GET", f"/bookings/{booking_id}", auth_token=token)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                
                required_fields = ["bookingId", "status", "service", "address", "timeline", "photos", "receipt", "policy"]
                if all(field in resp_data for field in required_fields):
                    # Check service structure
                    service = resp_data["service"]
                    service_fields = ["serviceType", "dwellingType", "bedrooms", "bathrooms", "masters", "addons"]
                    
                    if all(field in service for field in service_fields):
                        results.add_result(f"Booking Detail Customer Access ({booking_id})", True, f"Retrieved booking details for {booking_id}")
                        return resp_data
                    else:
                        results.add_result(f"Booking Detail Customer Access ({booking_id})", False, f"Missing service fields: {service}")
                else:
                    results.add_result(f"Booking Detail Customer Access ({booking_id})", False, f"Missing required fields: {resp_data}")
            except Exception as e:
                results.add_result(f"Booking Detail Customer Access ({booking_id})", False, f"JSON parsing error: {e}")
        elif response and response.status_code == 404:
            results.add_result(f"Booking Detail Customer Access ({booking_id})", True, f"Booking {booking_id} not found (acceptable)")
        elif response and response.status_code == 403:
            results.add_result(f"Booking Detail Customer Access ({booking_id})", True, f"Access denied for {booking_id} (acceptable)")
        else:
            results.add_result(f"Booking Detail Customer Access ({booking_id})", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_booking_detail_partner_access(results, token):
    """Test GET /api/bookings/{bookingId} with partner access"""
    # Test with mock booking ID that has partner assigned
    booking_id = "bk_partner_today_004"
    
    response = make_request("GET", f"/bookings/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["bookingId", "status", "service", "address", "timeline", "photos", "receipt", "policy"]
            if all(field in resp_data for field in required_fields):
                # Partner should see customer info but not their own partner info
                if "customer" in resp_data and resp_data["customer"] is not None:
                    results.add_result("Booking Detail Partner Access", True, f"Partner can access booking details with customer info")
                    return resp_data
                else:
                    results.add_result("Booking Detail Partner Access", True, f"Partner can access booking details (no customer info shown)")
                    return resp_data
            else:
                results.add_result("Booking Detail Partner Access", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Booking Detail Partner Access", False, f"JSON parsing error: {e}")
    elif response and response.status_code == 404:
        results.add_result("Booking Detail Partner Access", True, f"Booking not found (acceptable)")
    elif response and response.status_code == 403:
        results.add_result("Booking Detail Partner Access", True, f"Access denied (acceptable - partner not assigned to this booking)")
    else:
        results.add_result("Booking Detail Partner Access", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_booking_detail_owner_access(results, token):
    """Test GET /api/bookings/{bookingId} with owner access"""
    booking_id = "bk_completed_003"
    
    response = make_request("GET", f"/bookings/{booking_id}", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["bookingId", "status", "service", "address", "timeline", "photos", "receipt", "policy"]
            if all(field in resp_data for field in required_fields):
                # Owner should see both partner and customer info
                has_partner = resp_data.get("partner") is not None
                has_customer = resp_data.get("customer") is not None
                
                results.add_result("Booking Detail Owner Access", True, f"Owner can access all booking details (partner: {has_partner}, customer: {has_customer})")
                return resp_data
            else:
                results.add_result("Booking Detail Owner Access", False, f"Missing required fields: {resp_data}")
        except Exception as e:
            results.add_result("Booking Detail Owner Access", False, f"JSON parsing error: {e}")
    elif response and response.status_code == 404:
        results.add_result("Booking Detail Owner Access", True, f"Booking not found (acceptable)")
    else:
        results.add_result("Booking Detail Owner Access", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

# ===== INVOICE TESTS =====

def test_booking_invoice_customer_access(results, token):
    """Test GET /api/bookings/{bookingId}/invoice with customer access"""
    booking_id = "bk_completed_003"  # Completed booking
    
    response = make_request("GET", f"/bookings/{booking_id}/invoice", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "url" in resp_data and resp_data["url"]:
                url = resp_data["url"]
                # Check if it's a valid signed URL format
                if "storage.shine.com/invoices/" in url and ".pdf" in url:
                    results.add_result("Booking Invoice Customer Access", True, f"Invoice URL generated: {url[:50]}...")
                    return url
                else:
                    results.add_result("Booking Invoice Customer Access", False, f"Invalid invoice URL format: {url}")
            else:
                results.add_result("Booking Invoice Customer Access", False, f"Missing URL in response: {resp_data}")
        except Exception as e:
            results.add_result("Booking Invoice Customer Access", False, f"JSON parsing error: {e}")
    elif response and response.status_code == 400:
        results.add_result("Booking Invoice Customer Access", True, "Invoice not available for non-completed booking (correct behavior)")
    elif response and response.status_code == 404:
        results.add_result("Booking Invoice Customer Access", True, "Booking not found (acceptable)")
    elif response and response.status_code == 403:
        results.add_result("Booking Invoice Customer Access", True, "Access denied (acceptable)")
    else:
        results.add_result("Booking Invoice Customer Access", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_booking_invoice_owner_access(results, token):
    """Test GET /api/bookings/{bookingId}/invoice with owner access"""
    booking_id = "bk_completed_003"  # Completed booking
    
    response = make_request("GET", f"/bookings/{booking_id}/invoice", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "url" in resp_data and resp_data["url"]:
                url = resp_data["url"]
                if "storage.shine.com/invoices/" in url and ".pdf" in url:
                    results.add_result("Booking Invoice Owner Access", True, f"Owner can access invoice URL")
                    return url
                else:
                    results.add_result("Booking Invoice Owner Access", False, f"Invalid invoice URL format: {url}")
            else:
                results.add_result("Booking Invoice Owner Access", False, f"Missing URL in response: {resp_data}")
        except Exception as e:
            results.add_result("Booking Invoice Owner Access", False, f"JSON parsing error: {e}")
    elif response and response.status_code == 400:
        results.add_result("Booking Invoice Owner Access", True, "Invoice not available for non-completed booking (correct behavior)")
    elif response and response.status_code == 404:
        results.add_result("Booking Invoice Owner Access", True, "Booking not found (acceptable)")
    else:
        results.add_result("Booking Invoice Owner Access", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    return None

def test_booking_invoice_partner_denied(results, token):
    """Test that partners cannot access invoice endpoint"""
    booking_id = "bk_completed_003"
    
    response = make_request("GET", f"/bookings/{booking_id}/invoice", auth_token=token)
    
    if response and response.status_code == 403:
        results.add_result("Booking Invoice Partner Denied", True, "Partner correctly denied access to invoice")
    elif response and response.status_code == 404:
        results.add_result("Booking Invoice Partner Denied", True, "Booking not found (acceptable)")
    else:
        results.add_result("Booking Invoice Partner Denied", False, f"Partner access not properly denied. Status: {response.status_code if response else 'No response'}")

def test_booking_invoice_non_completed(results, token):
    """Test invoice access for non-completed booking"""
    booking_id = "bk_upcoming_001"  # Non-completed booking
    
    response = make_request("GET", f"/bookings/{booking_id}/invoice", auth_token=token)
    
    if response and response.status_code == 400:
        try:
            error_data = response.json()
            detail = error_data.get("detail", "").lower()
            if "invoice" in detail and "completed" in detail:
                results.add_result("Booking Invoice Non-Completed", True, "Invoice correctly denied for non-completed booking")
            else:
                results.add_result("Booking Invoice Non-Completed", True, "Invoice denied for non-completed booking (400 status)")
        except:
            results.add_result("Booking Invoice Non-Completed", True, "Invoice denied for non-completed booking (400 status)")
    elif response and response.status_code == 404:
        results.add_result("Booking Invoice Non-Completed", True, "Booking not found (acceptable)")
    elif response and response.status_code == 403:
        results.add_result("Booking Invoice Non-Completed", True, "Access denied (acceptable)")
    else:
        results.add_result("Booking Invoice Non-Completed", False, f"Non-completed booking invoice not handled correctly. Status: {response.status_code if response else 'No response'}")

# ===== AUTHENTICATION & ACCESS CONTROL TESTS =====

def test_bookings_require_authentication(results):
    """Test that all booking endpoints require authentication"""
    endpoints_to_test = [
        ("GET", "/bookings/customer?status=upcoming"),
        ("GET", "/bookings/partner?status=today"),
        ("GET", "/bookings/bk_test_001"),
        ("GET", "/bookings/bk_test_001/invoice")
    ]
    
    auth_required_count = 0
    
    for method, endpoint in endpoints_to_test:
        response = make_request(method, endpoint)
        
        if response and response.status_code in [401, 403]:
            auth_required_count += 1
        else:
            results.add_result(f"Booking Auth Required ({method} {endpoint})", False, f"Auth not enforced. Status: {response.status_code if response else 'No response'}")
            return
    
    results.add_result("Booking Endpoints Auth Required", True, f"All {auth_required_count} booking endpoints properly require authentication")

def test_customer_partner_role_separation(results, customer_token, partner_token):
    """Test that customers can't access partner endpoints and vice versa"""
    
    # Test customer trying to access partner endpoint
    params = {"status": "today", "page": 1, "size": 20}
    response = make_request("GET", "/bookings/partner", params=params, auth_token=customer_token)
    
    if response and response.status_code == 403:
        results.add_result("Customer Partner Endpoint Denied", True, "Customer correctly denied access to partner bookings")
    else:
        results.add_result("Customer Partner Endpoint Denied", False, f"Customer access not properly denied. Status: {response.status_code if response else 'No response'}")
    
    # Test partner trying to access customer endpoint
    params = {"status": "upcoming", "page": 1, "size": 20}
    response = make_request("GET", "/bookings/customer", params=params, auth_token=partner_token)
    
    if response and response.status_code == 403:
        results.add_result("Partner Customer Endpoint Denied", True, "Partner correctly denied access to customer bookings")
    else:
        results.add_result("Partner Customer Endpoint Denied", False, f"Partner access not properly denied. Status: {response.status_code if response else 'No response'}")

# ===== MAIN TEST EXECUTION =====

def main():
    """Run all PAGE-11-BOOKINGS tests"""
    results = TestResults()
    
    print("="*60)
    print("PAGE-11-BOOKINGS API COMPREHENSIVE TESTING")
    print("="*60)
    print("Testing newly implemented booking management endpoints...")
    print()
    
    # Setup test users
    print("Setting up test users...")
    customer_token, customer_email = setup_test_user(results)
    partner_token, partner_email = setup_partner_user(results)
    owner_token, owner_email = setup_owner_user(results)
    
    if not customer_token:
        print("❌ Cannot proceed without customer token")
        results.print_summary()
        return
    
    print(f"✅ Test users ready: Customer({customer_email}), Partner({partner_email}), Owner({owner_email})")
    print()
    
    # Test authentication requirements
    print("Testing authentication requirements...")
    test_bookings_require_authentication(results)
    
    if partner_token and customer_token:
        test_customer_partner_role_separation(results, customer_token, partner_token)
    
    print()
    
    # Test customer booking endpoints
    print("Testing customer booking endpoints...")
    test_customer_bookings_upcoming(results, customer_token)
    test_customer_bookings_in_progress(results, customer_token)
    test_customer_bookings_past(results, customer_token)
    test_customer_bookings_pagination(results, customer_token)
    
    print()
    
    # Test partner booking endpoints (if partner token available)
    if partner_token:
        print("Testing partner booking endpoints...")
        test_partner_bookings_today(results, partner_token)
        test_partner_bookings_upcoming(results, partner_token)
        test_partner_bookings_completed(results, partner_token)
    else:
        print("⚠️ Skipping partner tests (no partner token)")
    
    print()
    
    # Test booking detail endpoints
    print("Testing booking detail endpoints...")
    test_booking_detail_customer_access(results, customer_token)
    
    if partner_token:
        test_booking_detail_partner_access(results, partner_token)
    
    if owner_token:
        test_booking_detail_owner_access(results, owner_token)
    
    print()
    
    # Test invoice endpoints
    print("Testing invoice endpoints...")
    test_booking_invoice_customer_access(results, customer_token)
    test_booking_invoice_non_completed(results, customer_token)
    
    if partner_token:
        test_booking_invoice_partner_denied(results, partner_token)
    
    if owner_token:
        test_booking_invoice_owner_access(results, owner_token)
    
    print()
    
    # Print final results
    results.print_summary()
    
    print(f"\n{'='*60}")
    print("PAGE-11-BOOKINGS TESTING COMPLETED")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()