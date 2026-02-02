import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

// GET /api/draw-results - List all draw results for the outfitter
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

  // Get draw results
  const { data: results, error } = await supabase
    .from("draw_results")
    .select("*")
    .eq("outfitter_id", membership.outfitter_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results });
}

// POST /api/draw-results - Add a new draw result
export async function POST(request: NextRequest) {
  const supabase = await supabaseRoute();

  // Get current user and their outfitter
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user's outfitter
  const { data: membership } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const {
    client_email,
    client_name,
    client_dob,
    hunter_id,
    species,
    unit,
    tag_type,
    draw_year,
    result_status,
    hunt_code,
    notes,
  } = body;

  // Require species, and either email or name for identification
  if (!species) {
    return NextResponse.json(
      { error: "species is required" },
      { status: 400 }
    );
  }
  
  if (!client_email && !client_name) {
    return NextResponse.json(
      { error: "Either client_email or client_name is required" },
      { status: 400 }
    );
  }

  // Insert the draw result (trigger will auto-create hunt + contract for winners)
  const { data: result, error } = await supabase
    .from("draw_results")
    .insert({
      outfitter_id: membership.outfitter_id,
      client_email: client_email || null,
      client_name: client_name || null,
      client_dob: client_dob || null,
      hunter_id: hunter_id || null,
      species,
      unit: unit || null,
      tag_type: tag_type || null,
      draw_year: draw_year || new Date().getFullYear(),
      result_status: result_status || "drawn",
      hunt_code: hunt_code || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ result });
}
