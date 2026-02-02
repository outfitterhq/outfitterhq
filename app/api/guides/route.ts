import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: List guides for the current outfitter
// Returns guides from outfitter_memberships with role='guide'
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

    // Try to get guides from guides table first, fallback to memberships
    let guides: Array<{ user_id: string; username: string; email: string; name: string | null }> = [];
    
    const { data: guideRows, error: guideError } = await supabase
      .from("guides")
      .select("user_id, username, email, name, is_active")
      .eq("outfitter_id", outfitterId)
      .eq("is_active", true);

    if (!guideError && guideRows) {
      guides = guideRows.map((g: any) => ({
        user_id: g.user_id,
        // Use email as username if username is empty (same as iOS app)
        username: g.username || g.email || g.user_id,
        email: g.email || "",
        name: g.name || null,
      }));
    } else {
      // Fallback: get from memberships
      const { data: memberships, error } = await supabase
        .from("outfitter_memberships")
        .select("user_id, role, status")
        .eq("outfitter_id", outfitterId)
        .eq("role", "guide")
        .eq("status", "active");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      guides = (memberships ?? []).map((m: any) => ({
        user_id: m.user_id,
        username: m.user_id,
        email: "",
        name: null,
      }));
    }

    return NextResponse.json({ guides }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
