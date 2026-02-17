#!/bin/bash
# ═══════════════════════════════════════
# Ceptra AI — Mobile App Build Script
# ═══════════════════════════════════════
set -e

echo "🚀 Ceptra AI — Mobile Build"
echo "═══════════════════════════"

# Check requirements
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required. Install: brew install node"; exit 1; }

# Step 1: Install Capacitor if not present
if [ ! -d "node_modules/@capacitor" ]; then
  echo "📦 Installing Capacitor..."
  npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android \
    @capacitor/status-bar @capacitor/splash-screen @capacitor/keyboard \
    @capacitor/haptics @capacitor/share
fi

# Step 2: Build static site for mobile
echo ""
echo "🔨 Building static site..."
BUILD_MOBILE=true npx next build

# Step 3: Add platforms if needed
echo ""
if [ ! -d "ios" ]; then
  echo "📱 Adding iOS platform..."
  npx cap add ios
fi

if [ ! -d "android" ]; then
  echo "🤖 Adding Android platform..."
  npx cap add android
fi

# Step 4: Sync web assets to native
echo "🔄 Syncing..."
npx cap sync

echo ""
echo "✅ Build complete!"
echo ""
echo "📱 Open in Xcode:      npx cap open ios"
echo "🤖 Open in Android:    npx cap open android"
echo ""
echo "🌐 The app connects to: https://ceptra-ai.vercel.app/api"
echo "   Change this in Settings (⚙️) inside the app."
