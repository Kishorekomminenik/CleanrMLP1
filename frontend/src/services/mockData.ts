// Mock fixtures for E2E testing when USE_MOCK_FIXTURES=true
import { MockConfig } from '../styles/designSystem';

export const MockFixtures = {
  'GET /api/discovery/search': {
    items: [
      { 
        partnerId: "pa_101", 
        partnerName: "Sparkle Pros", 
        rating: 4.9, 
        badges: ["verified","eco"], 
        serviceTypes: ["Deep Clean","Bathroom-only"], 
        distanceKm: 2.3, 
        fromPrice: 89, 
        surge: true,
        fav: false
      },
      { 
        partnerId: "pa_102", 
        partnerName: "Shiny Homes", 
        rating: 4.7, 
        badges: ["verified"], 
        serviceTypes: ["Basic Clean"], 
        distanceKm: 4.8, 
        fromPrice: 59, 
        surge: false,
        fav: false
      }
    ],
    nextPage: null
  },

  'GET /api/partners/pa_101/profile': {
    partnerId: "pa_101",
    name: "Sparkle Pros",
    rating: 4.9,
    badges: ["verified","eco"],
    description: "Premium eco-friendly home cleaning.",
    photos: ["https://cdn.example.com/p/101-1.jpg","https://cdn.example.com/p/101-2.jpg"],
    services: [
      { serviceType: "Deep Clean", duration: 180 },
      { serviceType: "Bathroom-only", duration: 60 }
    ],
    fareCards: [
      { serviceType: "Deep Clean", fromPrice: 119, duration: 180 },
      { serviceType: "Bathroom-only", fromPrice: 49, duration: 60 }
    ],
    recentReviews: [
      { customerName: "A—", rating: 5, comment: "Amazing work!" },
      { customerName: "B—", rating: 5, comment: "On time and thorough." }
    ],
    status: "verified"
  },

  'POST /api/pricing/quote': {
    // Deep Clean with surge
    deepCleanSurge: {
      fare: { subtotal: 207, surgeMultiplier: 1.2, tax: 0, total: 248.4, currency: "USD" },
      breakdown: [
        { label: "Base", amount: 119 },
        { label: "Bedrooms x3", amount: 45 },
        { label: "Bathrooms x2", amount: 36 },
        { label: "Eco products", amount: 7 },
        { label: "Surge x1.2", amount: 41.4 }
      ],
      surge: { active: true, reason: "High demand in Urban Core", multiplier: 1.2 },
      estimateId: "EST-DC-0001",
      pricingEngineVersion: "v1-mock"
    },
    // Bathroom-only scheduled
    bathroomScheduled: {
      fare: { subtotal: 64, surgeMultiplier: 1.0, tax: 0, total: 64, currency: "USD" },
      breakdown: [
        { label: "Base", amount: 49 },
        { label: "Bathrooms x1", amount: 15 }
      ],
      surge: { active: false, multiplier: 1.0 },
      estimateId: "EST-BA-0002",
      pricingEngineVersion: "v1-mock"
    }
  },

  'POST /api/bookings': {
    bookingId: "bk_1001",
    status: "pending_dispatch",
    fare: { total: 248.4, currency: "USD" },
    reason: null
  },

  'GET /api/bookings/customer': {
    items: [
      { 
        bookingId: "bk_1001", 
        dateTime: "2025-09-07T16:45:00Z", 
        serviceType: "Deep Clean", 
        addressShort: "123 Pine St", 
        status: "completed", 
        price: 248.4, 
        currency: "USD", 
        surge: true, 
        promoApplied: false, 
        creditsUsed: false 
      }
    ],
    nextPage: null
  },

  'GET /api/bookings/bk_1001': {
    bookingId: "bk_1001",
    status: "completed",
    service: { serviceType: "deep", dwellingType: "House", bedrooms: 3, bathrooms: 2, masters: 1, addons: ["eco_products"] },
    address: { line1: "123 Pine St", city: "Springfield", postalCode: "94105", lat: 37.78, lng: -122.4 },
    partner: { id: "pa_101", name: "Ava P.", rating: 4.9, badges: ["verified","pro"] },
    customer: { id: "cu_1", firstNameInitial: "J", rating: 4.8 },
    timeline: [
      { ts: "2025-09-07T15:10:00Z", event: "created", label: "Booking created" },
      { ts: "2025-09-07T15:20:00Z", event: "assigned", label: "Partner assigned" },
      { ts: "2025-09-07T15:40:00Z", event: "arrived", label: "Partner arrived" },
      { ts: "2025-09-07T15:45:00Z", event: "start", label: "Job started" },
      { ts: "2025-09-07T16:35:00Z", event: "complete", label: "Job completed" }
    ],
    photos: { 
      before: ["https://cdn.example.com/bk_1001_b1.jpg"], 
      after: ["https://cdn.example.com/bk_1001_a1.jpg"] 
    },
    receipt: {
      breakdown: [
        { label: "Base", amount: 119 },
        { label: "Bedrooms x3", amount: 45 },
        { label: "Bathrooms x2", amount: 36 },
        { label: "Eco products", amount: 7 },
        { label: "Surge x1.2", amount: 41.4 }
      ],
      tax: 0,
      promo: 0,
      credits: 0,
      total: 248.4,
      currency: "USD"
    },
    policy: { cancellable: false, windowMins: 0, fee: 0, refundCreditEligible: false },
    pricingEngineVersion: "v1-mock"
  },

  'GET /api/bookings/bk_1001/invoice': { 
    url: "https://signed.example.com/invoice_bk_1001.pdf" 
  },

  'POST /api/partner/earnings/payout-calc': {
    fareTotal: 248.4,
    takeRatePercent: 75,
    surgeSharePercent: 75,
    payout: { 
      base: 186.3, 
      surgeShare: 31.05, 
      bonuses: 0, 
      total: 217.35, 
      currency: "USD" 
    }
  }
};

// Mock API service
export class MockApiService {
  static shouldUseMock(url: string): boolean {
    return MockConfig.enabled && this.hasMockFor(url);
  }

  static hasMockFor(url: string): boolean {
    const path = url.replace(MockConfig.backendUrl, '').split('?')[0];
    const method = 'GET'; // Default for most requests
    const key = `${method} ${path}`;
    return key in MockFixtures;
  }

  static getMockResponse(url: string, method: string = 'GET', body?: any): any {
    const path = url.replace(MockConfig.backendUrl, '').split('?')[0];
    const key = `${method} ${path}`;
    
    console.log(`[MOCK] ${key}`);
    
    // Handle specific cases
    if (key === 'POST /api/pricing/quote') {
      if (body?.serviceType === 'Deep Clean' && body?.timing?.when === 'now') {
        return MockFixtures['POST /api/pricing/quote'].deepCleanSurge;
      } else {
        return MockFixtures['POST /api/pricing/quote'].bathroomScheduled;
      }
    }
    
    return MockFixtures[key as keyof typeof MockFixtures] || null;
  }

  static async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const method = options.method || 'GET';
    const mockData = this.getMockResponse(url, method, options.body ? JSON.parse(options.body as string) : null);
    
    if (mockData) {
      return new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Fallback to actual fetch if no mock available
    return fetch(url, options);
  }
}

export default MockApiService;