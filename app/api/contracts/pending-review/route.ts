import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Get contracts pending admin review
 * Returns all contracts with status 'pending_admin_review' for the current outfitter
 */
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

    // Verify admin access
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get pending review contracts
    const { data: contracts, error } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        status,
        content,
        client_email,
        client_name,
        client_completed_at,
        client_completion_data,
        admin_reviewed_at,
        admin_reviewed_by,
        admin_review_notes,
        created_at,
        hunt_id,
        hunt:calendar_events(
          id,
          title,
          species,
          unit,
          start_time,
          end_time,
          guide_username,
          camp_name
        )
      `)
      .eq("outfitter_id", outfitterId)
      .eq("status", "pending_admin_review")
      .order("client_completed_at", { ascending: true }); // Oldest first

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contracts: contracts || [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
