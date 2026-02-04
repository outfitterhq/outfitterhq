import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get outfitter from cookie
    const cookieStore = await cookies();
    const outfitterId = cookieStore.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "Outfitter not selected" }, { status: 400 });
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // Format: "2026-02" (YYYY-MM)
    const unit = searchParams.get("unit");
    const species = searchParams.get("species");
    const weapon = searchParams.get("weapon");

    // Build query
    let query = supabase
      .from("booked_hunts")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .order("hunt_start_date", { ascending: true });

    // Apply filters
    if (month) {
      // Parse month (YYYY-MM) and get start/end of month
      const [year, monthNum] = month.split("-").map(Number);
      const startDate = new Date(year, monthNum - 1, 1).toISOString();
      const endDate = new Date(year, monthNum, 0, 23, 59, 59).toISOString();
      query = query
        .gte("hunt_start_date", startDate)
        .lte("hunt_start_date", endDate);
    }

    if (unit) {
      query = query.eq("unit", unit);
    }

    if (species) {
      query = query.eq("species", species);
    }

    if (weapon) {
      query = query.eq("weapon", weapon);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching booked hunts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ booked_hunts: data || [] });
  } catch (error: any) {
    console.error("Error in booked-hunts API:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
