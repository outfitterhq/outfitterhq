import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { CalendarEventInput } from "@/lib/types/calendar";

// GET: Get a single event
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT: Update an event
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    // Get current event to check if guide is being assigned
    const { data: currentEvent } = await supabase
      .from("calendar_events")
      .select("guide_username, status, audience, client_email")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
      updateData.description = body.notes || null; // Also update description for backward compatibility
    }
    if (body.start_date !== undefined) updateData.start_time = body.start_date; // Map to start_time
    if (body.end_date !== undefined) updateData.end_time = body.end_date; // Map to end_time
    if (body.camp_name !== undefined) updateData.camp_name = body.camp_name || null;
    if (body.client_email !== undefined) updateData.client_email = body.client_email || null;
    if (body.guide_username !== undefined) updateData.guide_username = body.guide_username || null;
    if (body.audience !== undefined) updateData.audience = body.audience;
    if (body.species !== undefined) updateData.species = body.species || null;
    if (body.unit !== undefined) updateData.unit = body.unit || null;
    if (body.status !== undefined) updateData.status = body.status || "Inquiry";
    if (body.weapon !== undefined) {
        if (body.weapon) {
            updateData.weapon = body.weapon;
        } else {
            updateData.weapon = null;
        }
    }
    
    // Hunt workflow fields
    if (body.hunt_type !== undefined) updateData.hunt_type = body.hunt_type || 'draw';
    if (body.tag_status !== undefined) updateData.tag_status = body.tag_status || 'pending';

    // Validate that all required fields are filled before allowing status change to "Booked"
    // Required fields: guide_username, start_time, end_time, species, client_email
    if (body.status === "Booked" || (body.guide_username && currentEvent?.status === "Pending" && !currentEvent?.guide_username)) {
      // Get the full event data to validate all fields
      const { data: fullEvent } = await supabase
        .from("calendar_events")
        .select("guide_username, start_time, end_time, species, client_email, title")
        .eq("id", id)
        .eq("outfitter_id", outfitterId)
        .single();

      const finalGuide = body.guide_username || fullEvent?.guide_username;
      const finalStartTime = body.start_date || fullEvent?.start_time;
      const finalEndTime = body.end_date || fullEvent?.end_time;
      const finalSpecies = body.species !== undefined ? body.species : fullEvent?.species;
      const finalClientEmail = body.client_email !== undefined ? body.client_email : fullEvent?.client_email;

      const missingFields: string[] = [];
      if (!finalGuide) missingFields.push("Guide");
      if (!finalStartTime) missingFields.push("Start Date");
      if (!finalEndTime) missingFields.push("End Date");
      if (!finalSpecies) missingFields.push("Species");
      if (!finalClientEmail) missingFields.push("Client");

      if (missingFields.length > 0) {
        return NextResponse.json(
          { 
            error: `Cannot set status to "Booked". Missing required fields: ${missingFields.join(", ")}. Please fill in all required fields first.`,
            missingFields 
          },
          { status: 400 }
        );
      }

      // All fields are filled, allow status change to "Booked"
      if (body.status === "Booked" || (body.guide_username && currentEvent?.status === "Pending")) {
        updateData.status = "Booked";
        updateData.audience = "all"; // Make visible to client once all fields are filled
        console.log(`📅 Event ${id}: All required fields filled, changing status to "Booked" and audience to "all"`);
      }
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .update(updateData)
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE: Delete an event
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("outfitter_id", outfitterId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
