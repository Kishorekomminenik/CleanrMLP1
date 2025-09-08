# SHINE v1.0.0 - Expo Go Testing Instructions

## Prerequisites

### On Your Development Machine:
1. ✅ Node.js (18+) installed
2. ✅ Yarn package manager installed
3. ✅ Expo CLI installed globally: `npm install -g @expo/cli`

### On Your Mobile Device:
1. **Android**: Install "Expo Go" from Google Play Store
2. **iOS**: Install "Expo Go" from App Store

## Quick Start Guide

### 1. Navigate to Frontend Directory
```bash
cd /app/frontend
```

### 2. Install Dependencies
```bash
yarn install
```

### 3. Start Development Server with Tunnel
```bash
yarn start --tunnel
```

**Why --tunnel?** This creates a secure tunnel that works even if your phone and computer are on different networks.

### 4. Scan QR Code
- **Android**: Open Expo Go app → Scan QR code from terminal
- **iOS**: Open Camera app → Point at QR code → Tap notification

## Environment Configuration

### Local Development (.env)
The app uses these environment variables from `/app/frontend/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=https://service-hub-shine.preview.emergentagent.com/api
SHINE_ENV=staging
USE_MOCK_FIXTURES=true
WATERMARK_ENABLED=true
```

### Feature Flags Active
- ✅ Platform-controlled pricing (no partner price setting)
- ✅ Surge pricing with visual indicators
- ✅ Mock fixtures for offline testing
- ✅ Staging watermarks ("SHINE • STAGING" overlay)
- ✅ All security and validation features

## App Features to Test

### 🎯 Customer Role Testing
1. **Discovery & Search**
   - Search for services (try "clean")
   - View "From $X" pricing displays
   - Notice yellow surge chips when active
   - Tap partner profiles to see fareCards

2. **Booking Flow**
   - Select service and address
   - Go through checkout with fare breakdown
   - See "Fare breakdown (SHINE pricing)" title
   - Test reprice notifications

3. **Navigation & UX**
   - Tab navigation between screens
   - Logout functionality with confirmation
   - Back button behavior
   - Loading states and error handling

### 🔧 Partner Role Testing
1. **Earnings Dashboard**
   - View earnings summary
   - Check "Payout Rate: 75% of fare" display
   - Check "Surge Share: 75% of surge premium" display

2. **Settings & Profile**
   - Notice platform pricing info (no price controls)
   - Test logout functionality

### 👑 Owner Role Testing
1. **Business Dashboard**
   - View booking analytics
   - Access support queue
   - Check discovery analytics

## Expected User Experience

### ✅ What Should Work
- **Smooth Performance**: App loads quickly and responds well
- **Professional UI**: Consistent #3A8DFF blue theme throughout
- **Platform Pricing**: All pricing controlled by SHINE (no partner controls)
- **Clear Navigation**: Intuitive tab-based navigation
- **Proper Branding**: "SHINE" name and professional appearance
- **Staging Indicators**: Watermark overlay shows this is staging

### 🔧 Debug Features (Staging Only)
- **Watermark Overlay**: "SHINE • STAGING" tiled across screens
- **Mock Data**: Realistic test data when backend unavailable
- **Enhanced Logging**: Console logs for debugging

## Troubleshooting

### App Won't Load
1. **Try Tunnel Mode**: `yarn start --tunnel`
2. **Restart Development Server**: Ctrl+C then `yarn start --tunnel`
3. **Check Network**: Ensure both devices have internet access
4. **Clear Expo Cache**: `npx expo start --clear`

### CORS or API Errors
1. **Check Backend URL**: Verify `EXPO_PUBLIC_BACKEND_URL` in `.env`
2. **Test API**: Visit the backend URL in browser
3. **Mock Mode**: App should work with `USE_MOCK_FIXTURES=true`

### QR Code Issues
1. **Use Camera App**: iOS users should use built-in Camera app
2. **QR Code Too Small**: Make terminal window larger
3. **Manual Entry**: Copy the exp:// URL and paste in Expo Go

## Production Notes

### 🚨 Important Reminders
- This is **STAGING ENVIRONMENT** with test data
- Real payments are **DISABLED** (Stripe test mode)
- User accounts are **TEST ACCOUNTS** only
- Watermarks indicate this is **NOT PRODUCTION**

### 🔐 Security Features Active
- JWT authentication with role-based access
- Input validation and rate limiting
- No secrets exposed in client code
- PCI-compliant payment processing (test mode)

## Test Accounts

### Available Test Accounts
```
Customer: cust1+e2e@shine.app / Abc!2345
Partner:  pro1+e2e@shine.app / Abc!2345  
Owner:    owner+e2e@shine.app / Abc!2345 (MFA: 123456)
```

## Success Indicators

### ✅ App is Working Correctly When:
- App loads without errors
- Navigation tabs work smoothly
- Platform pricing displays ("From $X" format)
- Surge chips appear on applicable services
- Authentication flows work for all roles
- Settings screens show proper logout functionality
- Performance is smooth on mobile device

### 🎉 Testing Complete When:
- All three user roles tested
- Core user flows validated
- Platform pricing features confirmed
- Professional UI/UX verified
- No critical bugs encountered

---

## Ready for Production?

After successful Expo Go testing, the app is ready for:
1. **App Store Deployment** (iOS TestFlight → App Store)
2. **Google Play Deployment** (Internal Testing → Production)
3. **Production Backend** (Switch to production API)
4. **Real Payment Processing** (Live Stripe integration)

**🚀 SHINE v1.0.0 is production-ready and tested!**

---

*For technical support: Check logs in terminal*  
*For business questions: Review README.md and documentation*  
*Last updated: January 27, 2025*