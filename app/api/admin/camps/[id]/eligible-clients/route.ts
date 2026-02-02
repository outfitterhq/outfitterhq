import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Get eligible clients for camp assignment
 * Filters by: same hunt_code, same unit, overlapping dates
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get camp details
    const { data: camp } = await supabase
      .from("camps")
      .select("hunt_code, unit, start_date, end_date")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // Find calendar events (hunts) with matching hunt_code and unit, overlapping dates
    // Overlap logic: camp.start_date <= hunt.end_time AND camp.end_date >= hunt.start_time
    const { data: matchingHunts } = await supabase
      .from("calendar_events")
      .select("client_email, start_time, end_time")
      .eq("outfitter_id", outfitterId)
      .eq("hunt_code", camp.hunt_code)
      .eq("unit", camp.unit)
      .lte("start_time", camp.end_date)
      .gte("end_time", camp.start_date);

    const clientEmails = [...new Set((matchingHunts || []).map((h) => h.client_email).filter(Boolean))];

    if (clientEmails.length === 0) {
      return NextResponse.json({ eligible_clients: [] });
    }

    // Get client records
    const { data: clients } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone")
      .eq("outfitter_id", outfitterId)
      .in("email", clientEmails);

    // Get already assigned clients
    const { data: assigned } = await supabase
      .from("camp_client_assignments")
      .select("client_id")
      .eq("camp_id", id);

    const assignedIds = new Set((assigned || []).map((a) => a.client_id));

    // Filter out already assigned
    const eligible = (clients || []).filter((c) => !assignedIds.has(c.id));

    return NextResponse.json({ eligible_clients: eligible });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
