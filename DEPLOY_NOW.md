# 🚀 Deploy to Vercel - Quick Start

## Step 1: Set Environment Variables in Vercel

Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

Add these **REQUIRED** variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Optional but recommended:**
```
NEXT_PUBLIC_APP_URL=https://outfitterhq.vercel.app
STRIPE_SECRET_KEY=sk_... (if using Stripe)
STRIPE_WEBHOOK_SECRET=whsec_... (if using Stripe)
```

⚠️ **Important**: After adding environment variables, you MUST redeploy for them to take effect.

## Step 2: Deploy

### Option A: Use the Script (Easiest)
```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
./deploy-vercel.sh
```

### Option B: Manual Deploy
```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
vercel --prod
```

### Option C: Auto-Deploy (Set up once, then just push)
1. Connect your GitHub repo in Vercel Dashboard → Settings → Git
2. Set Production Branch to `main`
3. Then just: `git push origin main`

## Step 3: Verify

After deployment:
1. Visit your Vercel URL
2. Test login
3. Check that API routes work
4. Verify Supabase connection

## Troubleshooting

**Build fails?**
- Check all environment variables are set
- Check build logs in Vercel Dashboard

**Runtime errors?**
- Check function logs in Vercel Dashboard
- Verify environment variables are set for Production environment

**Need help?**
- See `VERCEL_DEPLOYMENT.md` for detailed guide
- Check Vercel logs: `vercel logs`

## Current Status

✅ Deployment script ready
✅ Next.js configured
✅ Build commands set
⚠️ **Set environment variables before deploying!**
