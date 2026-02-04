import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: List calendar events assigned to the current cook
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

    // Get cook's email/username from cook_profiles or user email
    const { data: cookProfile } = await supabase
      .from("cook_profiles")
      .select("contact_email, name")
      .eq("outfitter_id", outfitterId)
      .eq("contact_email", userRes.user.email?.toLowerCase() || "")
      .maybeSingle();

    const cookIdentifier = cookProfile?.contact_email || userRes.user.email?.toLowerCase() || "";

    if (!cookIdentifier) {
      return NextResponse.json({ error: "Cook profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start"); // ISO date string
    const end = searchParams.get("end"); // ISO date string

    // Query calendar events where cook_username matches the cook's email
    let query = supabase
      .from("calendar_events")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .eq("cook_username", cookIdentifier)
      .order("start_time", { ascending: true });

    // Date range filtering: include events that overlap with the requested range
    if (start && end) {
      query = query.lte("start_time", end).gte("end_time", start);
    } else if (start) {
      query = query.gte("end_time", start); // Events that haven't ended yet
    } else if (end) {
      query = query.lte("start_time", end); // Events that have started
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API Cook Assignments] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API Cook Assignments] Returning ${data?.length || 0} assignments for cook ${cookIdentifier}`);

    return NextResponse.json({ assignments: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
