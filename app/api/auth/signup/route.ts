import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();

    // Support both form data (old) and JSON (new)
    const contentType = req.headers.get("content-type");
    let body: any = {};

    if (contentType?.includes("application/json")) {
      body = await req.json();
    } else {
      const form = await req.formData();
      body = {
        outfitter_name: form.get("outfitter_name"),
        email: form.get("email"),
        password: form.get("password"),
        first_name: form.get("first_name"),
        last_name: form.get("last_name"),
      };
    }

    const outfitter_name = String(body.outfitter_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();

    if (!outfitter_name || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Outfitter name, email, and password are required" },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      return NextResponse.json({ ok: false, error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ ok: false, error: "Failed to create user" }, { status: 500 });
    }

    // Create outfitter using RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc("init_outfitter_for", {
      p_name: outfitter_name,
      p_user: authData.user.id,
    });

    if (rpcError || !rpcData) {
      // Clean up auth user if outfitter creation fails
      await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
      return NextResponse.json(
        { ok: false, error: rpcError?.message || "Failed to create outfitter" },
        { status: 500 }
      );
    }

    const outfitterId = rpcData;

    // Update outfitter with additional business info if provided
    // Note: Only update name for now - other fields can be added via migration if needed
    // The outfitters table currently only has 'name' field
    // Business details can be stored in a separate table or added via migration later

    // Update user profile if name provided
    if (firstName || lastName) {
      try {
        await supabase
          .from("profiles")
          .upsert({
            id: authData.user.id,
            full_name: `${firstName} ${lastName}`.trim() || null,
          });
      } catch {
        // Ignore if profiles table doesn't exist or RLS blocks
      }
    }

    // Session cookies are automatically set by supabaseRoute() via setAll()
    await supabase.auth.getSession();

    return NextResponse.json({ ok: true, redirect: "/dashboard" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e ?? "Unknown server error") },
      { status: 500 }
    );
  }
}
