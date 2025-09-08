#!/bin/bash

# SHINE v1.0.0 - Expo Go Launch Script
# Automated setup and launch for mobile testing

echo "🚀 SHINE v1.0.0 - Expo Go Launch"
echo "================================="
echo ""

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the /app directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected to find: frontend/package.json"
    exit 1
fi

echo "✅ Directory check passed"

# Navigate to frontend
cd frontend

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
else
    echo "✅ .env file exists"
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"

# Check Yarn
if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn not found. Installing via npm..."
    npm install -g yarn
fi

YARN_VERSION=$(yarn --version)
echo "✅ Yarn version: $YARN_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
yarn install

# Check Expo CLI
if ! command -v expo &> /dev/null; then
    echo "📱 Installing Expo CLI..."
    npm install -g @expo/cli
fi

EXPO_VERSION=$(npx expo --version)
echo "✅ Expo CLI version: $EXPO_VERSION"

echo ""
echo "🎯 SHINE App Configuration:"
echo "   Name: SHINE"
echo "   Version: 1.0.0"
echo "   Environment: Staging"
echo "   Backend: $(grep EXPO_PUBLIC_BACKEND_URL .env | cut -d'=' -f2)"
echo ""

echo "📱 Starting Expo development server..."
echo "   - Make sure Expo Go is installed on your mobile device"
echo "   - Android: Download from Google Play Store"
echo "   - iOS: Download from App Store"
echo ""
echo "   Once the QR code appears:"
echo "   - Android: Open Expo Go app and scan QR code"
echo "   - iOS: Open Camera app, point at QR code, tap notification"
echo ""
echo "🚀 Launching in 3 seconds..."

sleep 3

# Start Expo with tunnel for better connectivity
yarn start --tunnel

echo ""
echo "✅ Expo Go session ended"
echo "📝 If you encountered issues, check EXPO_GO_INSTRUCTIONS.md"