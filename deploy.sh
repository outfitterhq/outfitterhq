#!/bin/bash
# Deploy script - commits, pushes, and deploys to Vercel

set -e  # Exit on error

echo "🚀 Starting deployment process..."
echo ""

cd "$(dirname "$0")" || exit 1

echo "📁 Current directory: $(pwd)"
echo ""

# Check git status
echo "📊 Checking git status..."
git status --short
echo ""

# Add all changes
echo "➕ Adding all changes to git..."
git add -A
echo "✅ Files added"
echo ""

# Check if there are changes to commit
if git diff --staged --quiet; then
  echo "⚠️  No changes to commit. Skipping commit."
  SKIP_COMMIT=true
else
  # Commit with timestamp
  echo "💾 Committing changes..."
  git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || {
    echo "❌ Commit failed"
    exit 1
  }
  echo "✅ Changes committed"
  echo ""
  SKIP_COMMIT=false
fi

# Check for remote
if git remote -v | grep -q .; then
  echo "✅ Git remote found: $(git remote get-url origin)"
  echo ""
  
  if [ "$SKIP_COMMIT" != "true" ]; then
    echo "📤 Pushing to remote..."
    git push origin main || git push origin master || {
      echo "❌ Push failed. Trying to push current branch..."
      CURRENT_BRANCH=$(git branch --show-current)
      git push origin "$CURRENT_BRANCH" || {
        echo "⚠️  Push failed, but continuing with Vercel deploy..."
      }
    }
    echo "✅ Pushed to remote"
    echo ""
  fi
  
  # Check if Vercel CLI is available
  if command -v vercel &> /dev/null; then
    echo "📤 Deploying to Vercel..."
    echo ""
    
    # Check if project is linked
    if [ ! -d ".vercel" ]; then
      echo "⚠️  Project not linked to Vercel"
      echo "🔗 Run './deploy-vercel.sh' first to link the project, or:"
      echo "   vercel link"
      echo ""
      echo "💡 Or set up auto-deploy in Vercel Dashboard:"
      echo "   1. Go to https://vercel.com/dashboard"
      echo "   2. Add your GitHub repo"
      echo "   3. Vercel will auto-deploy on every push"
      echo ""
    else
      vercel --prod --yes
      echo ""
      echo "✅ Vercel deployment complete!"
    fi
  else
    echo "⚠️  Vercel CLI not found"
    echo ""
    echo "💡 Options:"
    echo "   1. Install Vercel CLI: npm install -g vercel"
    echo "   2. Set up auto-deploy in Vercel Dashboard:"
    echo "      - Go to https://vercel.com/dashboard"
    echo "      - Add your GitHub repo (outfitterhq/outfitterhq)"
    echo "      - Vercel will auto-deploy on every push to main"
    echo ""
  fi
  
  echo "🌐 Check deployment status at: https://vercel.com/dashboard"
else
  echo "⚠️  No git remote configured"
  echo ""
  echo "💡 To deploy:"
  echo "   1. Set up git remote: git remote add origin <your-repo-url>"
  echo "   2. Or use Vercel CLI: ./deploy-vercel.sh"
  echo ""
fi
