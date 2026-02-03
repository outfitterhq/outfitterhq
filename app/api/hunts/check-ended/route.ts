import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

// POST: Check for ended hunts and automatically mark them as "Pending Closeout"
// This should be called periodically or when the guide portal loads
export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Call the database function to auto-mark hunts as pending closeout
    // This function updates hunts where:
    // - status is 'Booked', 'In Progress', or 'Completed'
    // - end_time < NOW()
    // - no closeout exists yet
    const { data, error } = await supabase.rpc("auto_mark_hunts_pending_closeout");

    if (error) {
      console.error("[check-ended] Error calling auto_mark_hunts_pending_closeout:", error);
      
      // Fallback: manually update hunts if the function doesn't exist
      const now = new Date().toISOString();
      
      // First, get all hunts that have ended
      const { data: endedHunts, error: queryError } = await supabase
        .from("calendar_events")
        .select("id, title, end_time, status")
        .in("status", ["Booked", "In Progress", "Completed"])
        .lt("end_time", now);

      if (queryError) {
        return NextResponse.json({ error: queryError.message }, { status: 500 });
      }

      if (!endedHunts || endedHunts.length === 0) {
        return NextResponse.json({ 
          message: "No hunts need to be marked",
          updated: 0 
        });
      }

      // Get hunts that already have closeouts
      const huntIds = endedHunts.map(h => h.id);
      const { data: existingCloseouts } = await supabase
        .from("hunt_closeouts")
        .select("hunt_id")
        .in("hunt_id", huntIds);

      const closeoutHuntIds = new Set((existingCloseouts || []).map((c: any) => c.hunt_id));
      const huntsNeedingCloseout = endedHunts.filter(h => !closeoutHuntIds.has(h.id));

      if (huntsNeedingCloseout.length === 0) {
        return NextResponse.json({ 
          message: "No hunts need to be marked (all have closeouts)",
          updated: 0 
        });
      }

      // Update hunts to "Pending Closeout"
      const updateIds = huntsNeedingCloseout.map(h => h.id);
      const { data: updated, error: updateError } = await supabase
        .from("calendar_events")
        .update({ 
          status: "Pending Closeout",
          updated_at: now
        })
        .in("id", updateIds)
        .select("id, title");

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        message: `Marked ${updated?.length || 0} hunts as pending closeout`,
        updated: updated?.length || 0,
        hunts: updated
      });
    }

    // Function executed successfully
    return NextResponse.json({
      message: "Checked for ended hunts",
      updated: "See database function result"
    });
  } catch (e: any) {
    console.error("[check-ended] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
