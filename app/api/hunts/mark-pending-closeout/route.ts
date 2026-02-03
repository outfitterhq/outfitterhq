import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// POST: Manually mark a hunt as "Pending Closeout" (for testing/simulation)
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

    const body = await req.json();
    const { hunt_id } = body;

    if (!hunt_id) {
      return NextResponse.json({ error: "hunt_id is required" }, { status: 400 });
    }

    // Get the hunt
    const { data: hunt, error: huntError } = await supabase
      .from("calendar_events")
      .select("id, title, end_time, status, guide_username")
      .eq("id", hunt_id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (huntError || !hunt) {
      return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
    }

    // Check if closeout already exists
    const { data: existingCloseout } = await supabase
      .from("hunt_closeouts")
      .select("id")
      .eq("hunt_id", hunt_id)
      .maybeSingle();

    if (existingCloseout) {
      return NextResponse.json({ error: "Closeout already exists for this hunt" }, { status: 400 });
    }

    // Update status to "Pending Closeout"
    const { data: updatedHunt, error: updateError } = await supabase
      .from("calendar_events")
      .update({ 
        status: "Pending Closeout",
        updated_at: new Date().toISOString()
      })
      .eq("id", hunt_id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Hunt marked as pending closeout",
      hunt: updatedHunt 
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
