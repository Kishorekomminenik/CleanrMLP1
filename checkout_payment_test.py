#!/usr/bin/env python3
"""
SHINE Checkout & Payment API Comprehensive Tests
Tests all new checkout and payment endpoints for PAGE-5-CHECKOUT
"""

import requests
import json
import time
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://home-dashboard-2.preview.emergentagent.com/api"
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
        print(f"CHECKOUT & PAYMENT API TEST SUMMARY")
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
            response = requests.get(url, headers=request_headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=10)
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

def setup_test_user():
    """Create a test user and return auth token"""
    test_email = f"checkout_test_{uuid.uuid4().hex[:8]}@example.com"
    test_username = f"checkout_{uuid.uuid4().hex[:8]}"
    
    # Create user
    signup_data = {
        "email": test_email,
        "username": test_username,
        "password": "SecurePass123!",
        "role": "customer",
        "phone": "+14155552671",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            return resp_data["token"], test_email
        except:
            pass
    
    return None, None

def test_list_payment_methods(results, token):
    """Test GET /api/billing/methods - List saved payment methods"""
    response = make_request("GET", "/billing/methods", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "methods" in resp_data and isinstance(resp_data["methods"], list):
                methods = resp_data["methods"]
                if len(methods) > 0:
                    # Check first method structure
                    method = methods[0]
                    required_fields = ["id", "brand", "last4", "exp", "isDefault"]
                    
                    if all(field in method for field in required_fields):
                        results.add_result("List Payment Methods", True, f"Retrieved {len(methods)} payment methods with correct structure")
                        return methods
                    else:
                        results.add_result("List Payment Methods", False, f"Payment method missing required fields: {method}")
                else:
                    results.add_result("List Payment Methods", True, "Empty payment methods list returned (expected for new user)")
                    return []
            else:
                results.add_result("List Payment Methods", False, f"Invalid response structure: {resp_data}")
        except Exception as e:
            results.add_result("List Payment Methods", False, f"JSON parsing error: {e}")
    else:
        results.add_result("List Payment Methods", False, f"Failed with status: {response.status_code if response else 'No response'}")
    
    return None

def test_create_setup_intent(results, token):
    """Test POST /api/billing/setup-intent - Create Stripe setup intent"""
    response = make_request("POST", "/billing/setup-intent", auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if "clientSecret" in resp_data and resp_data["clientSecret"]:
                client_secret = resp_data["clientSecret"]
                if "seti_" in client_secret and "_secret_" in client_secret:
                    results.add_result("Create Setup Intent", True, f"Setup intent created successfully")
                    return client_secret
                else:
                    results.add_result("Create Setup Intent", False, f"Invalid client secret format: {client_secret}")
            else:
                results.add_result("Create Setup Intent", False, f"Missing clientSecret in response: {resp_data}")
        except Exception as e:
            results.add_result("Create Setup Intent", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Create Setup Intent", False, f"Failed with status: {response.status_code if response else 'No response'}")
    
    return None

def test_attach_payment_method(results, token):
    """Test POST /api/billing/methods - Attach payment method to customer"""
    data = {
        "paymentMethodId": "pm_test_card_visa"
    }
    
    response = make_request("POST", "/billing/methods", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                results.add_result("Attach Payment Method", True, "Payment method attached successfully")
                return True
            else:
                results.add_result("Attach Payment Method", False, f"Attachment failed: {resp_data}")
        except Exception as e:
            results.add_result("Attach Payment Method", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Attach Payment Method", False, f"Failed with status: {response.status_code if response else 'No response'}")
    
    return False

def test_apply_valid_promo_codes(results, token):
    """Test POST /api/pricing/promo/apply - Apply valid promo codes"""
    valid_promos = [
        ("SHINE20", 20.0),
        ("FIRST10", 10.0), 
        ("SAVE15", 15.0)
    ]
    
    for promo_code, expected_discount in valid_promos:
        data = {
            "quoteId": "quote_test123",
            "code": promo_code,
            "useCredits": False
        }
        
        response = make_request("POST", "/pricing/promo/apply", data, auth_token=token)
        
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                
                required_fields = ["breakdown", "total", "promoApplied", "creditsApplied"]
                if all(field in resp_data for field in required_fields):
                    if resp_data["promoApplied"] is True:
                        breakdown = resp_data["breakdown"]
                        total = resp_data["total"]
                        
                        # Check if promo discount is in breakdown
                        promo_found = any(promo_code in item.get("label", "") for item in breakdown)
                        
                        if promo_found and isinstance(total, (int, float)):
                            results.add_result(f"Apply Promo Code ({promo_code})", True, f"Applied successfully, total: ${total}")
                        else:
                            results.add_result(f"Apply Promo Code ({promo_code})", False, f"Promo not found in breakdown or invalid total")
                            return False
                    else:
                        results.add_result(f"Apply Promo Code ({promo_code})", False, f"Promo not applied: {resp_data}")
                        return False
                else:
                    results.add_result(f"Apply Promo Code ({promo_code})", False, f"Missing required fields: {resp_data}")
                    return False
            except Exception as e:
                results.add_result(f"Apply Promo Code ({promo_code})", False, f"JSON parsing error: {e}")
                return False
        else:
            results.add_result(f"Apply Promo Code ({promo_code})", False, f"Failed with status: {response.status_code if response else 'No response'}")
            return False
    
    results.add_result("All Valid Promo Codes", True, f"All {len(valid_promos)} valid promo codes applied successfully")
    return True

def test_apply_invalid_promo_code(results, token):
    """Test POST /api/pricing/promo/apply - Apply invalid promo code"""
    data = {
        "quoteId": "quote_test123",
        "code": "INVALID_CODE",
        "useCredits": False
    }
    
    response = make_request("POST", "/pricing/promo/apply", data, auth_token=token)
    
    if response and response.status_code == 400:
        try:
            error_data = response.json()
            detail = error_data.get("detail", "").lower()
            if "invalid" in detail and "promo" in detail:
                results.add_result("Apply Invalid Promo Code", True, "Invalid promo code properly rejected with 400")
                return True
        except:
            pass
        # Even if JSON parsing fails, 400 status is correct
        results.add_result("Apply Invalid Promo Code", True, "Invalid promo code properly rejected (400 status)")
        return True
    
    results.add_result("Apply Invalid Promo Code", False, f"Invalid promo code not handled correctly. Status: {response.status_code if response else 'No response'}")
    return False

def test_apply_promo_with_credits(results, token):
    """Test POST /api/pricing/promo/apply - Apply promo code with credits"""
    data = {
        "quoteId": "quote_test123",
        "code": "SHINE20",
        "useCredits": True
    }
    
    response = make_request("POST", "/pricing/promo/apply", data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if (resp_data.get("promoApplied") is True and 
                resp_data.get("creditsApplied", 0) > 0):
                
                breakdown = resp_data["breakdown"]
                credits_found = any("credits" in item.get("label", "").lower() for item in breakdown)
                
                if credits_found:
                    results.add_result("Apply Promo with Credits", True, f"Promo and credits applied: ${resp_data['creditsApplied']} credits")
                    return True
                else:
                    results.add_result("Apply Promo with Credits", False, "Credits not found in breakdown")
            else:
                results.add_result("Apply Promo with Credits", False, f"Promo or credits not applied: {resp_data}")
        except Exception as e:
            results.add_result("Apply Promo with Credits", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Apply Promo with Credits", False, f"Failed with status: {response.status_code if response else 'No response'}")
    
    return False

def test_payment_preauth_scenarios(results, token):
    """Test POST /api/billing/preauth - Payment pre-authorization scenarios"""
    
    # Test 1: Successful payment
    success_data = {
        "amount": 89.50,
        "currency": "usd",
        "paymentMethodId": "pm_card_visa",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", success_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["paymentIntentId", "clientSecret", "requiresAction"]
            if all(field in resp_data for field in required_fields):
                pi_id = resp_data["paymentIntentId"]
                client_secret = resp_data["clientSecret"]
                requires_action = resp_data["requiresAction"]
                
                if ("pi_" in pi_id and "_secret_" in client_secret and 
                    isinstance(requires_action, bool)):
                    
                    results.add_result("Payment Preauth Success", True, f"Payment intent created: {pi_id}")
                    success_pi_id = pi_id
                else:
                    results.add_result("Payment Preauth Success", False, f"Invalid payment intent data: {resp_data}")
                    success_pi_id = None
            else:
                results.add_result("Payment Preauth Success", False, f"Missing required fields: {resp_data}")
                success_pi_id = None
        except Exception as e:
            results.add_result("Payment Preauth Success", False, f"JSON parsing error: {e}")
            success_pi_id = None
    else:
        results.add_result("Payment Preauth Success", False, f"Failed with status: {response.status_code if response else 'No response'}")
        success_pi_id = None
    
    # Test 2: Declined payment
    declined_data = {
        "amount": 89.50,
        "currency": "usd",
        "paymentMethodId": "pm_declined",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", declined_data, auth_token=token)
    
    if response and response.status_code == 402:
        try:
            error_data = response.json()
            detail = error_data.get("detail", "").lower()
            if "declined" in detail or "card" in detail:
                results.add_result("Payment Preauth Declined", True, "Declined payment properly handled with 402")
            else:
                results.add_result("Payment Preauth Declined", True, "Declined payment properly handled (402 status)")
        except:
            results.add_result("Payment Preauth Declined", True, "Declined payment properly handled (402 status)")
    else:
        results.add_result("Payment Preauth Declined", False, f"Declined payment not handled correctly. Status: {response.status_code if response else 'No response'}")
    
    # Test 3: SCA Required payment
    sca_data = {
        "amount": 89.50,
        "currency": "usd",
        "paymentMethodId": "pm_sca_required",
        "captureStrategy": "dual"
    }
    
    response = make_request("POST", "/billing/preauth", sca_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if (resp_data.get("requiresAction") is True and 
                "paymentIntentId" in resp_data and 
                "clientSecret" in resp_data):
                
                results.add_result("Payment Preauth SCA Required", True, f"SCA required payment intent created: {resp_data['paymentIntentId']}")
                sca_pi_id = resp_data["paymentIntentId"]
            else:
                results.add_result("Payment Preauth SCA Required", False, f"SCA not required or invalid response: {resp_data}")
                sca_pi_id = None
        except Exception as e:
            results.add_result("Payment Preauth SCA Required", False, f"JSON parsing error: {e}")
            sca_pi_id = None
    else:
        results.add_result("Payment Preauth SCA Required", False, f"Failed with status: {response.status_code if response else 'No response'}")
        sca_pi_id = None
    
    return success_pi_id, sca_pi_id

def test_confirm_stripe_action(results, payment_intent_id):
    """Test POST /api/billing/confirm - Confirm Stripe action (SCA)"""
    if not payment_intent_id:
        results.add_result("Confirm Stripe Action", False, "No payment intent ID provided")
        return False
    
    data = {
        "paymentIntentId": payment_intent_id
    }
    
    response = make_request("POST", "/billing/confirm", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                results.add_result("Confirm Stripe Action", True, f"Stripe action confirmed for: {payment_intent_id}")
                return True
            else:
                results.add_result("Confirm Stripe Action", False, f"Confirmation failed: {resp_data}")
        except Exception as e:
            results.add_result("Confirm Stripe Action", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Confirm Stripe Action", False, f"Failed with status: {response.status_code if response else 'No response'}")
    
    return False

def test_create_bookings(results, token):
    """Test POST /api/bookings - Create booking scenarios"""
    
    # Test 1: Booking with 'now' timing
    now_booking_data = {
        "quoteId": "quote_test123",
        "service": {
            "type": "basic",
            "timing": {
                "when": "now"
            },
            "details": {
                "bedrooms": 2,
                "bathrooms": 1
            }
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
            "paymentIntentId": "pi_test123",
            "paymentMethodId": "pm_card_visa"
        },
        "applyCredits": False,
        "promoCode": None
    }
    
    response = make_request("POST", "/bookings", now_booking_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["bookingId", "status", "next"]
            if all(field in resp_data for field in required_fields):
                booking_id = resp_data["bookingId"]
                status = resp_data["status"]
                next_step = resp_data["next"]
                eta_window = resp_data.get("etaWindow")
                
                if ("bk_" in booking_id and status in ["pending_dispatch", "scheduled"] and 
                    next_step in ["dispatch", "tracking"]):
                    
                    results.add_result("Create Booking (Now)", True, f"Booking created: {booking_id}, status: {status}, ETA: {eta_window}")
                    now_booking_id = booking_id
                else:
                    results.add_result("Create Booking (Now)", False, f"Invalid booking data: {resp_data}")
                    now_booking_id = None
            else:
                results.add_result("Create Booking (Now)", False, f"Missing required fields: {resp_data}")
                now_booking_id = None
        except Exception as e:
            results.add_result("Create Booking (Now)", False, f"JSON parsing error: {e}")
            now_booking_id = None
    else:
        results.add_result("Create Booking (Now)", False, f"Failed with status: {response.status_code if response else 'No response'}")
        now_booking_id = None
    
    # Test 2: Booking with 'schedule' timing
    scheduled_booking_data = {
        "quoteId": "quote_test456",
        "service": {
            "type": "deep",
            "timing": {
                "when": "schedule",
                "scheduleAt": "2024-01-15T14:30:00Z"
            },
            "details": {
                "bedrooms": 3,
                "bathrooms": 2
            }
        },
        "address": {
            "line1": "456 Oak Avenue",
            "city": "New York",
            "state": "NY",
            "postalCode": "10001",
            "lat": 40.7128,
            "lng": -74.0060
        },
        "access": {
            "entrance": "side_door",
            "notes": "Key under mat"
        },
        "totals": {
            "subtotal": 150.00,
            "tax": 13.31,
            "total": 163.31
        },
        "payment": {
            "paymentIntentId": "pi_test456",
            "paymentMethodId": "pm_card_mastercard"
        },
        "applyCredits": True,
        "promoCode": "SHINE20"
    }
    
    response = make_request("POST", "/bookings", scheduled_booking_data, auth_token=token)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            required_fields = ["bookingId", "status", "next"]
            if all(field in resp_data for field in required_fields):
                booking_id = resp_data["bookingId"]
                status = resp_data["status"]
                next_step = resp_data["next"]
                
                if ("bk_" in booking_id and status == "scheduled" and next_step == "tracking"):
                    results.add_result("Create Booking (Scheduled)", True, f"Scheduled booking created: {booking_id}")
                    scheduled_booking_id = booking_id
                else:
                    results.add_result("Create Booking (Scheduled)", False, f"Invalid scheduled booking data: {resp_data}")
                    scheduled_booking_id = None
            else:
                results.add_result("Create Booking (Scheduled)", False, f"Missing required fields: {resp_data}")
                scheduled_booking_id = None
        except Exception as e:
            results.add_result("Create Booking (Scheduled)", False, f"JSON parsing error: {e}")
            scheduled_booking_id = None
    else:
        results.add_result("Create Booking (Scheduled)", False, f"Failed with status: {response.status_code if response else 'No response'}")
        scheduled_booking_id = None
    
    return now_booking_id, scheduled_booking_id

def test_void_preauth(results, payment_intent_id):
    """Test POST /api/billing/void - Void payment pre-authorization"""
    if not payment_intent_id:
        results.add_result("Void Preauth", False, "No payment intent ID provided")
        return False
    
    data = {
        "paymentIntentId": payment_intent_id
    }
    
    response = make_request("POST", "/billing/void", data)
    
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            
            if resp_data.get("ok") is True:
                results.add_result("Void Preauth", True, f"Payment preauth voided: {payment_intent_id}")
                return True
            else:
                results.add_result("Void Preauth", False, f"Void failed: {resp_data}")
        except Exception as e:
            results.add_result("Void Preauth", False, f"JSON parsing error: {e}")
    else:
        results.add_result("Void Preauth", False, f"Failed with status: {response.status_code if response else 'No response'}")
    
    return False

def test_authentication_requirements(results):
    """Test that all checkout endpoints require authentication"""
    endpoints_to_test = [
        ("GET", "/billing/methods"),
        ("POST", "/billing/setup-intent"),
        ("POST", "/billing/methods", {"paymentMethodId": "pm_test"}),
        ("POST", "/pricing/promo/apply", {"quoteId": "test", "code": "TEST"}),
        ("POST", "/billing/preauth", {"amount": 100, "paymentMethodId": "pm_test"}),
        ("POST", "/bookings", {"quoteId": "test", "service": {}, "address": {}, "totals": {}, "payment": {}})
    ]
    
    auth_required_count = 0
    
    for method, endpoint, *data in endpoints_to_test:
        request_data = data[0] if data else None
        response = make_request(method, endpoint, request_data)
        
        if response and response.status_code in [401, 403]:
            auth_required_count += 1
        else:
            results.add_result(f"Auth Required ({method} {endpoint})", False, f"Auth not enforced. Status: {response.status_code if response else 'No response'}")
            return False
    
    results.add_result("All Checkout Endpoints Auth Required", True, f"All {auth_required_count} checkout endpoints properly require authentication")
    return True

def main():
    """Run comprehensive checkout & payment API tests"""
    print("🚀 Starting SHINE Checkout & Payment API Comprehensive Tests")
    print(f"Testing API at: {BASE_URL}")
    print("="*60)
    
    results = TestResults()
    
    # Setup test user
    print("\n🔧 Setting up test user...")
    token, email = setup_test_user()
    
    if not token:
        print("❌ Failed to create test user. Stopping tests.")
        return False
    
    print(f"✅ Test user created: {email}")
    
    print("\n🔒 TESTING AUTHENTICATION REQUIREMENTS...")
    test_authentication_requirements(results)
    
    print("\n💳 TESTING PAYMENT METHODS MANAGEMENT...")
    payment_methods = test_list_payment_methods(results, token)
    setup_client_secret = test_create_setup_intent(results, token)
    test_attach_payment_method(results, token)
    
    print("\n🎫 TESTING PROMO CODE FUNCTIONALITY...")
    test_apply_valid_promo_codes(results, token)
    test_apply_invalid_promo_code(results, token)
    test_apply_promo_with_credits(results, token)
    
    print("\n💰 TESTING PAYMENT PRE-AUTHORIZATION...")
    success_pi_id, sca_pi_id = test_payment_preauth_scenarios(results, token)
    
    print("\n✅ TESTING STRIPE ACTION CONFIRMATION...")
    if sca_pi_id:
        test_confirm_stripe_action(results, sca_pi_id)
    
    print("\n📅 TESTING BOOKING CREATION...")
    now_booking_id, scheduled_booking_id = test_create_bookings(results, token)
    
    print("\n🚫 TESTING PAYMENT VOID...")
    if success_pi_id:
        test_void_preauth(results, success_pi_id)
    
    # Print final results
    results.print_summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)