import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get current guide's profile
 */
export async function GET() {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get guide record
    const { data: guide, error } = await supabase
      .from("guides")
      .select("*")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .single();

    if (error || !guide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    return NextResponse.json({ guide });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * PUT: Update current guide's profile
 */
export async function PUT(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      phone,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      vehicle_color,
      vehicle_plate,
    } = body;

    // Get guide record first
    const { data: existingGuide, error: fetchError } = await supabase
      .from("guides")
      .select("id")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .single();

    if (fetchError || !existingGuide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // Update guide
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (vehicle_year !== undefined) updateData.vehicle_year = vehicle_year;
    if (vehicle_make !== undefined) updateData.vehicle_make = vehicle_make;
    if (vehicle_model !== undefined) updateData.vehicle_model = vehicle_model;
    if (vehicle_color !== undefined) updateData.vehicle_color = vehicle_color;
    if (vehicle_plate !== undefined) updateData.vehicle_plate = vehicle_plate;

    const { data: updated, error: updateError } = await supabase
      .from("guides")
      .update(updateData)
      .eq("id", existingGuide.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ guide: updated });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
