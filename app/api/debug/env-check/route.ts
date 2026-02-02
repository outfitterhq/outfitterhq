import { NextResponse } from "next/server";

/**
 * Debug endpoint to check if environment variables are accessible
 * Only works in development or with ?debug=1 query param
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1" || process.env.NODE_ENV === "development";

  if (!debug) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing",
    // Don't show actual values for security
    NEXT_PUBLIC_SUPABASE_URL_length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    SUPABASE_SERVICE_ROLE_KEY_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
  };

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    variables: envVars,
    note: "Length shows character count (0 = missing). Values are hidden for security.",
  });
}
