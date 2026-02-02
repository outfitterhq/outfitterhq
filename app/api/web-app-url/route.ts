import { NextResponse } from "next/server";

/**
 * GET /api/web-app-url
 * Returns the production web app URL for use in invite links.
 * Uses NEXT_PUBLIC_WEB_APP_URL if set, otherwise falls back to VERCEL_URL or request origin.
 */
export async function GET(req: Request) {
  // Priority 1: Explicitly set production URL
  const explicitUrl = process.env.NEXT_PUBLIC_WEB_APP_URL;
  if (explicitUrl) {
    return NextResponse.json({ webAppUrl: explicitUrl });
  }

  // Priority 2: Vercel automatically sets VERCEL_URL for deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    // VERCEL_URL doesn't include protocol, so add https
    return NextResponse.json({ webAppUrl: `https://${vercelUrl}` });
  }

  // Priority 3: Use request origin (fallback)
  const url = new URL(req.url);
  const origin = url.origin;
  
  // If we're on localhost, warn but still return it
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    console.warn('⚠️ Using localhost for web app URL. Set NEXT_PUBLIC_WEB_APP_URL in Vercel.');
  }

  return NextResponse.json({ webAppUrl: origin });
}
