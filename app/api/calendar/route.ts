import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { CalendarEventInput } from "@/lib/types/calendar";

// GET: List events for the current outfitter
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

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start"); // ISO date string
    const end = searchParams.get("end"); // ISO date string

    // Admin can see all events (including "Pending" and "internalOnly")
    // No filtering by status or audience for admin calendar
    let query = supabase
      .from("calendar_events")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .order("start_time", { ascending: true });

    // Date range filtering: include events that overlap with the requested range
    // An event overlaps if: (start_time <= end) AND (end_time >= start)
    // For Supabase PostgREST, we chain filters with AND logic
    if (start && end) {
      // Get events that overlap the date range
      // Event overlaps if: start_time <= end AND end_time >= start
      // Use .or() with AND logic: events where (start_time <= end) OR (end_time >= start) 
      // But we actually need AND, so we chain both conditions
      query = query
        .lte("start_time", end)  // Event starts before or during range
        .gte("end_time", start);  // Event ends after or during range
    } else if (start) {
      query = query.gte("end_time", start); // Events that haven't ended yet
    } else if (end) {
      query = query.lte("start_time", end); // Events that have started
    }
    
    console.log(`[API Calendar] Query filters:`, {
      outfitterId,
      dateRange: start && end ? `${start} to ${end}` : "none",
      hasStart: !!start,
      hasEnd: !!end
    });

    const { data, error } = await query;

    if (error) {
      console.error("[API Calendar] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API Calendar] Returning ${data?.length || 0} events for outfitter ${outfitterId}`, {
      dateRange: start && end ? { start, end } : "no filter",
      sampleEvents: data?.slice(0, 2).map((e: any) => ({
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        guide_username: e.guide_username,
        client_email: e.client_email,
      })) || []
    });

    return NextResponse.json({ events: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Create a new event
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

    const body: any = await req.json();

    if (!body.title || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: "title, start_date, and end_date are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        outfitter_id: outfitterId,
        title: body.title,
        notes: body.notes || null,
        description: body.notes || null, // Also set description for backward compatibility
        start_time: body.start_date, // Map start_date to start_time
        end_time: body.end_date, // Map end_date to end_time
        camp_name: body.camp_name || null,
        client_email: body.client_email || null,
        guide_username: body.guide_username || null,
        cook_username: body.cook_username || null,
        audience: body.audience || "all",
        species: body.species || null,
        unit: body.unit || null,
        status: body.status || "Inquiry",
        ...(body.weapon ? { weapon: body.weapon } : {}),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
