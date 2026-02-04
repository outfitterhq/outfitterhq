import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes, error: userError } = await supabase.auth.getUser();

    if (userError || !userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { outfitter_id, full_name, phone } = body;

    if (!outfitter_id) {
      return NextResponse.json({ error: "outfitter_id is required" }, { status: 400 });
    }

    // Use service role to bypass RLS for membership operations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Supabase URL not configured" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Try to check if membership exists, but don't fail if check fails
    let existingMembership: any = null;
    try {
      const { data, error: checkErr } = await admin
        .from("outfitter_memberships")
        .select("id, status, role")
        .eq("user_id", userRes.user.id)
        .eq("outfitter_id", outfitter_id)
        .eq("role", "cook")
        .maybeSingle();

      if (checkErr) {
        console.warn("Failed to check membership (will try to create/update anyway):", checkErr);
      } else {
        existingMembership = data;
      }
    } catch (checkError) {
      console.warn("Exception checking membership (will try to create/update anyway):", checkError);
    }

    // If membership doesn't exist or check failed, try to create it
    if (!existingMembership) {
      console.log("Creating missing cook membership for user:", userRes.user.id);
      const { data: newMembership, error: createErr } = await admin
        .from("outfitter_memberships")
        .insert({
          user_id: userRes.user.id,
          outfitter_id: outfitter_id,
          role: "cook",
          status: "active",
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr || !newMembership) {
        return NextResponse.json(
          { error: "Failed to create membership", details: createErr?.message || "Unknown error" },
          { status: 500 }
        );
      }

      console.log("✅ Cook membership created:", newMembership);
    } else {
      // Update existing membership to active
      const { error: updateErr } = await admin
        .from("outfitter_memberships")
        .update({
          status: "active",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id);

      if (updateErr) {
        return NextResponse.json({ error: "Failed to activate membership", details: updateErr.message }, { status: 500 });
      }

      console.log("✅ Cook membership activated");
    }

    // Update profile
    if (full_name || phone) {
      const { error: profileErr } = await admin
        .from("profiles")
        .upsert({
          id: userRes.user.id,
          full_name: full_name?.trim() || null,
          email: userRes.user.email,
          phone: phone?.trim() || null,
        }, { onConflict: "id" });

      if (profileErr) {
        console.warn("Profile update error (non-fatal):", profileErr);
      }
    }

    // Update cook profile
    const emailLower = (userRes.user.email ?? "").toLowerCase();
    const { error: cookProfileErr } = await admin
      .from("cook_profiles")
      .update({
        name: full_name?.trim() || emailLower,
        contact_phone: phone?.trim() || null,
        contact_email: emailLower,
      })
      .eq("outfitter_id", outfitter_id)
      .eq("contact_email", emailLower);

    if (cookProfileErr) {
      console.warn("Cook profile update error (non-fatal):", cookProfileErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Cook onboarding error:", e);
    return NextResponse.json({ error: "Unhandled error", details: String(e) }, { status: 500 });
  }
}
