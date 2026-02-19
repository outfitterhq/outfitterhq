import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: List all hunt contracts for the outfitter (admin)
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

    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("outfitter_id")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Not authorized for this outfitter" }, { status: 403 });
    }

    // Parse query params for filtering
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const clientEmail = url.searchParams.get("client_email");

    let query = supabase
      .from("hunt_contracts")
      .select(`
        *,
        hunt:calendar_events(
          id, title, species, unit, start_time, end_time,
          guide_username, hunt_type, tag_status
        )
      `)
      .eq("outfitter_id", outfitterId)
      .order("created_at", { ascending: false });
    
    // Note: Payment fields (contract_total_cents, amount_paid_cents, etc.) are included in *

    if (status) {
      query = query.eq("status", status);
    }
    if (clientEmail) {
      query = query.eq("client_email", clientEmail);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contracts: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
