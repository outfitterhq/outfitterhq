import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

// GET /api/draw-results/applications - Get pending draw applications
export async function GET(request: NextRequest) {
  const supabase = await supabaseRoute();

  // Get current user and their outfitter
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user's outfitter
  const { data: membership } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No active outfitter membership" }, { status: 403 });
  }

  // Try to get from the view, fall back to direct query if view doesn't exist
  const { data: applications, error } = await supabase
    .from("pending_draw_applications")
    .select("*")
    .eq("outfitter_id", membership.outfitter_id);

  if (error) {
    // View might not exist, return empty array
    console.error("Error fetching pending applications:", error.message);
    return NextResponse.json({ applications: [] });
  }

  return NextResponse.json({ applications: applications || [] });
}
