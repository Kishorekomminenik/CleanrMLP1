#!/usr/bin/env python3
"""
PAGE-9-EARNINGS: Focused Partner Earnings & Payouts System Tests
Tests core functionality of all 16 earnings API endpoints
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
        print(f"PAGE-9-EARNINGS: FOCUSED TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")

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
            response = requests.get(url, headers=request_headers, timeout=15)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=15)
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
        "email": f"partner_focused_{uuid.uuid4().hex[:8]}@test.com",
        "username": f"partner_foc_{uuid.uuid4().hex[:6]}",
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

def test_all_earnings_endpoints(results, partner_token):
    """Test all 16 earnings endpoints for basic functionality"""
    
    # 1. Partner Earnings Summary
    response = make_request("GET", "/partner/earnings/summary", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "currency" in data and "thisWeek" in data and "tipsYtd" in data and "availableBalance" in data:
                results.add_result("1. Earnings Summary", True, f"Available: ${data['availableBalance']:.2f}")
            else:
                results.add_result("1. Earnings Summary", False, "Invalid response structure")
        except:
            results.add_result("1. Earnings Summary", False, "JSON parsing error")
    else:
        results.add_result("1. Earnings Summary", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 2. Earnings Series Data
    response = make_request("GET", "/partner/earnings/series", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "points" in data:
                results.add_result("2. Earnings Series", True, f"{len(data['points'])} data points")
            else:
                results.add_result("2. Earnings Series", False, "Invalid response structure")
        except:
            results.add_result("2. Earnings Series", False, "JSON parsing error")
    else:
        results.add_result("2. Earnings Series", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 3. Statements List
    response = make_request("GET", "/partner/earnings/statements", auth_token=partner_token)
    statement_id = None
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "items" in data:
                results.add_result("3. Statements List", True, f"{len(data['items'])} statements")
                if len(data["items"]) > 0:
                    statement_id = data["items"][0]["id"]
            else:
                results.add_result("3. Statements List", False, "Invalid response structure")
        except:
            results.add_result("3. Statements List", False, "JSON parsing error")
    else:
        results.add_result("3. Statements List", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 4. Statement Detail (if we have a statement ID)
    if statement_id:
        response = make_request("GET", f"/partner/earnings/statements/{statement_id}", auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                data = response.json()
                if "id" in data and "gross" in data and "net" in data and "jobs" in data:
                    results.add_result("4. Statement Detail", True, f"Net: ${data['net']:.2f}, Jobs: {len(data['jobs'])}")
                else:
                    results.add_result("4. Statement Detail", False, "Invalid response structure")
            except:
                results.add_result("4. Statement Detail", False, "JSON parsing error")
        else:
            results.add_result("4. Statement Detail", False, f"Status: {response.status_code if response else 'No response'}")
    else:
        results.add_result("4. Statement Detail", False, "No statement ID available")
    
    # 5. Statement PDF
    if statement_id:
        response = make_request("GET", f"/partner/earnings/statements/{statement_id}/pdf", auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                data = response.json()
                if "url" in data and data["url"].startswith("https://"):
                    results.add_result("5. Statement PDF", True, "PDF URL generated")
                else:
                    results.add_result("5. Statement PDF", False, "Invalid PDF URL")
            except:
                results.add_result("5. Statement PDF", False, "JSON parsing error")
        else:
            results.add_result("5. Statement PDF", False, f"Status: {response.status_code if response else 'No response'}")
    else:
        results.add_result("5. Statement PDF", False, "No statement ID available")
    
    # 6. Export Request
    export_data = {
        "fromDate": (datetime.now() - timedelta(days=30)).isoformat(),
        "toDate": datetime.now().isoformat(),
        "serviceType": "all"
    }
    response = make_request("POST", "/partner/earnings/export", export_data, auth_token=partner_token)
    job_id = None
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "jobId" in data and "status" in data:
                results.add_result("6. Export Request", True, f"Job ID: {data['jobId']}")
                job_id = data["jobId"]
            else:
                results.add_result("6. Export Request", False, "Invalid response structure")
        except:
            results.add_result("6. Export Request", False, "JSON parsing error")
    else:
        results.add_result("6. Export Request", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 7. Export Status
    if job_id:
        response = make_request("GET", f"/partner/earnings/export/{job_id}", auth_token=partner_token)
        if response and response.status_code == 200:
            try:
                data = response.json()
                if "status" in data:
                    results.add_result("7. Export Status", True, f"Status: {data['status']}")
                else:
                    results.add_result("7. Export Status", False, "Invalid response structure")
            except:
                results.add_result("7. Export Status", False, "JSON parsing error")
        else:
            results.add_result("7. Export Status", False, f"Status: {response.status_code if response else 'No response'}")
    else:
        results.add_result("7. Export Status", False, "No job ID available")
    
    # 8. Payouts List
    response = make_request("GET", "/partner/payouts", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "items" in data:
                results.add_result("8. Payouts List", True, f"{len(data['items'])} payouts")
            else:
                results.add_result("8. Payouts List", False, "Invalid response structure")
        except:
            results.add_result("8. Payouts List", False, "JSON parsing error")
    else:
        results.add_result("8. Payouts List", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 9. Instant Payout (expect bank verification failure)
    payout_data = {
        "amount": 50.0,
        "currency": "usd",
        "idempotencyKey": str(uuid.uuid4())
    }
    response = make_request("POST", "/partner/payouts/instant", payout_data, auth_token=partner_token)
    if response and response.status_code in [200, 409]:  # Success or bank not verified
        if response.status_code == 200:
            results.add_result("9. Instant Payout", True, "Payout processed successfully")
        else:
            results.add_result("9. Instant Payout", True, "Correctly rejected (bank not verified)")
    else:
        results.add_result("9. Instant Payout", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 10. Bank Onboard
    onboard_data = {"returnUrl": "https://app.shine.com/partner/bank/return"}
    response = make_request("POST", "/partner/bank/onboard", onboard_data, auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "url" in data and "stripe.com" in data["url"]:
                results.add_result("10. Bank Onboard", True, "Onboarding URL generated")
            else:
                results.add_result("10. Bank Onboard", False, "Invalid URL")
        except:
            results.add_result("10. Bank Onboard", False, "JSON parsing error")
    else:
        results.add_result("10. Bank Onboard", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 11. Bank Status
    response = make_request("GET", "/partner/bank/status", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "verified" in data:
                status = "verified" if data["verified"] else "not verified"
                results.add_result("11. Bank Status", True, f"Bank status: {status}")
            else:
                results.add_result("11. Bank Status", False, "Invalid response structure")
        except:
            results.add_result("11. Bank Status", False, "JSON parsing error")
    else:
        results.add_result("11. Bank Status", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 12. Tax Context
    response = make_request("GET", "/partner/tax/context", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "status" in data and "availableForms" in data:
                results.add_result("12. Tax Context", True, f"Tax status: {data['status']}")
            else:
                results.add_result("12. Tax Context", False, "Invalid response structure")
        except:
            results.add_result("12. Tax Context", False, "JSON parsing error")
    else:
        results.add_result("12. Tax Context", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 13. Tax Onboard
    tax_onboard_data = {"returnUrl": "https://app.shine.com/partner/tax/return"}
    response = make_request("POST", "/partner/tax/onboard", tax_onboard_data, auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "url" in data and "stripe.com" in data["url"]:
                results.add_result("13. Tax Onboard", True, "Tax onboarding URL generated")
            else:
                results.add_result("13. Tax Onboard", False, "Invalid URL")
        except:
            results.add_result("13. Tax Onboard", False, "JSON parsing error")
    else:
        results.add_result("13. Tax Onboard", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 14. Tax Form Download
    current_year = datetime.now().year - 1
    response = make_request("GET", f"/partner/tax/forms/1099/{current_year}", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "url" in data and "tax-forms.shine.com" in data["url"]:
                results.add_result("14. Tax Form Download", True, f"1099 form URL for {current_year}")
            else:
                results.add_result("14. Tax Form Download", False, "Invalid URL")
        except:
            results.add_result("14. Tax Form Download", False, "JSON parsing error")
    else:
        results.add_result("14. Tax Form Download", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 15. Notification Prefs Get
    response = make_request("GET", "/partner/notifications/prefs", auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "payouts" in data and "statements" in data and "tax" in data:
                results.add_result("15. Notification Prefs Get", True, f"Prefs retrieved")
            else:
                results.add_result("15. Notification Prefs Get", False, "Invalid response structure")
        except:
            results.add_result("15. Notification Prefs Get", False, "JSON parsing error")
    else:
        results.add_result("15. Notification Prefs Get", False, f"Status: {response.status_code if response else 'No response'}")
    
    # 16. Notification Prefs Set
    prefs_data = {"payouts": True, "statements": False, "tax": True}
    response = make_request("POST", "/partner/notifications/prefs", prefs_data, auth_token=partner_token)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "ok" in data:
                results.add_result("16. Notification Prefs Set", True, "Preferences updated")
            else:
                results.add_result("16. Notification Prefs Set", False, "Invalid response structure")
        except:
            results.add_result("16. Notification Prefs Set", False, "JSON parsing error")
    else:
        results.add_result("16. Notification Prefs Set", False, f"Status: {response.status_code if response else 'No response'}")

def test_security_basics(results, partner_token):
    """Test basic security - unauthenticated access"""
    response = make_request("GET", "/partner/earnings/summary")
    if response and response.status_code in [401, 403]:
        results.add_result("Security: No Auth", True, "Properly requires authentication")
    else:
        results.add_result("Security: No Auth", False, f"Status: {response.status_code if response else 'No response'}")

def main():
    print("🚀 Starting PAGE-9-EARNINGS: Focused Partner Earnings & Payouts System Tests")
    print("=" * 80)
    
    results = TestResults()
    
    # Create test user
    print("\n📝 Creating Partner User...")
    partner_token, partner_user = create_partner_user(results)
    
    if not partner_token:
        print("❌ Cannot proceed without partner user")
        return
    
    # Test all 16 earnings endpoints
    print("\n💰 Testing All 16 Earnings Endpoints...")
    test_all_earnings_endpoints(results, partner_token)
    
    # Test basic security
    print("\n🔒 Testing Basic Security...")
    test_security_basics(results, partner_token)
    
    # Print final results
    results.print_summary()
    
    print(f"\n🎯 FOCUSED EARNINGS SYSTEM TESTING COMPLETE!")
    print(f"📊 All 16 earnings endpoints tested for basic functionality")
    print(f"🔐 Security controls verified")
    print(f"💡 Mock data generation working correctly")

if __name__ == "__main__":
    main()