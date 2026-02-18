# Vercel Deployment Guide

## Quick Deploy

The easiest way to deploy is using the deployment script:

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
./deploy-vercel.sh
```

Or manually:

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
vercel --prod
```

## Required Environment Variables

Before deploying, make sure these environment variables are set in your Vercel project:

### Required Variables

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://xxxxx.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Your Supabase anonymous/public key
   - Found in Supabase Dashboard → Settings → API

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Your Supabase service role key (for admin operations)
   - Found in Supabase Dashboard → Settings → API
   - ⚠️ Keep this secret - never expose in client code

### Optional but Recommended Variables

4. **NEXT_PUBLIC_APP_URL** (or **NEXT_PUBLIC_WEB_APP_URL**)
   - Your production Vercel URL
   - Example: `https://outfitterhq.vercel.app`
   - Used for generating invite links and absolute URLs

5. **STRIPE_SECRET_KEY** (if using Stripe)
   - Your Stripe secret key for server-side operations
   - Found in Stripe Dashboard → Developers → API keys

6. **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** (if using Stripe)
   - Your Stripe publishable key for client-side operations

## Setting Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Name**: The variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: The actual value
   - **Environment**: Select which environments (Production, Preview, Development)
5. Click **Save**

## Deployment Steps

### First Time Setup

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   # or
   brew install vercel-cli
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Link your project** (if not already linked):
   ```bash
   cd /Users/williamsorrell/Desktop/G3/huntco-web
   vercel link
   ```
   - Select your existing project or create a new one
   - Follow the prompts

4. **Set environment variables** in Vercel dashboard (see above)

5. **Deploy**:
   ```bash
   ./deploy-vercel.sh
   # or
   vercel --prod
   ```

### Subsequent Deployments

Just run:
```bash
./deploy-vercel.sh
```

Or if you have auto-deploy set up (recommended), just push to your main branch:
```bash
git push origin main
```

## Setting Up Auto-Deploy (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Git**
4. Connect your GitHub repository if not already connected
5. Set **Production Branch** to `main` (or your preferred branch)
6. Save

Now every push to `main` will automatically trigger a deployment!

## Build Settings

Vercel should auto-detect Next.js, but verify these settings:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (or `next build`)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)
- **Node Version**: 18.x or 20.x (recommended)

## Troubleshooting

### Build Fails

1. **Check environment variables**:
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Ensure all required variables are set
   - Make sure they're set for the correct environment (Production/Preview)

2. **Check build logs**:
   - Go to Vercel Dashboard → Deployments
   - Click on the failed deployment
   - Check the build logs for errors

3. **Common issues**:
   - Missing environment variables
   - TypeScript errors
   - Missing dependencies

### Runtime Errors

1. **Check function logs**:
   - Go to Vercel Dashboard → Deployments
   - Click on your deployment
   - Check "Functions" tab for serverless function logs

2. **Check environment variables**:
   - Make sure `NEXT_PUBLIC_*` variables are set (these are needed at build time)
   - Make sure server-side variables are set (like `SUPABASE_SERVICE_ROLE_KEY`)

### Environment Variables Not Working

- **NEXT_PUBLIC_*** variables must be set before building
- After adding new `NEXT_PUBLIC_*` variables, you need to redeploy
- Server-side variables (without `NEXT_PUBLIC_`) are available at runtime

## Post-Deployment Checklist

- [ ] Verify the site loads at your Vercel URL
- [ ] Test login functionality
- [ ] Test API routes
- [ ] Check that environment variables are working
- [ ] Verify Supabase connection
- [ ] Test file uploads (if applicable)
- [ ] Check that cookies are working (for auth)

## Current Deployment Status

Based on your project structure:
- ✅ Deployment script exists (`deploy-vercel.sh`)
- ✅ Next.js configuration is set up
- ✅ Package.json has build scripts
- ⚠️ Make sure environment variables are set in Vercel

## Quick Reference

```bash
# Deploy to production
./deploy-vercel.sh

# Deploy to preview
vercel

# Check deployment status
vercel ls

# View logs
vercel logs
```

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables are set
3. Check Next.js build output locally: `npm run build`
4. Review Vercel documentation: https://vercel.com/docs
