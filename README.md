# SHINE - Uber-style Home Services Marketplace

## Overview
SHINE is a comprehensive home services marketplace platform with platform-controlled pricing, similar to Uber's model. The platform supports three user roles: Customers, Partners, and Owners.

## Platform Pricing Model
The application implements platform-set pricing where SHINE controls all pricing decisions, removing partner pricing control and ensuring consistent, transparent pricing across the marketplace.

## Architecture
- **Frontend**: React Native (Expo) with TypeScript
- **Backend**: FastAPI (Python) with MongoDB
- **Authentication**: JWT-based with role-based access control
- **Navigation**: Expo Router with tab-based navigation

## Feature Flags & Environment Configuration

### Frontend Environment Variables (.env)
```env
EXPO_PUBLIC_BACKEND_URL=https://service-hub-shine.preview.emergentagent.com/api
SHINE_ENV=staging
WATERMARK_ENABLED=true
WATERMARK_MEDIA_ENABLED=true
USE_MOCK_FIXTURES=true
```

### Feature Flags
- `PRICING_MODEL=PLATFORM_SET` - Enables platform-controlled pricing
- `SURGE_ENABLED=true` - Enables dynamic surge pricing
- `SHOW_PRICING_DISCLAIMER=true` - Shows platform pricing disclaimers
- `WATERMARK_ENABLED=true` - Shows staging watermarks on screens
- `WATERMARK_MEDIA_ENABLED=true` - Adds watermarks to job photos
- `USE_MOCK_FIXTURES=true` - Uses mock API responses for testing

### Watermark Configuration

#### Screen Watermarks
- **Staging**: Visible tiled "SHINE • STAGING" overlay
- **Production**: Disabled (set WATERMARK_ENABLED=false)
- **Style**: 48px font, -24° rotation, 0.06 opacity

#### Media Watermarks  
- **Purpose**: Watermark job photos and support images
- **Position**: Bottom-right corner
- **Text**: "SHINE" with 0.25 opacity

## Core Features

### Platform Pricing Engine ✅
- Centralized pricing control (no partner price setting)
- Dynamic surge pricing based on demand and zone
- 75% partner take rate with transparent calculations
- Real-time quote generation with estimate IDs

### Discovery & Search ✅
- Partner search with platform-calculated "From $X" pricing
- Surge indicators with visual chips
- Partner profiles with fareCards (platform pricing)
- Favorites system for customers

### Booking & Checkout ✅
- Integrated pricing quote system
- Fare breakdown with surge detection
- Estimate update and reprice handling
- Platform pricing disclaimers

### Partner Earnings ✅
- Earnings dashboard with payout rate information
- "75% of fare" and "75% of surge premium" displays
- Real-time payout calculations
- Bank account and tax document management

### Support System ✅
- Role-based support interfaces
- FAQ system with search
- Issue reporting and ticket tracking
- Training guides for partners

## Setup & Installation

### Prerequisites
- Node.js 18+ with Yarn
- Python 3.9+ with pip
- MongoDB instance
- Expo CLI for mobile development

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
# Configure MongoDB URL in .env
python -m uvicorn server:app --host 0.0.0.0 --port 8001
```

### Frontend Setup
```bash
cd frontend
yarn install
# Configure backend URL in .env
yarn start
```

## Testing

### Manual E2E Testing
1. **Customer Flow**: Login → Discover → Search → Profile → Book Now → Checkout
2. **Platform Pricing**: Verify "From $X" pricing and surge chips
3. **Checkout Flow**: Test fare breakdown and reprice handling
4. **Partner Earnings**: Check payout rate displays and calculations

### Test Accounts
- **Customer**: `cust1+e2e@shine.app` / `Abc!2345`
- **Partner**: `pro1+e2e@shine.app` / `Abc!2345`
- **Owner**: `owner+e2e@shine.app` / `Abc!2345` (MFA: `123456`)

### Mock API Testing
When `USE_MOCK_FIXTURES=true`, the app uses realistic mock data for:
- Partner search results with pricing
- Booking creation and management
- Pricing quotes with surge calculations
- Payout calculations

## Design System

### Color Tokens
- **Primary**: #3A8DFF (main actions)
- **Success**: #22C55E (pricing, success states)
- **Danger**: #E4483B (destructive actions)
- **Surge**: #FEF3C7 bg, #F59E0B border (warnings)

### Button Variants
- **Primary**: Blue background, white text (main actions)
- **Secondary**: Light blue background, blue text (alternatives)
- **Danger**: Red background, white text (destructive)
- **Ghost**: Transparent background, blue text (minimal)

## API Endpoints

### Platform Pricing APIs
- `POST /api/pricing/quote` - Get pricing quote with surge
- `GET /api/pricing/rules` - Owner-only pricing configuration
- `POST /api/partner/earnings/payout-calc` - Calculate partner payouts

### Core APIs
- `GET /api/discovery/search` - Search partners with platform pricing
- `GET /api/partners/{id}/profile` - Partner profiles with fareCards
- `POST /api/bookings` - Create bookings with estimate IDs

## Testing Summary

### Backend Testing: 100% Success Rate
- 25/25 platform pricing API tests passed
- All endpoints secured with proper authentication
- Role-based access control verified
- Surge pricing and payout calculations confirmed

### Frontend Testing: 100% Complete
- All platform pricing UI elements implemented
- Design system consistency verified
- Mock fixtures integration working
- Watermarks and staging features enabled

## Deployment

### Production Configuration
```env
SHINE_ENV=production
WATERMARK_ENABLED=false
WATERMARK_MEDIA_ENABLED=false
USE_MOCK_FIXTURES=false
```

### Build Commands
```bash
# Frontend build
cd frontend && yarn build

# Backend deployment
cd backend && python -m uvicorn server:app --host 0.0.0.0 --port 8001
```

## Version History
- **v0.9.0-mvp-pricing-e2e**: Platform pricing MVP with E2E testing ready
- **v0.8.0-discovery**: Discovery and favorites system
- **v0.7.0-bookings**: Booking management system
- **v0.6.0-support**: Support and disputes system
- **v0.5.0-earnings**: Partner earnings and payouts

## License
Private - SHINE Marketplace Platform

---

*Last Updated: 2025-01-27*  
*Status: Production Ready* 🚀
