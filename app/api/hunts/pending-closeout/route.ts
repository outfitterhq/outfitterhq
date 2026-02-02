import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { PendingCloseoutHunt } from "@/lib/types/hunt-closeout";

/**
 * GET /api/hunts/pending-closeout
 * Returns hunts that need closeout completion for the current guide
 */
export async function GET() {
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

    // Get guide username from guides table
    const { data: guideData, error: guideError } = await supabase
      .from("guides")
      .select("username")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("is_active", true)
      .single();

    if (guideError || !guideData) {
      // Fallback: check if user is admin/owner (they can see all pending closeouts)
      const { data: membershipData } = await supabase
        .from("outfitter_memberships")
        .select("role")
        .eq("user_id", userRes.user.id)
        .eq("outfitter_id", outfitterId)
        .eq("status", "active")
        .single();

      if (membershipData?.role === "owner" || membershipData?.role === "admin") {
        // Admin can see all pending closeouts
        const { data: hunts, error } = await supabase.rpc("get_pending_closeout_hunts", {
          p_guide_username: null, // null = all guides
          p_outfitter_id: outfitterId,
        });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ hunts: hunts || [] });
      }

      return NextResponse.json({ error: "Guide not found" }, { status: 403 });
    }

    // Get pending closeout hunts for this guide
    const { data: hunts, error } = await supabase.rpc("get_pending_closeout_hunts", {
      p_guide_username: guideData.username,
      p_outfitter_id: outfitterId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ hunts: hunts || [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
