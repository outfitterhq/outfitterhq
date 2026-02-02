import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: List all camps for the current outfitter
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

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    // Build query
    let query = supabase
      .from("camps")
      .select(`
        *,
        lodge:lodges(
          id,
          name,
          address,
          gps_latitude,
          gps_longitude,
          onx_share_link,
          max_clients,
          max_guides
        ),
        camp_manager_user_id
      `)
      .eq("outfitter_id", outfitterId);

    if (year) {
      const yearInt = parseInt(year, 10);
      query = query.or(`start_date.gte.${yearInt}-01-01,end_date.lte.${yearInt}-12-31`);
    }

    const { data: camps, error } = await query.order("start_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get client and guide counts for each camp
    const campsWithCounts = await Promise.all(
      (camps || []).map(async (camp) => {
        const [clientsRes, guidesRes, cookRes] = await Promise.all([
          supabase.from("camp_client_assignments").select("client_id").eq("camp_id", camp.id),
          supabase.from("camp_guide_assignments").select("guide_id").eq("camp_id", camp.id),
          supabase.from("cook_camp_assignments").select("cook_id").eq("camp_id", camp.id),
        ]);

        return {
          ...camp,
          client_count: clientsRes.data?.length || 0,
          guide_count: guidesRes.data?.length || 0,
          cook_count: cookRes.data?.length || 0,
        };
      })
    );

    return NextResponse.json({ camps: campsWithCounts });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Create a new camp
 */
export async function POST(req: Request) {
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

    const body = await req.json();
    const {
      name,
      state,
      unit,
      hunt_code,
      start_date,
      end_date,
      camp_type,
      lodge_id,
      max_clients,
      max_guides,
      onx_share_link,
      gps_latitude,
      gps_longitude,
      location_label,
      camp_manager_user_id,
    } = body;

    if (!name || !state || !unit || !hunt_code || !start_date || !end_date || !camp_type) {
      return NextResponse.json(
        { error: "name, state, unit, hunt_code, start_date, end_date, and camp_type are required" },
        { status: 400 }
      );
    }

    // If lodge is selected, capacity comes from lodge (handled by trigger)
    // Otherwise, require manual capacity
    if (!lodge_id && (!max_clients || !max_guides)) {
      return NextResponse.json(
        { error: "max_clients and max_guides are required when no lodge is selected" },
        { status: 400 }
      );
    }

    const { data: camp, error } = await supabase
      .from("camps")
      .insert({
        outfitter_id: outfitterId,
        name,
        state,
        unit,
        hunt_code,
        start_date,
        end_date,
        camp_type,
        lodge_id: lodge_id || null,
        max_clients: lodge_id ? null : max_clients, // Will be set by trigger if lodge_id exists
        max_guides: lodge_id ? null : max_guides,
        onx_share_link: onx_share_link || null,
        gps_latitude: gps_latitude || null,
        gps_longitude: gps_longitude || null,
        location_label: location_label || null,
        camp_manager_user_id: camp_manager_user_id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ camp }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
