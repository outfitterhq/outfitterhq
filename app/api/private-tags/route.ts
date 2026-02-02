import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { PrivateLandTagInput } from "@/lib/types/private-tags";

// GET: List private land tags for current outfitter (per-outfitter, not global)
// ?include_hunts=1 adds hunt_id (calendar event from tag purchase) for each sold tag so admin can "Open hunt & generate contract"
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const includeHunts = searchParams.get("include_hunts") === "1" || searchParams.get("include_hunts") === "true";

    const { data: tagsData, error } = await supabase
      .from("private_land_tags")
      .select("*")
      .or(`outfitter_id.eq.${outfitterId},outfitter_id.is.null`)
      .order("state", { ascending: true })
      .order("species", { ascending: true })
      .order("tag_name", { ascending: true });

    if (error) {
      console.error("Error loading tags:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tags = tagsData ?? [];
    
    // Debug: Log if no tags found
    if (tags.length === 0) {
      console.warn("No tags found for outfitter", {
        outfitter_id: outfitterId,
        user_id: userRes.user.id,
      });
    }

    if (includeHunts && tags.length > 0) {
      const soldTagIds = tags.filter((t: { is_available?: boolean }) => !t.is_available).map((t: { id: string }) => t.id);
      if (soldTagIds.length > 0) {
        const { data: hunts } = await supabase
          .from("calendar_events")
          .select("id, private_land_tag_id, title, start_time, status")
          .eq("outfitter_id", outfitterId)
          .in("private_land_tag_id", soldTagIds);
        type HuntRow = { private_land_tag_id: string; id: string; title?: string | null; start_time?: string | null; status?: string | null };
        const huntByTagId = new Map<string, HuntRow>((hunts ?? []).map((h: HuntRow) => [h.private_land_tag_id, h]));
        const tagsWithHunts = tags.map((t: { id: string; [k: string]: unknown }) => ({
          ...t,
          hunt_id: huntByTagId.get(t.id)?.id ?? null,
          hunt_title: huntByTagId.get(t.id)?.title ?? null,
          hunt_start_time: huntByTagId.get(t.id)?.start_time ?? null,
          hunt_status: huntByTagId.get(t.id)?.status ?? null,
        }));
        return NextResponse.json({ tags: tagsWithHunts }, { status: 200 });
      }
    }

    return NextResponse.json({ tags }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Create private land tag (scoped to current outfitter)
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

    const body: PrivateLandTagInput = await req.json();

    if (!body.tag_name || !body.species) {
      return NextResponse.json({ error: "tag_name and species are required" }, { status: 400 });
    }

    const tagType = body.tag_type && ["private_land", "unit_wide"].includes(body.tag_type) ? body.tag_type : "private_land";
    const insertPayload: Record<string, unknown> = {
      outfitter_id: outfitterId,
      state: body.state || "NM",
      species: body.species,
      unit: body.unit || null,
      tag_name: body.tag_name,
      tag_type: tagType,
      price: body.price || null,
      is_available: body.is_available !== undefined ? body.is_available : true,
      notes: body.notes || null,
    };
    if (tagType === "unit_wide") {
      insertPayload.hunt_code_options = body.hunt_code_options?.trim() || null;
      insertPayload.hunt_code = null;
    } else {
      insertPayload.hunt_code = body.hunt_code || null;
      insertPayload.hunt_code_options = null;
    }
    const { data, error } = await supabase
      .from("private_land_tags")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tag: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
