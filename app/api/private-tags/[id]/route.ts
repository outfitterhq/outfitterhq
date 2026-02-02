import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { PrivateLandTagInput } from "@/lib/types/private-tags";

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

    const body: PrivateLandTagInput = await req.json();

    const tagType = body.tag_type && ["private_land", "unit_wide"].includes(body.tag_type) ? body.tag_type : undefined;
    const updateData: Record<string, unknown> = {};
    if (body.tag_name !== undefined) updateData.tag_name = body.tag_name;
    if (body.species !== undefined) updateData.species = body.species;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.unit !== undefined) updateData.unit = body.unit || null;
    if (tagType !== undefined) updateData.tag_type = tagType;
    if (body.price !== undefined) updateData.price = body.price || null;
    if (body.is_available !== undefined) updateData.is_available = body.is_available;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (tagType === "unit_wide") {
      updateData.hunt_code_options = body.hunt_code_options?.trim() || null;
      updateData.hunt_code = null;
    } else if (tagType === "private_land") {
      updateData.hunt_code = body.hunt_code || null;
      updateData.hunt_code_options = null;
    } else {
      if (body.hunt_code !== undefined) updateData.hunt_code = body.hunt_code || null;
      if (body.hunt_code_options !== undefined) updateData.hunt_code_options = body.hunt_code_options?.trim() || null;
    }

    const { data, error } = await supabase
      .from("private_land_tags")
      .update(updateData)
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tag: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

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

    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("outfitter_id", outfitterId)
      .eq("user_id", userRes.user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("private_land_tags")
      .delete()
      .eq("id", id)
      .or(`outfitter_id.eq.${outfitterId},outfitter_id.is.null`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
