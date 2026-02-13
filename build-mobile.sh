#!/bin/bash
# ═══════════════════════════════════════
# Ceptra AI — Mobile App Build Script
# Builds iOS and Android apps using Capacitor
# ═══════════════════════════════════════

set -e

echo "🚀 Ceptra AI — Mobile Build"
echo "═══════════════════════════"

# Check requirements
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required. Install: brew install node"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "❌ npx required"; exit 1; }

# Step 1: Install Capacitor
echo ""
echo "📦 Installing Capacitor..."
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android \
  @capacitor/status-bar @capacitor/splash-screen @capacitor/keyboard \
  @capacitor/haptics @capacitor/share

# Step 2: Build static site
echo ""
echo "🔨 Building static site for mobile..."
BUILD_MOBILE=true npm run build

# Step 3: Initialize Capacitor platforms
echo ""
echo "📱 Adding iOS and Android platforms..."

# Only add if not already added
if [ ! -d "ios" ]; then
  npx cap add ios
  echo "✅ iOS platform added"
else
  echo "ℹ️  iOS platform already exists"
fi

if [ ! -d "android" ]; then
  npx cap add android
  echo "✅ Android platform added"
else
  echo "ℹ️  Android platform already exists"
fi

# Step 4: Sync
echo ""
echo "🔄 Syncing web app to native platforms..."
npx cap sync

echo ""
echo "═══════════════════════════════════════"
echo "✅ Mobile build complete!"
echo ""
echo "📱 To open in Xcode (iOS):"
echo "   npx cap open ios"
echo ""
echo "🤖 To open in Android Studio:"
echo "   npx cap open android"
echo ""
echo "⚡ After making web changes:"
echo "   BUILD_MOBILE=true npm run build && npx cap sync"
echo ""
echo "🔑 IMPORTANT: For the mobile app, you need a backend server."
echo "   Option A: Run Ceptra on your Mac (local WiFi)"
echo "   Option B: Deploy to Vercel/Railway with cloud API keys"
echo "   Set the server URL in the app's settings."
echo "═══════════════════════════════════════"
