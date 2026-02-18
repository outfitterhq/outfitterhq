# 🚀 Deploy to Vercel - Quick Instructions

## Option 1: Deploy via Vercel Dashboard (Easiest)

1. Go to https://vercel.com/dashboard
2. Find your project (likely named "outfitterhq" or similar)
3. Click on the project
4. Go to the **Deployments** tab
5. Click **"Redeploy"** on the latest deployment
6. Or click **"Deploy"** button if available

## Option 2: Deploy via Terminal (If CLI works)

Run this command in your terminal:

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
vercel --prod
```

If you get permission errors, try:
```bash
sudo vercel --prod
```

## Option 3: Git Push (If Auto-Deploy is Set Up)

If you have auto-deploy enabled, just commit and push:

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
git add .
git commit -m "Fix guide hunts page and photo loading"
git push origin main
```

This will automatically trigger a deployment if auto-deploy is configured.

## Recent Changes to Deploy

✅ Fixed guide hunts page (removed fetch error)
✅ Fixed photo loading in iOS (better error handling)
✅ Added guide hunts view to web and iOS
✅ Fixed authentication handling

## Verify Deployment

After deployment, check:
1. Visit your Vercel URL
2. Test the guide hunts page: `/guides/[id]/hunts`
3. Verify photos load correctly
4. Check that authentication works

## Troubleshooting

If deployment fails:
1. Check Vercel Dashboard → Deployments for error logs
2. Verify all environment variables are set
3. Check build logs for TypeScript/compilation errors
