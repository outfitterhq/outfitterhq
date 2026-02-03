import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: List cooks for the current outfitter
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    // Get cooks from cook_profiles table
    const { data: cookRows, error: cookError } = await supabase
      .from("cook_profiles")
      .select("id, name, contact_email, contact_phone")
      .eq("outfitter_id", outfitterId)
      .order("name", { ascending: true });

    if (cookError) {
      console.error("Cook profiles error:", cookError);
      return NextResponse.json({ error: cookError.message }, { status: 500 });
    }

    // Also get cooks from outfitter_memberships with role='cook' as fallback
    const { data: membershipCooks, error: membershipError } = await supabase
      .from("outfitter_memberships")
      .select(`
        user_id,
        users:user_id(email)
      `)
      .eq("outfitter_id", outfitterId)
      .eq("role", "cook")
      .eq("status", "active");

    // Combine both sources
    const cooks = (cookRows || []).map((cook: any) => ({
      id: cook.id,
      name: cook.name,
      email: cook.contact_email,
      phone: cook.contact_phone,
      identifier: cook.contact_email || cook.name, // Use email or name as identifier
    }));

    // Add membership-based cooks if not already in list
    if (membershipCooks) {
      for (const mem of membershipCooks) {
        const email = (mem.users as any)?.email;
        if (email && !cooks.some((c: any) => c.email === email)) {
          cooks.push({
            id: mem.user_id,
            name: email.split("@")[0], // Use email prefix as name
            email: email,
            phone: null,
            identifier: email,
          });
        }
      }
    }

    return NextResponse.json({ cooks: cooks || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
