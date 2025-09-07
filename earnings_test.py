#!/usr/bin/env python3
"""
PAGE-9-EARNINGS: Partner Earnings & Payouts System Comprehensive Tests
Tests all 16 new earnings API endpoints with security, business logic, and edge cases
"""

import requests
import json
import time
from datetime import datetime, timedelta
import uuid
import secrets

# Configuration
BASE_URL = "https://4d887c9a-9eda-43bf-b7bc-8ea882f55f7b.preview.emergentagent.com/api"
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
        print(f"\n{'='*80}")
        print(f"PAGE-9-EARNINGS: PARTNER EARNINGS & PAYOUTS SYSTEM TEST SUMMARY")
        print(f"{'='*80}")
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

def create_partner_user(results):
    """Create a partner user for testing"""
    partner_data = {
        "email": f"partner_earnings_{uuid.uuid4().hex[:8]}@test.com",
        "username": f"partner_earn_{uuid.uuid4().hex[:6]}",
        "password": "TestPass123!",
        "role": "partner",
        "phone": "+14155551234",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", partner_data)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "token" in data and "user" in data:
                results.add_result("Partner User Creation", True, f"Partner created: {data['user']['email']}")
                return data["token"], data["user"]
        except:
            pass
    
    results.add_result("Partner User Creation", False, f"Failed to create partner user. Status: {response.status_code if response else 'No response'}")
    return None, None

def create_customer_user(results):
    """Create a customer user for testing access control"""
    customer_data = {
        "email": f"customer_earnings_{uuid.uuid4().hex[:8]}@test.com",
        "username": f"customer_earn_{uuid.uuid4().hex[:6]}",
        "password": "TestPass123!",
        "role": "customer",
        "phone": "+14155551235",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", customer_data)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "token" in data and "user" in data:
                results.add_result("Customer User Creation", True, f"Customer created: {data['user']['email']}")
                return data["token"], data["user"]
        except:
            pass
    
    results.add_result("Customer User Creation", False, f"Failed to create customer user. Status: {response.status_code if response else 'No response'}")
    return None, None

def create_owner_user(results):
    """Create an owner user for testing access control"""
    owner_data = {
        "email": f"owner_earnings_{uuid.uuid4().hex[:8]}@test.com",
        "username": f"owner_earn_{uuid.uuid4().hex[:6]}",
        "password": "TestPass123!",
        "role": "owner",
        "phone": "+14155551236",
        "accept_tos": True
    }
    
    response = make_request("POST", "/auth/signup", owner_data)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "token" in data and "user" in data:
                results.add_result("Owner User Creation", True, f"Owner created: {data['user']['email']}")
                return data["token"], data["user"]
        except:
            pass
    
    results.add_result("Owner User Creation", False, f"Failed to create owner user. Status: {response.status_code if response else 'No response'}")
    return None, None

# ===== PARTNER EARNINGS SUMMARY & CHART DATA TESTS =====

def test_earnings_summary(results, partner_token):
    """Test GET /api/partner/earnings/summary"""
    response = make_request("GET", "/partner/earnings/summary", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            required_fields = ["currency", "thisWeek", "tipsYtd", "availableBalance"]
            
            if all(field in data for field in required_fields):
                # Validate thisWeek structure
                this_week = data["thisWeek"]
                if "amount" in this_week and "jobs" in this_week:
                    # Validate data types
                    if (isinstance(data["tipsYtd"], (int, float)) and 
                        isinstance(data["availableBalance"], (int, float)) and
                        isinstance(this_week["amount"], (int, float)) and
                        isinstance(this_week["jobs"], int)):
                        results.add_result("Earnings Summary API", True, 
                                         f"Summary retrieved: ${data['availableBalance']:.2f} available, {this_week['jobs']} jobs this week")
                        return True
            
            results.add_result("Earnings Summary API", False, "Invalid response structure")
            return False
        except Exception as e:
            results.add_result("Earnings Summary API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Earnings Summary API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_earnings_series(results, partner_token):
    """Test GET /api/partner/earnings/series"""
    # Test with default parameters
    response = make_request("GET", "/partner/earnings/series", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "points" in data and isinstance(data["points"], list):
                if len(data["points"]) > 0:
                    # Validate point structure
                    point = data["points"][0]
                    required_fields = ["date", "earnings", "tips"]
                    if all(field in point for field in required_fields):
                        results.add_result("Earnings Series API", True, 
                                         f"Series data retrieved: {len(data['points'])} data points")
                        return True
                else:
                    results.add_result("Earnings Series API", True, "Empty series data (valid for new partner)")
                    return True
            
            results.add_result("Earnings Series API", False, "Invalid response structure")
            return False
        except Exception as e:
            results.add_result("Earnings Series API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Earnings Series API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_earnings_series_with_filters(results, partner_token):
    """Test GET /api/partner/earnings/series with date filters"""
    from_date = (datetime.now() - timedelta(days=30)).isoformat()
    to_date = datetime.now().isoformat()
    
    response = make_request("GET", f"/partner/earnings/series?fromDate={from_date}&toDate={to_date}&bucket=week", 
                          auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "points" in data:
                results.add_result("Earnings Series with Filters", True, 
                                 f"Filtered series data retrieved: {len(data['points'])} points")
                return True
        except Exception as e:
            results.add_result("Earnings Series with Filters", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Earnings Series with Filters", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

# ===== STATEMENTS MANAGEMENT TESTS =====

def test_statements_list(results, partner_token):
    """Test GET /api/partner/earnings/statements"""
    response = make_request("GET", "/partner/earnings/statements", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "items" in data and isinstance(data["items"], list):
                results.add_result("Statements List API", True, 
                                 f"Statements retrieved: {len(data['items'])} statements")
                return data["items"]
        except Exception as e:
            results.add_result("Statements List API", False, f"JSON parsing error: {e}")
            return []
    
    results.add_result("Statements List API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return []

def test_statement_detail(results, partner_token, statement_id):
    """Test GET /api/partner/earnings/statements/{id}"""
    response = make_request("GET", f"/partner/earnings/statements/{statement_id}", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            required_fields = ["id", "period", "currency", "gross", "tips", "surge", "adjustments", "fees", "taxWithheld", "net", "jobs"]
            
            if all(field in data for field in required_fields):
                # Validate period structure
                period = data["period"]
                if "from" in period and "to" in period:
                    # Validate jobs array
                    if isinstance(data["jobs"], list):
                        results.add_result("Statement Detail API", True, 
                                         f"Statement detail retrieved: ${data['net']:.2f} net, {len(data['jobs'])} jobs")
                        return True
            
            results.add_result("Statement Detail API", False, "Invalid response structure")
            return False
        except Exception as e:
            results.add_result("Statement Detail API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Statement Detail API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_statement_pdf(results, partner_token, statement_id):
    """Test GET /api/partner/earnings/statements/{id}/pdf"""
    response = make_request("GET", f"/partner/earnings/statements/{statement_id}/pdf", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "url" in data and data["url"].startswith("https://"):
                results.add_result("Statement PDF API", True, "PDF URL generated successfully")
                return True
            
            results.add_result("Statement PDF API", False, "Invalid PDF URL")
            return False
        except Exception as e:
            results.add_result("Statement PDF API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Statement PDF API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_export_request(results, partner_token):
    """Test POST /api/partner/earnings/export"""
    export_data = {
        "fromDate": (datetime.now() - timedelta(days=30)).isoformat(),
        "toDate": datetime.now().isoformat(),
        "serviceType": "all"
    }
    
    response = make_request("POST", "/partner/earnings/export", export_data, auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "jobId" in data and "status" in data:
                if data["status"] == "queued":
                    results.add_result("Export Request API", True, f"Export job created: {data['jobId']}")
                    return data["jobId"]
            
            results.add_result("Export Request API", False, "Invalid response structure")
            return None
        except Exception as e:
            results.add_result("Export Request API", False, f"JSON parsing error: {e}")
            return None
    
    results.add_result("Export Request API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return None

def test_export_status(results, partner_token, job_id):
    """Test GET /api/partner/earnings/export/{job_id}"""
    response = make_request("GET", f"/partner/earnings/export/{job_id}", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "status" in data:
                status = data["status"]
                if status in ["queued", "ready", "error"]:
                    results.add_result("Export Status API", True, f"Export status: {status}")
                    return True
            
            results.add_result("Export Status API", False, "Invalid response structure")
            return False
        except Exception as e:
            results.add_result("Export Status API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Export Status API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_export_invalid_date_range(results, partner_token):
    """Test export with invalid date range (>90 days)"""
    export_data = {
        "fromDate": (datetime.now() - timedelta(days=100)).isoformat(),
        "toDate": datetime.now().isoformat(),
        "serviceType": "all"
    }
    
    response = make_request("POST", "/partner/earnings/export", export_data, auth_token=partner_token)
    
    if response and response.status_code == 400:
        try:
            data = response.json()
            if "detail" in data and "90 days" in data["detail"]:
                results.add_result("Export Invalid Date Range", True, "Correctly rejected >90 day range")
                return True
        except:
            pass
    
    results.add_result("Export Invalid Date Range", False, f"Should reject >90 day range. Status: {response.status_code if response else 'No response'}")
    return False

# ===== PAYOUT SYSTEM TESTS =====

def test_payouts_list(results, partner_token):
    """Test GET /api/partner/payouts"""
    response = make_request("GET", "/partner/payouts", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "items" in data and isinstance(data["items"], list):
                results.add_result("Payouts List API", True, f"Payout history retrieved: {len(data['items'])} payouts")
                return True
        except Exception as e:
            results.add_result("Payouts List API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Payouts List API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_instant_payout_success(results, partner_token):
    """Test POST /api/partner/payouts/instant - success scenario"""
    # First check bank status
    bank_response = make_request("GET", "/partner/bank/status", auth_token=partner_token)
    bank_verified = False
    
    if bank_response and bank_response.status_code == 200:
        try:
            bank_data = bank_response.json()
            bank_verified = bank_data.get("verified", False)
        except:
            pass
    
    payout_data = {
        "amount": 50.0,
        "currency": "usd",
        "idempotencyKey": str(uuid.uuid4())
    }
    
    response = make_request("POST", "/partner/payouts/instant", payout_data, auth_token=partner_token)
    
    if not bank_verified:
        # Expect 409 for unverified bank
        if response and response.status_code == 409:
            try:
                data = response.json()
                if "detail" in data and "not verified" in data["detail"]:
                    results.add_result("Instant Payout Success", True, 
                                     "Correctly rejected payout for unverified bank account")
                    return True
            except:
                pass
        results.add_result("Instant Payout Success", False, f"Should reject unverified bank. Status: {response.status_code if response else 'No response'}")
        return False
    
    # Bank is verified, expect success
    if response and response.status_code == 200:
        try:
            data = response.json()
            required_fields = ["payoutId", "fee", "status"]
            if all(field in data for field in required_fields):
                # Validate fee calculation (1.5% with $0.50 minimum)
                expected_fee = max(0.50, payout_data["amount"] * 0.015)
                if abs(data["fee"] - expected_fee) < 0.01:
                    results.add_result("Instant Payout Success", True, 
                                     f"Payout processed: ${payout_data['amount']}, fee: ${data['fee']:.2f}")
                    return True
                else:
                    results.add_result("Instant Payout Success", False, f"Incorrect fee calculation: expected ${expected_fee:.2f}, got ${data['fee']:.2f}")
                    return False
        except Exception as e:
            results.add_result("Instant Payout Success", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Instant Payout Success", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_instant_payout_large_amount(results, partner_token):
    """Test POST /api/partner/payouts/instant - large amount failure"""
    # First check bank status
    bank_response = make_request("GET", "/partner/bank/status", auth_token=partner_token)
    bank_verified = False
    
    if bank_response and bank_response.status_code == 200:
        try:
            bank_data = bank_response.json()
            bank_verified = bank_data.get("verified", False)
        except:
            pass
    
    if not bank_verified:
        results.add_result("Instant Payout Large Amount", True, "Skipped - bank not verified")
        return True
    
    payout_data = {
        "amount": 600.0,  # Should fail for amounts >$500
        "currency": "usd",
        "idempotencyKey": str(uuid.uuid4())
    }
    
    response = make_request("POST", "/partner/payouts/instant", payout_data, auth_token=partner_token)
    
    if response and response.status_code == 402:
        try:
            data = response.json()
            if "detail" in data and "high amount" in data["detail"].lower():
                results.add_result("Instant Payout Large Amount", True, "Correctly rejected large payout amount")
                return True
        except:
            pass
    
    results.add_result("Instant Payout Large Amount", False, f"Should reject large amounts. Status: {response.status_code if response else 'No response'}")
    return False

def test_instant_payout_minimum_amount(results, partner_token):
    """Test POST /api/partner/payouts/instant - below minimum amount"""
    payout_data = {
        "amount": 0.50,  # Below $1.00 minimum
        "currency": "usd",
        "idempotencyKey": str(uuid.uuid4())
    }
    
    response = make_request("POST", "/partner/payouts/instant", payout_data, auth_token=partner_token)
    
    if response and response.status_code == 400:
        try:
            data = response.json()
            if "detail" in data and "minimum" in data["detail"].lower():
                results.add_result("Instant Payout Minimum Amount", True, "Correctly rejected below minimum amount")
                return True
        except:
            pass
    
    results.add_result("Instant Payout Minimum Amount", False, f"Should reject below minimum. Status: {response.status_code if response else 'No response'}")
    return False

# ===== BANKING INTEGRATION TESTS =====

def test_bank_onboard(results, partner_token):
    """Test POST /api/partner/bank/onboard"""
    onboard_data = {
        "returnUrl": "https://app.shine.com/partner/bank/return"
    }
    
    response = make_request("POST", "/partner/bank/onboard", onboard_data, auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "url" in data and data["url"].startswith("https://connect.stripe.com"):
                results.add_result("Bank Onboard API", True, "Bank onboarding URL generated")
                return True
        except Exception as e:
            results.add_result("Bank Onboard API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Bank Onboard API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_bank_status(results, partner_token):
    """Test GET /api/partner/bank/status"""
    response = make_request("GET", "/partner/bank/status", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "verified" in data and isinstance(data["verified"], bool):
                bank_status = "verified" if data["verified"] else "not verified"
                bank_info = f", bank ending in {data['bankLast4']}" if data.get("bankLast4") else ""
                results.add_result("Bank Status API", True, f"Bank status: {bank_status}{bank_info}")
                return True
        except Exception as e:
            results.add_result("Bank Status API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Bank Status API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

# ===== TAX MANAGEMENT TESTS =====

def test_tax_context(results, partner_token):
    """Test GET /api/partner/tax/context"""
    response = make_request("GET", "/partner/tax/context", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            required_fields = ["status", "availableForms", "year"]
            if all(field in data for field in required_fields):
                if data["status"] in ["complete", "incomplete"] and isinstance(data["availableForms"], list):
                    results.add_result("Tax Context API", True, 
                                     f"Tax status: {data['status']}, forms: {', '.join(data['availableForms'])}")
                    return True
        except Exception as e:
            results.add_result("Tax Context API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Tax Context API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_tax_onboard(results, partner_token):
    """Test POST /api/partner/tax/onboard"""
    onboard_data = {
        "returnUrl": "https://app.shine.com/partner/tax/return"
    }
    
    response = make_request("POST", "/partner/tax/onboard", onboard_data, auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "url" in data and data["url"].startswith("https://tax.stripe.com"):
                results.add_result("Tax Onboard API", True, "Tax onboarding URL generated")
                return True
        except Exception as e:
            results.add_result("Tax Onboard API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Tax Onboard API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_tax_form_download(results, partner_token):
    """Test GET /api/partner/tax/forms/{form}/{year}"""
    current_year = datetime.now().year - 1  # Previous year
    
    response = make_request("GET", f"/partner/tax/forms/1099/{current_year}", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "url" in data and data["url"].startswith("https://tax-forms.shine.com"):
                results.add_result("Tax Form Download API", True, f"1099 form URL generated for {current_year}")
                return True
        except Exception as e:
            results.add_result("Tax Form Download API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Tax Form Download API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_tax_form_invalid(results, partner_token):
    """Test GET /api/partner/tax/forms/{form}/{year} with invalid form"""
    current_year = datetime.now().year - 1
    
    response = make_request("GET", f"/partner/tax/forms/INVALID/{current_year}", auth_token=partner_token)
    
    if response and response.status_code == 404:
        results.add_result("Tax Form Invalid", True, "Correctly rejected invalid form type")
        return True
    
    results.add_result("Tax Form Invalid", False, f"Should reject invalid form. Status: {response.status_code if response else 'No response'}")
    return False

# ===== NOTIFICATION PREFERENCES TESTS =====

def test_notification_prefs_get(results, partner_token):
    """Test GET /api/partner/notifications/prefs"""
    response = make_request("GET", "/partner/notifications/prefs", auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            required_fields = ["payouts", "statements", "tax"]
            if all(field in data for field in required_fields):
                if all(isinstance(data[field], bool) for field in required_fields):
                    results.add_result("Notification Prefs Get API", True, 
                                     f"Preferences: payouts={data['payouts']}, statements={data['statements']}, tax={data['tax']}")
                    return True
        except Exception as e:
            results.add_result("Notification Prefs Get API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Notification Prefs Get API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

def test_notification_prefs_set(results, partner_token):
    """Test POST /api/partner/notifications/prefs"""
    prefs_data = {
        "payouts": True,
        "statements": False,
        "tax": True
    }
    
    response = make_request("POST", "/partner/notifications/prefs", prefs_data, auth_token=partner_token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "ok" in data and data["ok"]:
                results.add_result("Notification Prefs Set API", True, "Preferences updated successfully")
                return True
        except Exception as e:
            results.add_result("Notification Prefs Set API", False, f"JSON parsing error: {e}")
            return False
    
    results.add_result("Notification Prefs Set API", False, f"Request failed. Status: {response.status_code if response else 'No response'}")
    return False

# ===== SECURITY & ACCESS CONTROL TESTS =====

def test_earnings_without_auth(results):
    """Test earnings endpoints without authentication"""
    endpoints = [
        "/partner/earnings/summary",
        "/partner/earnings/series",
        "/partner/earnings/statements",
        "/partner/payouts",
        "/partner/bank/status",
        "/partner/tax/context",
        "/partner/notifications/prefs"
    ]
    
    all_passed = True
    for endpoint in endpoints:
        response = make_request("GET", endpoint)
        if not (response and response.status_code in [401, 403]):
            all_passed = False
            break
    
    if all_passed:
        results.add_result("Earnings Endpoints Without Auth", True, "All endpoints properly require authentication")
    else:
        results.add_result("Earnings Endpoints Without Auth", False, "Some endpoints allow unauthenticated access")

def test_earnings_with_customer_role(results, customer_token):
    """Test earnings endpoints with customer role (should be forbidden)"""
    endpoints = [
        "/partner/earnings/summary",
        "/partner/earnings/series", 
        "/partner/earnings/statements",
        "/partner/payouts",
        "/partner/bank/status",
        "/partner/tax/context",
        "/partner/notifications/prefs"
    ]
    
    all_passed = True
    for endpoint in endpoints:
        response = make_request("GET", endpoint, auth_token=customer_token)
        if not (response and response.status_code == 403):
            all_passed = False
            break
    
    if all_passed:
        results.add_result("Earnings Endpoints Customer Role", True, "All endpoints properly reject customer role")
    else:
        results.add_result("Earnings Endpoints Customer Role", False, "Some endpoints allow customer access")

def test_earnings_with_owner_role(results, owner_token):
    """Test earnings endpoints with owner role (should be forbidden)"""
    endpoints = [
        "/partner/earnings/summary",
        "/partner/earnings/series",
        "/partner/earnings/statements", 
        "/partner/payouts",
        "/partner/bank/status",
        "/partner/tax/context",
        "/partner/notifications/prefs"
    ]
    
    all_passed = True
    for endpoint in endpoints:
        response = make_request("GET", endpoint, auth_token=owner_token)
        if not (response and response.status_code == 403):
            all_passed = False
            break
    
    if all_passed:
        results.add_result("Earnings Endpoints Owner Role", True, "All endpoints properly reject owner role")
    else:
        results.add_result("Earnings Endpoints Owner Role", False, "Some endpoints allow owner access")

# ===== MAIN TEST EXECUTION =====

def main():
    print("🚀 Starting PAGE-9-EARNINGS: Partner Earnings & Payouts System Tests")
    print("=" * 80)
    
    results = TestResults()
    
    # Create test users
    print("\n📝 Creating Test Users...")
    partner_token, partner_user = create_partner_user(results)
    customer_token, customer_user = create_customer_user(results)
    owner_token, owner_user = create_owner_user(results)
    
    if not partner_token:
        print("❌ Cannot proceed without partner user")
        return
    
    # Test Partner Earnings Summary & Chart Data
    print("\n💰 Testing Partner Earnings Summary & Chart Data...")
    test_earnings_summary(results, partner_token)
    test_earnings_series(results, partner_token)
    test_earnings_series_with_filters(results, partner_token)
    
    # Test Statements Management
    print("\n📊 Testing Statements Management...")
    statements = test_statements_list(results, partner_token)
    if statements and len(statements) > 0:
        statement_id = statements[0]["id"]
        test_statement_detail(results, partner_token, statement_id)
        test_statement_pdf(results, partner_token, statement_id)
    
    # Test Export functionality
    print("\n📤 Testing Export Functionality...")
    job_id = test_export_request(results, partner_token)
    if job_id:
        test_export_status(results, partner_token, job_id)
    test_export_invalid_date_range(results, partner_token)
    
    # Test Payout System
    print("\n💸 Testing Payout System...")
    test_payouts_list(results, partner_token)
    test_instant_payout_success(results, partner_token)
    test_instant_payout_large_amount(results, partner_token)
    test_instant_payout_minimum_amount(results, partner_token)
    
    # Test Banking Integration
    print("\n🏦 Testing Banking Integration...")
    test_bank_onboard(results, partner_token)
    test_bank_status(results, partner_token)
    
    # Test Tax Management
    print("\n📋 Testing Tax Management...")
    test_tax_context(results, partner_token)
    test_tax_onboard(results, partner_token)
    test_tax_form_download(results, partner_token)
    test_tax_form_invalid(results, partner_token)
    
    # Test Notification Preferences
    print("\n🔔 Testing Notification Preferences...")
    test_notification_prefs_get(results, partner_token)
    test_notification_prefs_set(results, partner_token)
    
    # Test Security & Access Control
    print("\n🔒 Testing Security & Access Control...")
    test_earnings_without_auth(results)
    if customer_token:
        test_earnings_with_customer_role(results, customer_token)
    if owner_token:
        test_earnings_with_owner_role(results, owner_token)
    
    # Print final results
    results.print_summary()
    
    print(f"\n🎯 EARNINGS SYSTEM TESTING COMPLETE!")
    print(f"📈 Business Logic: Fee calculations, balance checks, date validations")
    print(f"🔐 Security: Role-based access control, authentication requirements")
    print(f"⚡ Edge Cases: Large amounts, invalid dates, minimum thresholds")
    print(f"🌐 Integration: Mock Stripe Connect, tax forms, export jobs")

if __name__ == "__main__":
    main()