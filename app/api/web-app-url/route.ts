import { NextResponse } from "next/server";

/**
 * GET /api/web-app-url
 * Returns the production web app URL for use in invite links.
 * Uses NEXT_PUBLIC_WEB_APP_URL if set, otherwise falls back to VERCEL_URL.
 * Never returns localhost if running on Vercel.
 */
export async function GET(req: Request) {
  // Priority 1: Explicitly set production URL (highest priority)
  const explicitUrl = process.env.NEXT_PUBLIC_WEB_APP_URL;
  if (explicitUrl && explicitUrl.trim() && !explicitUrl.includes('localhost') && !explicitUrl.includes('127.0.0.1')) {
    console.log('[web-app-url] Using NEXT_PUBLIC_WEB_APP_URL:', explicitUrl);
    return NextResponse.json({ webAppUrl: explicitUrl.trim() });
  }

  // Priority 2: Vercel automatically sets VERCEL_URL for deployments
  const vercelUrl = process.env.VERCEL_URL;
  const isVercel = process.env.VERCEL === "1";
  
  if (vercelUrl && vercelUrl.trim()) {
    // VERCEL_URL doesn't include protocol, so add https
    const fullUrl = `https://${vercelUrl.trim()}`;
    console.log('[web-app-url] Using VERCEL_URL:', fullUrl);
    return NextResponse.json({ webAppUrl: fullUrl });
  }

  // Priority 3: If on Vercel but VERCEL_URL not set, check VERCEL_ENV
  if (isVercel) {
    // We're on Vercel but don't have VERCEL_URL - this shouldn't happen, but log it
    console.error('⚠️ [web-app-url] Running on Vercel but VERCEL_URL not set. Set NEXT_PUBLIC_WEB_APP_URL in Vercel environment variables.');
    console.error('   Available env vars:', {
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      NEXT_PUBLIC_WEB_APP_URL: process.env.NEXT_PUBLIC_WEB_APP_URL ? '(set but invalid)' : '(not set)',
    });
  }

  // Priority 4: Use request origin (only as last resort, and warn if localhost)
  const url = new URL(req.url);
  const origin = url.origin;
  
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    console.error('⚠️ [web-app-url] Using localhost for web app URL. This will cause invite links to fail in production.');
    console.error('   Set NEXT_PUBLIC_WEB_APP_URL in Vercel environment variables to your production URL.');
    console.error('   Request URL:', req.url);
    console.error('   Origin:', origin);
  }

  console.log('[web-app-url] Returning origin:', origin);
  return NextResponse.json({ webAppUrl: origin });
}
