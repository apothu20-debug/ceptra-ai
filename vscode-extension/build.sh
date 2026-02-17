#!/bin/bash
# ═══════════════════════════════════════
# Ceptra AI — VS Code Extension Builder
# ═══════════════════════════════════════
set -e

echo "🔌 Ceptra AI — VS Code Extension"
echo "═══════════════════════════════════"

cd "$(dirname "$0")"

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Compile TypeScript
echo "🔨 Compiling..."
mkdir -p out
npx tsc -p ./

# Step 3: Package as .vsix
echo "📦 Packaging extension..."
if ! command -v vsce &> /dev/null; then
  echo "Installing vsce..."
  npm install -g @vscode/vsce
fi

vsce package --allow-missing-repository

echo ""
echo "✅ Extension built!"
echo ""
echo "📁 File: $(ls *.vsix)"
echo ""
echo "To install in VS Code:"
echo "  code --install-extension $(ls *.vsix)"
echo ""
echo "Or drag the .vsix file into VS Code Extensions panel."
echo ""
echo "⚙️ Configure: VS Code Settings → search 'ceptra' → set Server URL"
echo "   Default: https://ceptra-ai.vercel.app"
echo "   Local:   http://localhost:3000"
