#!/bin/bash
# Deploy to Vercel using Vercel CLI

set -e  # Exit on error

echo "🚀 Starting Vercel deployment..."
echo ""

cd "$(dirname "$0")" || exit 1

echo "📁 Current directory: $(pwd)"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo "❌ Vercel CLI is not installed"
  echo ""
  echo "💡 Install it with:"
  echo "   npm install -g vercel"
  echo "   or"
  echo "   brew install vercel-cli"
  exit 1
fi

echo "✅ Vercel CLI found: $(which vercel)"
echo ""

# Check if project is linked
if [ ! -d ".vercel" ]; then
  echo "⚠️  Project not linked to Vercel"
  echo ""
  echo "🔗 Linking project to Vercel..."
  echo "   (You may need to login and select your project)"
  vercel link
  echo ""
fi

# Deploy to production
echo "📤 Deploying to Vercel production..."
echo ""

vercel --prod --yes

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Check your deployment at: https://vercel.com/dashboard"
echo ""
