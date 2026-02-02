import { NextResponse } from "next/server";

/**
 * GET /api/debug/web-app-url
 * Debug endpoint to see what environment variables are available
 */
export async function GET() {
  const env = {
    NEXT_PUBLIC_WEB_APP_URL: process.env.NEXT_PUBLIC_WEB_APP_URL || "(not set)",
    VERCEL_URL: process.env.VERCEL_URL || "(not set)",
    VERCEL: process.env.VERCEL || "(not set)",
    VERCEL_ENV: process.env.VERCEL_ENV || "(not set)",
    NODE_ENV: process.env.NODE_ENV || "(not set)",
  };

  // Calculate what URL would be returned
  let calculatedUrl = "(error)";
  try {
    if (process.env.NEXT_PUBLIC_WEB_APP_URL && !process.env.NEXT_PUBLIC_WEB_APP_URL.includes('localhost')) {
      calculatedUrl = process.env.NEXT_PUBLIC_WEB_APP_URL;
    } else if (process.env.VERCEL_URL) {
      calculatedUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      calculatedUrl = "(would use request origin - localhost in dev)";
    }
  } catch (e) {
    calculatedUrl = `Error: ${String(e)}`;
  }

  return NextResponse.json({
    environment_variables: env,
    calculated_url: calculatedUrl,
    message: calculatedUrl.includes('localhost') || calculatedUrl.includes('127.0.0.1')
      ? "⚠️ WARNING: URL contains localhost. Set NEXT_PUBLIC_WEB_APP_URL in Vercel."
      : "✅ URL looks good",
  });
}
