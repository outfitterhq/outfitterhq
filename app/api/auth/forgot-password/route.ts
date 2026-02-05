import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Call Supabase Edge Function for password reset (gives us full control over redirect URL)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/auth-reset-password`;
    
    console.log("[forgot-password] Calling Edge Function:", edgeFunctionUrl);

    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[forgot-password] Edge Function error:", data);
      return NextResponse.json({ error: data.error || "Failed to send reset email" }, { status: response.status });
    }

    // Always return success (prevents account enumeration)
    return NextResponse.json({ 
      success: true, 
      message: data.message || "If an account exists for this email, a password reset link has been sent." 
    });
  } catch (e: any) {
    console.error("[forgot-password] Exception:", e);
    return NextResponse.json({ error: e?.message || "Failed to send reset email" }, { status: 500 });
  }
}
