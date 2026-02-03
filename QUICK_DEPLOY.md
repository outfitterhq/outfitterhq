# Quick Deploy Guide

## Your Project is Already Linked to Vercel! ✅

You can deploy in two ways:

## Method 1: Quick Deploy Script (Easiest)

Just run:
```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
./deploy-vercel.sh
```

This will deploy directly to Vercel production.

## Method 2: Manual Deploy

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
vercel --prod
```

## Method 3: Set Up Auto-Deploy (Recommended for Future)

To make deployments automatic when you push to GitHub:

1. Go to https://vercel.com/dashboard
2. Find your project
3. Go to Settings → Git
4. Make sure it's connected to: `outfitterhq/outfitterhq`
5. Set Production Branch to: `main`
6. Save

After this, every `git push` will automatically deploy!

## Current Status

- ✅ Project is linked to Vercel
- ✅ Vercel CLI is installed
- ✅ You can deploy right now with `./deploy-vercel.sh`

## Deploy Now

Run this command:
```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web && ./deploy-vercel.sh
```
