#!/bin/bash
# Auto-deploy script - commits and pushes to trigger Vercel auto-deploy

set -e  # Exit on error

echo "🚀 Starting auto-deploy process..."
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
else
  # Commit with timestamp
  echo "💾 Committing changes..."
  git commit -m "Fix invite guide flow and prevent redirect loops - $(date '+%Y-%m-%d %H:%M:%S')" || {
    echo "❌ Commit failed"
    exit 1
  }
  echo "✅ Changes committed"
  echo ""
fi

# Check for remote
if git remote -v | grep -q .; then
  echo "✅ Git remote found: $(git remote get-url origin)"
  echo ""
  echo "📤 Pushing to remote to trigger Vercel auto-deploy..."
  git push origin main || git push origin master || {
    echo "❌ Push failed. Trying to push current branch..."
    CURRENT_BRANCH=$(git branch --show-current)
    git push origin "$CURRENT_BRANCH" || {
      echo "❌ Push failed. You may need to set up git remote or check branch name."
      exit 1
    }
  }
  echo "✅ Pushed to remote"
  echo ""
  echo "🎉 Done! Vercel should auto-deploy from the push."
  echo "   Check deployment status at: https://vercel.com/dashboard"
else
  echo "⚠️  No git remote configured"
  echo ""
  echo "💡 To set up auto-deploy:"
  echo "   1. Connect your repo to Vercel at https://vercel.com/dashboard"
  echo "   2. Vercel will auto-deploy on every push to main/master"
  echo ""
  echo "✅ Changes are committed locally and ready to push!"
fi
