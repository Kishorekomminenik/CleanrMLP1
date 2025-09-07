#!/usr/bin/env python3
"""
SHINE v1.0.0 Production Readiness Testing
Comprehensive final production readiness testing for SHINE v1.0.0 platform
Focus on platform pricing system, core marketplace functions, and production critical systems
"""

import requests
import json
import time
from datetime import datetime
import uuid
import re
import statistics

# Configuration
BASE_URL = "https://service-hub-shine.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class ProductionTestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.performance_metrics = []
        self.critical_issues = []
        self.p1_issues = []
    
    def add_result(self, test_name, passed, message="", category="GENERAL", response_time=None, is_critical=False, is_p1=False):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "category": category,
            "timestamp": datetime.now().isoformat(),
            "response_time": response_time
        })
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            if is_critical:
                self.critical_issues.append(f"{test_name}: {message}")
            elif is_p1:
                self.p1_issues.append(f"{test_name}: {message}")
        
        if response_time:
            self.performance_metrics.append(response_time)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        critical_flag = " [CRITICAL]" if is_critical else " [P1]" if is_p1 else ""
        print(f"{status}: {test_name}{critical_flag}")
        if message:
            print(f"   {message}")
        if response_time:
            print(f"   Response time: {response_time:.2f}ms")
    
    def print_summary(self):
        print(f"\n{'='*80}")
        print(f"SHINE v1.0.0 PRODUCTION READINESS TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.performance_metrics:
            p95 = statistics.quantiles(self.performance_metrics, n=20)[18]  # 95th percentile
            avg = statistics.mean(self.performance_metrics)
            print(f"\nPERFORMANCE METRICS:")
            print(f"Average Response Time: {avg:.2f}ms")
            print(f"P95 Response Time: {p95:.2f}ms")
            print(f"P95 Target (<500ms): {'✅ PASS' if p95 < 500 else '❌ FAIL'}")
        
        if self.critical_issues:
            print(f"\n🚨 CRITICAL ISSUES (PRODUCTION BLOCKERS):")
            for issue in self.critical_issues:
                print(f"- {issue}")
        
        if self.p1_issues:
            print(f"\n⚠️ P1 ISSUES (HIGH PRIORITY):")
            for issue in self.p1_issues:
                print(f"- {issue}")
        
        # Production readiness assessment
        error_rate = (self.failed / (self.passed + self.failed)) * 100
        print(f"\nPRODUCTION READINESS ASSESSMENT:")
        print(f"Error Rate: {error_rate:.1f}% (Target: <1%)")
        print(f"Error Rate Status: {'✅ PASS' if error_rate < 1 else '❌ FAIL'}")
        
        if not self.critical_issues and error_rate < 1:
            if self.performance_metrics and statistics.quantiles(self.performance_metrics, n=20)[18] < 500:
                print(f"\n🎉 PRODUCTION READY: All critical systems operational, performance targets met")
            else:
                print(f"\n⚠️ PERFORMANCE CONCERNS: Critical systems operational but performance targets not met")
        else:
            print(f"\n🚫 NOT PRODUCTION READY: Critical issues or high error rate detected")

def make_request(method, endpoint, data=None, headers=None, auth_token=None):
    """Enhanced request helper with performance tracking"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    start_time = time.time()
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        print(f"Request: {method} {endpoint} -> Status: {response.status_code} ({response_time:.2f}ms)")
        return response, response_time
    except requests.exceptions.Timeout as e:
        response_time = (time.time() - start_time) * 1000
        print(f"Request timeout: {method} {endpoint} - {e} ({response_time:.2f}ms)")
        return None, response_time
    except requests.exceptions.RequestException as e:
        response_time = (time.time() - start_time) * 1000
        print(f"Request failed: {method} {endpoint} - {e} ({response_time:.2f}ms)")
        return None, response_time

# ===== PRIORITY 1: PLATFORM PRICING SYSTEM =====

def test_platform_pricing_engine(results, customer_token):
    """Test PRIORITY 1: Platform Pricing System - Core pricing engine with surge calculation"""
    print(f"\n🏷️ TESTING PRIORITY 1: PLATFORM PRICING SYSTEM")
    
    if not customer_token:
        results.add_result(
            "Platform Pricing Engine Setup", 
            False, 
            "No customer token available", 
            "PRICING", 
            None,
            is_critical=True
        )
        return
    
    # Test 1: Core Pricing Engine - POST /api/pricing/quote
    print("\n--- Testing Core Pricing Engine ---")
    
    # Test Deep Clean with surge
    pricing_data = {
        "serviceType": "deep",
        "dwellingType": "house",
        "bedrooms": 3,
        "bathrooms": 2,
        "masters": 1,
        "addons": ["inside_fridge", "inside_oven"],
        "timing": {"when": "now"},
        "location": {
            "lat": 37.7749,
            "lng": -122.4194,
            "zone": "urban"
        }
    }
    
    response, response_time = make_request("POST", "/pricing/quote", pricing_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "estimateId" in resp_data and "total" in resp_data and "surge" in resp_data:
                surge_info = resp_data["surge"]
                total = resp_data["total"]
                results.add_result(
                    "Platform Pricing Engine - Deep Clean with Surge", 
                    True, 
                    f"Quote generated: ${total}, surge: {surge_info.get('multiplier', 1.0)}x, estimate: {resp_data['estimateId']}", 
                    "PRICING", 
                    response_time,
                    is_critical=True
                )
            else:
                results.add_result(
                    "Platform Pricing Engine - Deep Clean with Surge", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PRICING", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Platform Pricing Engine - Deep Clean with Surge", 
                False, 
                f"JSON parsing error: {e}", 
                "PRICING", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Platform Pricing Engine - Deep Clean with Surge", 
            False, 
            f"Pricing engine failed. Status: {response.status_code if response else 'No response'}", 
            "PRICING", 
            response_time,
            is_critical=True
        )
    
    # Test Bathroom-only scheduled (no surge)
    pricing_data_scheduled = {
        "serviceType": "bathroom",
        "dwellingType": "apartment",
        "bedrooms": 1,
        "bathrooms": 1,
        "masters": 0,
        "addons": [],
        "timing": {"when": "schedule", "scheduleAt": "2024-01-15T10:00:00Z"},
        "location": {
            "lat": 37.7849,
            "lng": -122.4094,
            "zone": "suburban"
        }
    }
    
    response, response_time = make_request("POST", "/pricing/quote", pricing_data_scheduled, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "estimateId" in resp_data and "total" in resp_data:
                total = resp_data["total"]
                surge_active = resp_data.get("surge", {}).get("active", False)
                results.add_result(
                    "Platform Pricing Engine - Bathroom Scheduled", 
                    True, 
                    f"Quote generated: ${total}, surge active: {surge_active}", 
                    "PRICING", 
                    response_time
                )
            else:
                results.add_result(
                    "Platform Pricing Engine - Bathroom Scheduled", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PRICING", 
                    response_time,
                    is_p1=True
                )
        except Exception as e:
            results.add_result(
                "Platform Pricing Engine - Bathroom Scheduled", 
                False, 
                f"JSON parsing error: {e}", 
                "PRICING", 
                response_time,
                is_p1=True
            )
    else:
        results.add_result(
            "Platform Pricing Engine - Bathroom Scheduled", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PRICING", 
            response_time,
            is_p1=True
        )

def test_owner_pricing_configuration(results, owner_token):
    """Test Owner-only pricing configuration access"""
    print("\n--- Testing Owner Pricing Configuration ---")
    
    if not owner_token:
        results.add_result(
            "Owner Pricing Configuration Access", 
            False, 
            "No owner token available", 
            "PRICING", 
            None,
            is_critical=True
        )
        return
    
    # Test GET /api/pricing/rules (Owner-only)
    response, response_time = make_request("GET", "/pricing/rules", auth_token=owner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "zones" in resp_data and "baseFares" in resp_data and "surgeRules" in resp_data:
                zones_count = len(resp_data["zones"])
                fares_count = len(resp_data["baseFares"])
                results.add_result(
                    "Owner Pricing Configuration Access", 
                    True, 
                    f"Pricing rules retrieved: {zones_count} zones, {fares_count} base fares", 
                    "PRICING", 
                    response_time
                )
            else:
                results.add_result(
                    "Owner Pricing Configuration Access", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PRICING", 
                    response_time,
                    is_p1=True
                )
        except Exception as e:
            results.add_result(
                "Owner Pricing Configuration Access", 
                False, 
                f"JSON parsing error: {e}", 
                "PRICING", 
                response_time,
                is_p1=True
            )
    else:
        results.add_result(
            "Owner Pricing Configuration Access", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PRICING", 
            response_time,
            is_critical=True
        )
    
    # Test access control - Customer should be denied
    customer_token = create_test_customer()
    if customer_token:
        response, response_time = make_request("GET", "/pricing/rules", auth_token=customer_token)
        if response and response.status_code == 403:
            results.add_result(
                "Pricing Rules Access Control", 
                True, 
                "Customer properly denied access to pricing rules", 
                "PRICING", 
                response_time
            )
        else:
            results.add_result(
                "Pricing Rules Access Control", 
                False, 
                f"Access control failed. Status: {response.status_code if response else 'No response'}", 
                "PRICING", 
                response_time,
                is_critical=True
            )

def test_partner_payout_calculation(results, partner_token, owner_token):
    """Test Partner payout calculation (75% take rate)"""
    print("\n--- Testing Partner Payout Calculation ---")
    
    if not partner_token:
        results.add_result(
            "Partner Payout Calculation", 
            False, 
            "No partner token available", 
            "PRICING", 
            None,
            is_critical=True
        )
        return
    
    # Test POST /api/partner/earnings/payout-calc
    payout_data = {
        "bookingId": "bk_test_payout_001",
        "totalAmount": 100.0,
        "currency": "usd"
    }
    
    response, response_time = make_request("POST", "/partner/earnings/payout-calc", payout_data, auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "partnerPayout" in resp_data and "takeRate" in resp_data:
                payout = resp_data["partnerPayout"]
                take_rate = resp_data["takeRate"]
                expected_payout = 100.0 * 0.75  # 75% take rate
                
                if abs(payout - expected_payout) < 0.01 and take_rate == 0.75:
                    results.add_result(
                        "Partner Payout Calculation (75% Take Rate)", 
                        True, 
                        f"Correct payout: ${payout} (75% of $100), take rate: {take_rate}", 
                        "PRICING", 
                        response_time
                    )
                else:
                    results.add_result(
                        "Partner Payout Calculation (75% Take Rate)", 
                        False, 
                        f"Incorrect calculation: payout=${payout}, take_rate={take_rate}, expected=${expected_payout}", 
                        "PRICING", 
                        response_time,
                        is_critical=True
                    )
            else:
                results.add_result(
                    "Partner Payout Calculation (75% Take Rate)", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PRICING", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Partner Payout Calculation (75% Take Rate)", 
                False, 
                f"JSON parsing error: {e}", 
                "PRICING", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Partner Payout Calculation (75% Take Rate)", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PRICING", 
            response_time,
            is_critical=True
        )
    
    # Test with owner token (should also work)
    if owner_token:
        response, response_time = make_request("POST", "/partner/earnings/payout-calc", payout_data, auth_token=owner_token)
        if response and response.status_code == 200:
            results.add_result(
                "Owner Payout Calculation Access", 
                True, 
                "Owner can access payout calculations", 
                "PRICING", 
                response_time
            )
        else:
            results.add_result(
                "Owner Payout Calculation Access", 
                False, 
                f"Owner access failed. Status: {response.status_code if response else 'No response'}", 
                "PRICING", 
                response_time,
                is_p1=True
            )

def test_discovery_platform_pricing(results, customer_token):
    """Test Discovery search with platform pricing (fromPrice)"""
    print("\n--- Testing Discovery Platform Pricing ---")
    
    if not customer_token:
        results.add_result(
            "Discovery Platform Pricing", 
            False, 
            "No customer token available", 
            "PRICING", 
            None,
            is_p1=True
        )
        return
    
    # Test GET /api/discovery/search
    search_params = {
        "lat": 37.7749,
        "lng": -122.4194,
        "serviceType": "cleaning",
        "radius": 10
    }
    
    # Convert to query string
    query_string = "&".join([f"{k}={v}" for k, v in search_params.items()])
    
    response, response_time = make_request("GET", f"/discovery/search?{query_string}", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "items" in resp_data and "fromPrice" in resp_data:
                items_count = len(resp_data["items"])
                from_price = resp_data["fromPrice"]
                results.add_result(
                    "Discovery Platform Pricing", 
                    True, 
                    f"Search results: {items_count} items, fromPrice: ${from_price}", 
                    "PRICING", 
                    response_time
                )
            else:
                results.add_result(
                    "Discovery Platform Pricing", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PRICING", 
                    response_time,
                    is_p1=True
                )
        except Exception as e:
            results.add_result(
                "Discovery Platform Pricing", 
                False, 
                f"JSON parsing error: {e}", 
                "PRICING", 
                response_time,
                is_p1=True
            )
    else:
        results.add_result(
            "Discovery Platform Pricing", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PRICING", 
            response_time,
            is_p1=True
        )

def test_partner_profile_farecards(results, customer_token):
    """Test Partner profile fareCards with platform pricing"""
    print("\n--- Testing Partner Profile FareCards ---")
    
    if not customer_token:
        results.add_result(
            "Partner Profile FareCards", 
            False, 
            "No customer token available", 
            "PRICING", 
            None,
            is_p1=True
        )
        return
    
    # Test GET /api/partners/{partnerId}/profile
    partner_id = "pa_101"  # Mock partner ID
    
    response, response_time = make_request("GET", f"/partners/{partner_id}/profile", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "services" in resp_data and "fareCards" in resp_data:
                fare_cards = resp_data["fareCards"]
                if fare_cards and "fromPrice" in fare_cards[0]:
                    from_price = fare_cards[0]["fromPrice"]
                    results.add_result(
                        "Partner Profile FareCards", 
                        True, 
                        f"FareCards with platform pricing: fromPrice=${from_price}", 
                        "PRICING", 
                        response_time
                    )
                else:
                    results.add_result(
                        "Partner Profile FareCards", 
                        False, 
                        f"FareCards missing fromPrice: {fare_cards}", 
                        "PRICING", 
                        response_time,
                        is_p1=True
                    )
            else:
                results.add_result(
                    "Partner Profile FareCards", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PRICING", 
                    response_time,
                    is_p1=True
                )
        except Exception as e:
            results.add_result(
                "Partner Profile FareCards", 
                False, 
                f"JSON parsing error: {e}", 
                "PRICING", 
                response_time,
                is_p1=True
            )
    else:
        results.add_result(
            "Partner Profile FareCards", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PRICING", 
            response_time,
            is_p1=True
        )

def test_booking_platform_pricing(results, customer_token):
    """Test Booking creation with platform pricing and estimateId support"""
    print("\n--- Testing Booking Platform Pricing ---")
    
    if not customer_token:
        results.add_result(
            "Booking Platform Pricing", 
            False, 
            "No customer token available", 
            "PRICING", 
            None,
            is_critical=True
        )
        return
    
    # First get a pricing quote to get estimateId
    pricing_data = {
        "serviceType": "basic",
        "dwellingType": "apartment",
        "bedrooms": 2,
        "bathrooms": 1,
        "masters": 0,
        "addons": [],
        "timing": {"when": "now"},
        "location": {
            "lat": 37.7749,
            "lng": -122.4194,
            "zone": "urban"
        }
    }
    
    quote_response, _ = make_request("POST", "/pricing/quote", pricing_data, auth_token=customer_token)
    estimate_id = None
    platform_total = None
    
    if quote_response and quote_response.status_code == 200:
        try:
            quote_data = quote_response.json()
            estimate_id = quote_data.get("estimateId")
            platform_total = quote_data.get("total")
        except:
            pass
    
    if not estimate_id:
        results.add_result(
            "Booking Platform Pricing", 
            False, 
            "Could not get estimateId from pricing quote", 
            "PRICING", 
            None,
            is_critical=True
        )
        return
    
    # Test POST /api/bookings with estimateId
    booking_data = {
        "estimateId": estimate_id,  # Platform pricing integration
        "service": {
            "serviceType": "basic",
            "timing": {"when": "now"},
            "details": {"bedrooms": 2, "bathrooms": 1}
        },
        "address": {
            "line1": "123 Platform Street",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94102",
            "lat": 37.7749,
            "lng": -122.4194
        },
        "access": {
            "entrance": "front_door",
            "notes": "Platform pricing test"
        },
        "totals": {
            "total": platform_total  # Should be ignored in favor of platform pricing
        },
        "payment": {
            "paymentMethodId": "pm_card_visa"
        }
    }
    
    response, response_time = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "bookingId" in resp_data and "status" in resp_data:
                booking_id = resp_data["bookingId"]
                status = resp_data["status"]
                results.add_result(
                    "Booking Platform Pricing Integration", 
                    True, 
                    f"Booking created with platform pricing: {booking_id}, status: {status}", 
                    "PRICING", 
                    response_time
                )
                return booking_id
            else:
                results.add_result(
                    "Booking Platform Pricing Integration", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PRICING", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Booking Platform Pricing Integration", 
                False, 
                f"JSON parsing error: {e}", 
                "PRICING", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Booking Platform Pricing Integration", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PRICING", 
            response_time,
            is_critical=True
        )
    
    return None

# ===== PRIORITY 2: CORE MARKETPLACE FUNCTIONS =====

def test_authentication_system(results):
    """Test PRIORITY 2: Authentication system (Customer/Partner/Owner + MFA)"""
    print(f"\n🔐 TESTING PRIORITY 2: CORE MARKETPLACE FUNCTIONS - Authentication")
    
    # Test Customer Authentication
    customer_email = f"prod_customer_{uuid.uuid4().hex[:8]}@shine.com"
    customer_data = {
        "email": customer_email,
        "password": "ProductionTest123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response, response_time = make_request("POST", "/auth/signup", customer_data)
    customer_token = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and "user" in resp_data:
                customer_token = resp_data["token"]
                results.add_result(
                    "Customer Authentication", 
                    True, 
                    f"Customer signup successful: {customer_email}", 
                    "AUTH", 
                    response_time
                )
            else:
                results.add_result(
                    "Customer Authentication", 
                    False, 
                    f"Invalid signup response: {resp_data}", 
                    "AUTH", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Customer Authentication", 
                False, 
                f"JSON parsing error: {e}", 
                "AUTH", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Customer Authentication", 
            False, 
            f"Customer signup failed. Status: {response.status_code if response else 'No response'}", 
            "AUTH", 
            response_time,
            is_critical=True
        )
    
    # Test Partner Authentication
    partner_email = f"prod_partner_{uuid.uuid4().hex[:8]}@shine.com"
    partner_data = {
        "email": partner_email,
        "password": "ProductionTest123!",
        "role": "partner",
        "accept_tos": True
    }
    
    response, response_time = make_request("POST", "/auth/signup", partner_data)
    partner_token = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and resp_data["user"]["role"] == "partner":
                partner_token = resp_data["token"]
                partner_status = resp_data["user"]["partner_status"]
                results.add_result(
                    "Partner Authentication", 
                    True, 
                    f"Partner signup successful: {partner_email}, status: {partner_status}", 
                    "AUTH", 
                    response_time
                )
            else:
                results.add_result(
                    "Partner Authentication", 
                    False, 
                    f"Invalid partner signup: {resp_data}", 
                    "AUTH", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Partner Authentication", 
                False, 
                f"JSON parsing error: {e}", 
                "AUTH", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Partner Authentication", 
            False, 
            f"Partner signup failed. Status: {response.status_code if response else 'No response'}", 
            "AUTH", 
            response_time,
            is_critical=True
        )
    
    # Test Owner Authentication with MFA
    owner_email = f"prod_owner_{uuid.uuid4().hex[:8]}@shine.com"
    owner_data = {
        "email": owner_email,
        "password": "ProductionTest123!",
        "role": "owner",
        "accept_tos": True
    }
    
    response, response_time = make_request("POST", "/auth/signup", owner_data)
    owner_token = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "token" in resp_data and resp_data["user"]["mfa_enabled"] is True:
                owner_token = resp_data["token"]
                results.add_result(
                    "Owner Authentication with MFA", 
                    True, 
                    f"Owner signup successful with MFA enabled: {owner_email}", 
                    "AUTH", 
                    response_time
                )
            else:
                results.add_result(
                    "Owner Authentication with MFA", 
                    False, 
                    f"Owner MFA not enabled: {resp_data}", 
                    "AUTH", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Owner Authentication with MFA", 
                False, 
                f"JSON parsing error: {e}", 
                "AUTH", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Owner Authentication with MFA", 
            False, 
            f"Owner signup failed. Status: {response.status_code if response else 'No response'}", 
            "AUTH", 
            response_time,
            is_critical=True
        )
    
    # Test MFA Flow for Owner Login
    if owner_email:
        login_data = {
            "identifier": owner_email,
            "password": "ProductionTest123!"
        }
        
        response, response_time = make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            try:
                resp_data = response.json()
                if resp_data.get("mfa_required") is True and "dev_mfa_code" in resp_data:
                    mfa_code = resp_data["dev_mfa_code"]
                    user_id = resp_data["user_id"]
                    
                    # Verify MFA
                    mfa_data = {
                        "user_id": user_id,
                        "code": mfa_code
                    }
                    
                    mfa_response, mfa_response_time = make_request("POST", "/auth/mfa/verify", mfa_data)
                    if mfa_response and mfa_response.status_code == 200:
                        try:
                            mfa_resp_data = mfa_response.json()
                            if mfa_resp_data.get("ok") is True and "token" in mfa_resp_data:
                                owner_token = mfa_resp_data["token"]
                                results.add_result(
                                    "Owner MFA Flow", 
                                    True, 
                                    f"Complete MFA flow successful for owner", 
                                    "AUTH", 
                                    mfa_response_time
                                )
                            else:
                                results.add_result(
                                    "Owner MFA Flow", 
                                    False, 
                                    f"MFA verification failed: {mfa_resp_data}", 
                                    "AUTH", 
                                    mfa_response_time,
                                    is_critical=True
                                )
                        except Exception as e:
                            results.add_result(
                                "Owner MFA Flow", 
                                False, 
                                f"MFA response parsing error: {e}", 
                                "AUTH", 
                                mfa_response_time,
                                is_critical=True
                            )
                    else:
                        results.add_result(
                            "Owner MFA Flow", 
                            False, 
                            f"MFA verification failed. Status: {mfa_response.status_code if mfa_response else 'No response'}", 
                            "AUTH", 
                            mfa_response_time,
                            is_critical=True
                        )
                else:
                    results.add_result(
                        "Owner MFA Flow", 
                        False, 
                        f"MFA not required for owner login: {resp_data}", 
                        "AUTH", 
                        response_time,
                        is_critical=True
                    )
            except Exception as e:
                results.add_result(
                    "Owner MFA Flow", 
                    False, 
                    f"Login response parsing error: {e}", 
                    "AUTH", 
                    response_time,
                    is_critical=True
                )
        else:
            results.add_result(
                "Owner MFA Flow", 
                False, 
                f"Owner login failed. Status: {response.status_code if response else 'No response'}", 
                "AUTH", 
                response_time,
                is_critical=True
            )
    
    return customer_token, partner_token, owner_token

def test_booking_management(results, customer_token):
    """Test booking creation and management"""
    print("\n--- Testing Booking Management ---")
    
    if not customer_token:
        results.add_result(
            "Booking Management", 
            False, 
            "No customer token available", 
            "BOOKING", 
            None,
            is_critical=True
        )
        return None
    
    # Create a booking
    booking_data = {
        "quoteId": "quote_prod_test",
        "service": {
            "serviceType": "basic",
            "timing": {"when": "now"},
            "details": {"bedrooms": 2, "bathrooms": 1}
        },
        "address": {
            "line1": "123 Production Street",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94102",
            "lat": 37.7749,
            "lng": -122.4194
        },
        "access": {
            "entrance": "front_door"
        },
        "totals": {
            "total": 89.00
        },
        "payment": {
            "paymentMethodId": "pm_card_visa"
        }
    }
    
    response, response_time = make_request("POST", "/bookings", booking_data, auth_token=customer_token)
    booking_id = None
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "bookingId" in resp_data:
                booking_id = resp_data["bookingId"]
                status = resp_data["status"]
                results.add_result(
                    "Booking Creation", 
                    True, 
                    f"Booking created: {booking_id}, status: {status}", 
                    "BOOKING", 
                    response_time
                )
            else:
                results.add_result(
                    "Booking Creation", 
                    False, 
                    f"No booking ID in response: {resp_data}", 
                    "BOOKING", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Booking Creation", 
                False, 
                f"JSON parsing error: {e}", 
                "BOOKING", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Booking Creation", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "BOOKING", 
            response_time,
            is_critical=True
        )
    
    return booking_id

# ===== PRIORITY 3: PRODUCTION CRITICAL SYSTEMS =====

def test_rate_limiting_security(results, customer_token):
    """Test rate limiting and security measures"""
    print(f"\n🛡️ TESTING PRIORITY 3: PRODUCTION CRITICAL SYSTEMS - Security")
    
    # Test rate limiting by making multiple rapid requests
    print("\n--- Testing Rate Limiting ---")
    
    if not customer_token:
        results.add_result(
            "Rate Limiting Test", 
            False, 
            "No customer token available", 
            "SECURITY", 
            None,
            is_p1=True
        )
        return
    
    # Make 10 rapid requests to test rate limiting
    rate_limit_responses = []
    for i in range(10):
        response, response_time = make_request("GET", "/auth/me", auth_token=customer_token)
        if response:
            rate_limit_responses.append(response.status_code)
        time.sleep(0.1)  # Small delay between requests
    
    # Check if any requests were rate limited (429 status)
    success_count = sum(1 for status in rate_limit_responses if status == 200)
    rate_limited_count = sum(1 for status in rate_limit_responses if status == 429)
    
    if success_count >= 8:  # Allow most requests to succeed
        results.add_result(
            "Rate Limiting - Normal Load", 
            True, 
            f"Handled normal load: {success_count}/10 requests successful", 
            "SECURITY", 
            None
        )
    else:
        results.add_result(
            "Rate Limiting - Normal Load", 
            False, 
            f"Too many requests failed: {success_count}/10 successful", 
            "SECURITY", 
            None,
            is_p1=True
        )
    
    # Test authentication security
    print("\n--- Testing Authentication Security ---")
    
    # Test invalid token
    response, response_time = make_request("GET", "/auth/me", auth_token="invalid_token_12345")
    if response and response.status_code == 401:
        results.add_result(
            "Invalid Token Security", 
            True, 
            "Invalid token properly rejected with 401", 
            "SECURITY", 
            response_time
        )
    else:
        results.add_result(
            "Invalid Token Security", 
            False, 
            f"Invalid token not handled correctly. Status: {response.status_code if response else 'No response'}", 
            "SECURITY", 
            response_time,
            is_critical=True
        )
    
    # Test no token
    response, response_time = make_request("GET", "/auth/me")
    if response and response.status_code in [401, 403]:
        results.add_result(
            "No Token Security", 
            True, 
            f"No token properly rejected with {response.status_code}", 
            "SECURITY", 
            response_time
        )
    else:
        results.add_result(
            "No Token Security", 
            False, 
            f"No token not handled correctly. Status: {response.status_code if response else 'No response'}", 
            "SECURITY", 
            response_time,
            is_critical=True
        )

def test_error_handling_validation(results):
    """Test error handling and validation"""
    print("\n--- Testing Error Handling & Validation ---")
    
    # Test invalid signup data
    invalid_signup_data = {
        "email": "invalid-email",
        "password": "weak",
        "role": "invalid_role",
        "accept_tos": False
    }
    
    response, response_time = make_request("POST", "/auth/signup", invalid_signup_data)
    if response and response.status_code == 422:
        try:
            error_data = response.json()
            if "detail" in error_data:
                results.add_result(
                    "Input Validation", 
                    True, 
                    "Invalid input properly rejected with validation errors", 
                    "VALIDATION", 
                    response_time
                )
            else:
                results.add_result(
                    "Input Validation", 
                    False, 
                    f"Validation error format incorrect: {error_data}", 
                    "VALIDATION", 
                    response_time,
                    is_p1=True
                )
        except Exception as e:
            results.add_result(
                "Input Validation", 
                False, 
                f"Error response parsing failed: {e}", 
                "VALIDATION", 
                response_time,
                is_p1=True
            )
    else:
        results.add_result(
            "Input Validation", 
            False, 
            f"Invalid input not properly validated. Status: {response.status_code if response else 'No response'}", 
            "VALIDATION", 
            response_time,
            is_critical=True
        )
    
    # Test non-existent endpoint
    response, response_time = make_request("GET", "/nonexistent/endpoint")
    if response and response.status_code == 404:
        results.add_result(
            "404 Error Handling", 
            True, 
            "Non-existent endpoint properly returns 404", 
            "VALIDATION", 
            response_time
        )
    else:
        results.add_result(
            "404 Error Handling", 
            False, 
            f"404 handling incorrect. Status: {response.status_code if response else 'No response'}", 
            "VALIDATION", 
            response_time,
            is_p1=True
        )

def test_database_connectivity(results, customer_token):
    """Test database connectivity and performance"""
    print("\n--- Testing Database Connectivity ---")
    
    if not customer_token:
        results.add_result(
            "Database Connectivity", 
            False, 
            "No customer token available", 
            "DATABASE", 
            None,
            is_critical=True
        )
        return
    
    # Test database read operation
    response, response_time = make_request("GET", "/auth/me", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            user_data = response.json()
            if "id" in user_data and "email" in user_data:
                results.add_result(
                    "Database Read Operation", 
                    True, 
                    f"User data retrieved successfully in {response_time:.2f}ms", 
                    "DATABASE", 
                    response_time
                )
            else:
                results.add_result(
                    "Database Read Operation", 
                    False, 
                    f"Incomplete user data: {user_data}", 
                    "DATABASE", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Database Read Operation", 
                False, 
                f"JSON parsing error: {e}", 
                "DATABASE", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Database Read Operation", 
            False, 
            f"Database read failed. Status: {response.status_code if response else 'No response'}", 
            "DATABASE", 
            response_time,
            is_critical=True
        )
    
    # Test database write operation (save address)
    address_data = {
        "label": "Production Test Address",
        "line1": "123 Database Test St",
        "city": "San Francisco",
        "state": "CA",
        "postalCode": "94102",
        "country": "USA",
        "lat": 37.7749,
        "lng": -122.4194
    }
    
    response, response_time = make_request("POST", "/addresses", address_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "id" in resp_data:
                results.add_result(
                    "Database Write Operation", 
                    True, 
                    f"Address saved successfully in {response_time:.2f}ms", 
                    "DATABASE", 
                    response_time
                )
            else:
                results.add_result(
                    "Database Write Operation", 
                    False, 
                    f"No address ID returned: {resp_data}", 
                    "DATABASE", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Database Write Operation", 
                False, 
                f"JSON parsing error: {e}", 
                "DATABASE", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Database Write Operation", 
            False, 
            f"Database write failed. Status: {response.status_code if response else 'No response'}", 
            "DATABASE", 
            response_time,
            is_critical=True
        )

def test_payment_processing(results, customer_token):
    """Test payment processing integration (Stripe)"""
    print("\n--- Testing Payment Processing ---")
    
    if not customer_token:
        results.add_result(
            "Payment Processing", 
            False, 
            "No customer token available", 
            "PAYMENT", 
            None,
            is_critical=True
        )
        return
    
    # Test payment methods listing
    response, response_time = make_request("GET", "/billing/methods", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "methods" in resp_data:
                methods_count = len(resp_data["methods"])
                results.add_result(
                    "Payment Methods Retrieval", 
                    True, 
                    f"Payment methods retrieved: {methods_count} methods", 
                    "PAYMENT", 
                    response_time
                )
            else:
                results.add_result(
                    "Payment Methods Retrieval", 
                    False, 
                    f"Invalid response structure: {resp_data}", 
                    "PAYMENT", 
                    response_time,
                    is_p1=True
                )
        except Exception as e:
            results.add_result(
                "Payment Methods Retrieval", 
                False, 
                f"JSON parsing error: {e}", 
                "PAYMENT", 
                response_time,
                is_p1=True
            )
    else:
        results.add_result(
            "Payment Methods Retrieval", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PAYMENT", 
            response_time,
            is_critical=True
        )
    
    # Test setup intent creation
    response, response_time = make_request("POST", "/billing/setup-intent", auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "clientSecret" in resp_data:
                results.add_result(
                    "Stripe Setup Intent", 
                    True, 
                    "Setup intent created successfully", 
                    "PAYMENT", 
                    response_time
                )
            else:
                results.add_result(
                    "Stripe Setup Intent", 
                    False, 
                    f"No client secret in response: {resp_data}", 
                    "PAYMENT", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Stripe Setup Intent", 
                False, 
                f"JSON parsing error: {e}", 
                "PAYMENT", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Stripe Setup Intent", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PAYMENT", 
            response_time,
            is_critical=True
        )
    
    # Test payment pre-authorization
    preauth_data = {
        "amount": 100.0,
        "currency": "usd",
        "paymentMethodId": "pm_card_visa"
    }
    
    response, response_time = make_request("POST", "/billing/preauth", preauth_data, auth_token=customer_token)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            if "paymentIntentId" in resp_data and "clientSecret" in resp_data:
                results.add_result(
                    "Payment Pre-Authorization", 
                    True, 
                    f"Pre-auth successful: {resp_data['paymentIntentId']}", 
                    "PAYMENT", 
                    response_time
                )
            else:
                results.add_result(
                    "Payment Pre-Authorization", 
                    False, 
                    f"Invalid pre-auth response: {resp_data}", 
                    "PAYMENT", 
                    response_time,
                    is_critical=True
                )
        except Exception as e:
            results.add_result(
                "Payment Pre-Authorization", 
                False, 
                f"JSON parsing error: {e}", 
                "PAYMENT", 
                response_time,
                is_critical=True
            )
    else:
        results.add_result(
            "Payment Pre-Authorization", 
            False, 
            f"Status: {response.status_code if response else 'No response'}", 
            "PAYMENT", 
            response_time,
            is_critical=True
        )

# ===== PRIORITY 4: API PERFORMANCE & RELIABILITY =====

def test_api_performance_reliability(results, customer_token):
    """Test PRIORITY 4: API Performance & Reliability"""
    print(f"\n⚡ TESTING PRIORITY 4: API PERFORMANCE & RELIABILITY")
    
    if not customer_token:
        results.add_result(
            "API Performance Test", 
            False, 
            "No customer token available", 
            "PERFORMANCE", 
            None,
            is_critical=True
        )
        return
    
    # Test multiple endpoints for performance
    endpoints_to_test = [
        ("GET", "/auth/me", None),
        ("GET", "/addresses", None),
        ("GET", "/billing/methods", None),
        ("GET", "/support/faqs", None),
        ("POST", "/billing/setup-intent", {})
    ]
    
    response_times = []
    error_count = 0
    total_tests = len(endpoints_to_test)
    
    for method, endpoint, data in endpoints_to_test:
        response, response_time = make_request(method, endpoint, data, auth_token=customer_token)
        response_times.append(response_time)
        
        if not response or response.status_code >= 400:
            error_count += 1
    
    # Calculate performance metrics
    if response_times:
        avg_response_time = statistics.mean(response_times)
        max_response_time = max(response_times)
        
        # P95 calculation (if we have enough data points)
        if len(response_times) >= 5:
            p95_response_time = statistics.quantiles(response_times, n=20)[18]
        else:
            p95_response_time = max_response_time
        
        # Performance assessment
        if p95_response_time < 500:
            results.add_result(
                "API Performance - P95 Response Time", 
                True, 
                f"P95: {p95_response_time:.2f}ms (target: <500ms)", 
                "PERFORMANCE", 
                p95_response_time
            )
        else:
            results.add_result(
                "API Performance - P95 Response Time", 
                False, 
                f"P95: {p95_response_time:.2f}ms exceeds 500ms target", 
                "PERFORMANCE", 
                p95_response_time,
                is_p1=True
            )
        
        if avg_response_time < 200:
            results.add_result(
                "API Performance - Average Response Time", 
                True, 
                f"Average: {avg_response_time:.2f}ms", 
                "PERFORMANCE", 
                avg_response_time
            )
        else:
            results.add_result(
                "API Performance - Average Response Time", 
                False, 
                f"Average: {avg_response_time:.2f}ms is high", 
                "PERFORMANCE", 
                avg_response_time,
                is_p1=True
            )
    
    # Error rate assessment
    error_rate = (error_count / total_tests) * 100
    if error_rate < 1:
        results.add_result(
            "API Reliability - Error Rate", 
            True, 
            f"Error rate: {error_rate:.1f}% (target: <1%)", 
            "PERFORMANCE", 
            None
        )
    else:
        results.add_result(
            "API Reliability - Error Rate", 
            False, 
            f"Error rate: {error_rate:.1f}% exceeds 1% target", 
            "PERFORMANCE", 
            None,
            is_critical=True
        )

# ===== HELPER FUNCTIONS =====

def create_test_customer():
    """Create a test customer and return token"""
    customer_email = f"test_customer_{uuid.uuid4().hex[:8]}@shine.com"
    customer_data = {
        "email": customer_email,
        "password": "TestPass123!",
        "role": "customer",
        "accept_tos": True
    }
    
    response, _ = make_request("POST", "/auth/signup", customer_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            return resp_data.get("token")
        except:
            pass
    return None

def create_test_partner():
    """Create a test partner and return token"""
    partner_email = f"test_partner_{uuid.uuid4().hex[:8]}@shine.com"
    partner_data = {
        "email": partner_email,
        "password": "TestPass123!",
        "role": "partner",
        "accept_tos": True
    }
    
    response, _ = make_request("POST", "/auth/signup", partner_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            return resp_data.get("token")
        except:
            pass
    return None

def create_test_owner():
    """Create a test owner and return token (with MFA)"""
    owner_email = f"test_owner_{uuid.uuid4().hex[:8]}@shine.com"
    owner_data = {
        "email": owner_email,
        "password": "TestPass123!",
        "role": "owner",
        "accept_tos": True
    }
    
    response, _ = make_request("POST", "/auth/signup", owner_data)
    if response and response.status_code == 200:
        try:
            resp_data = response.json()
            return resp_data.get("token")
        except:
            pass
    return None

# ===== MAIN TEST EXECUTION =====

def main():
    """Main test execution function"""
    print("🚀 STARTING SHINE v1.0.0 PRODUCTION READINESS TESTING")
    print("=" * 80)
    
    results = ProductionTestResults()
    
    # PRIORITY 1: Platform Pricing System
    test_platform_pricing_engine(results)
    
    # Create test users for subsequent tests
    customer_token, partner_token, owner_token = test_authentication_system(results)
    
    # Continue with Priority 1 tests that require authentication
    test_owner_pricing_configuration(results, owner_token)
    test_partner_payout_calculation(results, partner_token, owner_token)
    test_discovery_platform_pricing(results)
    test_partner_profile_farecards(results)
    booking_id = test_booking_platform_pricing(results, customer_token)
    
    # PRIORITY 2: Core Marketplace Functions
    booking_id = booking_id or test_booking_management(results, customer_token)
    
    # PRIORITY 3: Production Critical Systems
    test_rate_limiting_security(results, customer_token)
    test_error_handling_validation(results)
    test_database_connectivity(results, customer_token)
    test_payment_processing(results, customer_token)
    
    # PRIORITY 4: API Performance & Reliability
    test_api_performance_reliability(results, customer_token)
    
    # Print final summary
    results.print_summary()
    
    return results

if __name__ == "__main__":
    main()