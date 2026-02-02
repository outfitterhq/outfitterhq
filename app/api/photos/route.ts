import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET /api/photos
 * Get all photos for the outfitter with filtering options
 * Query params: species, weapon, unit, state, category, approved_for_marketing, hunt_id, closeout_id
 */
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

    // Verify admin access
    const { data: membershipData } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .single();

    const isAdmin = membershipData?.role === "owner" || membershipData?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const species = searchParams.get("species") || null;
    const weapon = searchParams.get("weapon") || null;
    const unit = searchParams.get("unit") || null;
    const state = searchParams.get("state") || null;
    const category = searchParams.get("category") || null;
    const approvedForMarketing = searchParams.get("approved_for_marketing");
    const huntId = searchParams.get("hunt_id") || null;
    const closeoutId = searchParams.get("closeout_id") || null;

    // Build query
    let query = supabase
      .from("hunt_photos")
      .select(`
        *,
        hunt_closeouts:hunt_closeouts(
          id,
          hunt_id,
          species,
          weapon,
          unit,
          state,
          guide_username,
          client_email,
          harvested,
          success_summary
        ),
        calendar_events:hunt_id(
          id,
          title,
          start_time,
          end_time
        )
      `)
      .eq("outfitter_id", outfitterId)
      .order("uploaded_at", { ascending: false });

    if (species) query = query.eq("species", species);
    if (weapon) query = query.eq("weapon", weapon);
    if (unit) query = query.eq("unit", unit);
    if (state) query = query.eq("state", state);
    if (category) query = query.eq("category", category);
    if (approvedForMarketing !== null) {
      query = query.eq("approved_for_marketing", approvedForMarketing === "true");
    }
    if (huntId) query = query.eq("hunt_id", huntId);
    if (closeoutId) query = query.eq("closeout_id", closeoutId);

    const { data: photos, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for each photo (valid for 1 hour)
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo: any) => {
        try {
          const { data: urlData } = await supabase.storage
            .from("hunt-photos")
            .createSignedUrl(photo.storage_path, 3600);

          return {
            ...photo,
            signed_url: urlData?.signedUrl || null,
          };
        } catch (e) {
          return {
            ...photo,
            signed_url: null,
          };
        }
      })
    );

    return NextResponse.json({
      photos: photosWithUrls,
      total: photosWithUrls.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
