import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Get production URL from environment variable
    // Priority: NEXT_PUBLIC_SITE_URL > VERCEL_URL > fallback
    const siteUrl = 
      process.env.NEXT_PUBLIC_SITE_URL || 
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
      "https://outfitterhq.com";

    // Use Supabase to send password reset email with production URL
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    if (resetError) {
      console.error("[forgot-password] Error:", resetError);
      return NextResponse.json({ error: resetError.message }, { status: 400 });
    }

    // Always return success (prevents account enumeration)
    return NextResponse.json({ 
      success: true, 
      message: "If an account exists for this email, a password reset link has been sent." 
    });
  } catch (e: any) {
    console.error("[forgot-password] Exception:", e);
    return NextResponse.json({ error: e?.message || "Failed to send reset email" }, { status: 500 });
  }
}
