import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

// GET: List hunts pending closeout for the current guide
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get guide record
    const { data: guide, error: guideError } = await supabase
      .from("guides")
      .select("username, email, outfitter_id")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (guideError || !guide) {
      return NextResponse.json({ error: "Guide record not found" }, { status: 404 });
    }

    // Get hunts that need closeout
    // Use the database function or query directly
    const { data: hunts, error: huntsError } = await supabase
      .from("calendar_events")
      .select(`
        id,
        title,
        client_email,
        species,
        unit,
        weapon,
        start_time,
        end_time
      `)
      .eq("status", "Pending Closeout")
      .eq("outfitter_id", guide.outfitter_id)
      .or(`guide_username.eq.${guide.username},guide_username.eq.${guide.email}`)
      .order("end_time", { ascending: true });

    if (huntsError) {
      console.error("Error fetching pending closeout hunts:", huntsError);
      return NextResponse.json({ error: huntsError.message }, { status: 500 });
    }

    // Calculate days pending for each hunt
    const now = new Date();
    const huntsWithDays = (hunts || []).map((hunt) => {
      const endDate = new Date(hunt.end_time);
      const daysPending = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        hunt_id: hunt.id,
        hunt_title: hunt.title,
        client_email: hunt.client_email,
        species: hunt.species,
        unit: hunt.unit,
        weapon: hunt.weapon,
        start_time: hunt.start_time,
        end_time: hunt.end_time,
        days_pending: daysPending,
      };
    });

    return NextResponse.json({ hunts: huntsWithDays }, { status: 200 });
  } catch (e: any) {
    console.error("Error in pending-closeout API:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
