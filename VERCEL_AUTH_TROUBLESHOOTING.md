# Vercel Authentication Stuck - Troubleshooting Guide

## Quick Fixes

### 1. Check Environment Variables in Vercel

The app requires these environment variables to be set in Vercel:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**To check:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `outfitterhq`
3. Go to **Settings** → **Environment Variables**
4. Verify both variables are set for **Production** environment
5. If missing, add them and **redeploy**

### 2. Check Build Logs

If the build is stuck:
1. Go to Vercel Dashboard → Deployments
2. Click on the stuck/failed deployment
3. Check the **Build Logs** tab
4. Look for errors like:
   - "Missing NEXT_PUBLIC_SUPABASE_URL"
   - "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY"
   - Authentication errors

### 3. Force Redeploy

If environment variables are set but deployment is stuck:

1. **Cancel the stuck deployment:**
   - Go to Vercel Dashboard → Deployments
   - Click on the stuck deployment
   - Click "Cancel" if available

2. **Redeploy:**
   ```bash
   cd /Users/williamsorrell/Desktop/G3/huntco-web
   git commit --allow-empty -m "Force redeploy"
   git push origin main
   ```

   Or trigger manually:
   - Go to Vercel Dashboard → Deployments
   - Click "Redeploy" on the latest deployment

### 4. Check Vercel Project Settings

1. Go to Vercel Dashboard → Your Project → Settings
2. Check **Build & Development Settings**:
   - Framework Preset: Should be "Next.js"
   - Build Command: Should be `npm run build` or `next build`
   - Output Directory: Should be `.next` (auto-detected)
   - Install Command: Should be `npm install`

3. Check **Environment Variables**:
   - Make sure variables are set for **Production** (not just Preview/Development)
   - After adding variables, you MUST redeploy

### 5. Common Issues

#### Issue: Build fails with "Missing environment variable"
**Solution:** Add the missing variable in Vercel Dashboard → Settings → Environment Variables

#### Issue: Build succeeds but app shows authentication errors
**Solution:** 
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Verify Supabase project is active
- Check Supabase Dashboard → Settings → API for correct values

#### Issue: Deployment stuck on "Building" or "Deploying"
**Solution:**
- Cancel the deployment
- Check build logs for errors
- Verify environment variables are set
- Try redeploying

#### Issue: "Authentication failed" in the app
**Solution:**
- Check browser console for errors
- Verify Supabase URL and keys are correct
- Check Supabase project status
- Verify RLS policies allow access

### 6. Verify Environment Variables Locally

Test that your environment variables work:

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web

# Check if variables are accessible (in Next.js)
npm run build
```

If build fails locally, fix those issues first before deploying.

### 7. Reset Vercel Project (Last Resort)

If nothing works:

1. Go to Vercel Dashboard → Your Project → Settings
2. Scroll to bottom → **Delete Project**
3. Create a new project and link it:
   ```bash
   cd /Users/williamsorrell/Desktop/G3/huntco-web
   vercel link
   ```
4. Add environment variables again
5. Deploy

## Current Required Environment Variables

Based on the codebase, these are required:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Optional but recommended:
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=https://outfitterhq.vercel.app
```

## Quick Check Command

To verify your Vercel project has the right settings:

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
vercel env ls
```

This will show all environment variables set in Vercel.

## Still Stuck?

1. Check Vercel Status: https://www.vercel-status.com/
2. Check Supabase Status: https://status.supabase.com/
3. Review Vercel deployment logs for specific error messages
4. Check browser console when accessing the deployed app
