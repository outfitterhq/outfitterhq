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
