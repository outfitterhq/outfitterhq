import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get outfitter from cookie
    const outfitterId = cookieStore.get("hc_outfitter")?.value;
    if (!outfitterId) {
      return Response.json({ error: "Outfitter not selected" }, { status: 400 });
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
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ booked_hunts: data || [] });
  } catch (error: any) {
    console.error("Error in booked-hunts API:", error);
    return Response.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
