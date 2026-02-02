import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { SuccessRecord } from "@/lib/types/hunt-closeout";

/**
 * GET /api/success-records
 * Get success records with optional filtering
 * Query params: species, weapon, unit, state, year, guide_username
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData?.session?.user ?? null;
    if (!user) {
      const auth = req.headers.get("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: { user: u } } = await supabase.auth.getUser(auth.slice(7));
        user = u ?? null;
      }
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const species = searchParams.get("species") || null;
    const weapon = searchParams.get("weapon") || null;
    const unit = searchParams.get("unit") || null;
    const state = searchParams.get("state") || null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    const guideUsername = searchParams.get("guide_username") || null;

    // Check if user is client (limited access) or admin/guide (full access)
    const { data: clientData } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    const isClient = !!clientData;

    // Get outfitter ID - different logic for clients vs admins/guides
    let outfitterId: string | null = null;

    if (isClient) {
      // For clients, get outfitter from client_outfitter_links
      const { data: linkData } = await supabase
        .from("client_outfitter_links")
        .select("outfitter_id")
        .eq("client_id", clientData.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (linkData) {
        outfitterId = linkData.outfitter_id;
      } else {
        return NextResponse.json({ error: "Client not linked to any outfitter" }, { status: 403 });
      }
    } else {
      // For admins/guides, get outfitter from cookie
      const store = await cookies();
      outfitterId = store.get(OUTFITTER_COOKIE)?.value || null;
      if (!outfitterId) {
        return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
      }
    }

    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter found" }, { status: 400 });
    }

    // Check membership for admin/guide roles
    const { data: membershipData } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .maybeSingle();

    const isAdmin = membershipData?.role === "owner" || membershipData?.role === "admin";
    const isGuide = membershipData?.role === "guide";

    // Use RPC function for filtering, with fallback to direct view query
    let records: any[] = [];
    
    const rpcResult = await supabase.rpc("get_success_records", {
      p_outfitter_id: outfitterId,
      p_species: species,
      p_weapon: weapon,
      p_unit: unit,
      p_state: state,
      p_year: year,
      p_guide_username: guideUsername,
    });

    if (rpcResult.error) {
      console.error("❌ RPC get_success_records error:", rpcResult.error);
      console.log("⚠️ Falling back to direct view query...");
      
      // Fallback: query the view directly
      let query = supabase
        .from("success_records")
        .select("*")
        .eq("outfitter_id", outfitterId);

      if (species) query = query.eq("species", species);
      if (weapon) query = query.eq("weapon", weapon);
      if (unit) query = query.eq("unit", unit);
      if (state) query = query.eq("state", state);
      if (year) query = query.eq("season_year", year);
      if (guideUsername) query = query.eq("guide_username", guideUsername);

      const fallbackResult = await query.order("submitted_at", { ascending: false });
      
      if (fallbackResult.error) {
        console.error("❌ Fallback query also failed:", fallbackResult.error);
        return NextResponse.json({ 
          error: "Failed to load success records",
          rpcError: rpcResult.error.message,
          fallbackError: fallbackResult.error.message,
          details: fallbackResult.error.details,
          hint: fallbackResult.error.hint || "Make sure migration 026_fix_success_records_rpc_complete.sql has been run",
          code: fallbackResult.error.code
        }, { status: 500 });
      }
      
      records = fallbackResult.data || [];
      console.log("✅ Fallback query succeeded, returned", records.length, "records");
    } else {
      records = rpcResult.data || [];
      console.log("✅ RPC query succeeded, returned", records.length, "records");
    }

    // Filter for clients: only show marketing-approved photos
    let filteredRecords = records || [];
    if (isClient && !isAdmin && !isGuide) {
      // Clients only see records with marketing photos
      filteredRecords = filteredRecords.filter((r: any) => r.marketing_photos > 0);
    }

    // Attach primary photo URL for each record (first photo per closeout) so success library and client can show images
    const closeoutIds = [...new Set((filteredRecords as any[]).map((r: any) => r.closeout_id).filter(Boolean))];
    const primaryPhotoByCloseout: Record<string, string> = {};

    if (closeoutIds.length > 0) {
      const { data: photos } = await supabase
        .from("hunt_photos")
        .select("id, closeout_id, storage_path, approved_for_marketing")
        .in("closeout_id", closeoutIds)
        .order("display_order", { ascending: true });

      // For clients: prefer first marketing-approved photo per closeout; for admin: first by display_order
      type PhotoChoice = { id: string; storage_path: string; approved_for_marketing?: boolean };
      const firstPerCloseout = new Map<string, PhotoChoice>();
      const preferMarketing = isClient && !isAdmin && !isGuide;
      for (const p of photos || []) {
        const cid = p.closeout_id;
        const existing = firstPerCloseout.get(cid);
        if (!existing) {
          firstPerCloseout.set(cid, { id: p.id, storage_path: p.storage_path, approved_for_marketing: p.approved_for_marketing });
          continue;
        }
        // For client: replace only if we don't have a marketing one yet and this one is marketing
        if (preferMarketing && p.approved_for_marketing && !existing.approved_for_marketing) {
          firstPerCloseout.set(cid, { id: p.id, storage_path: p.storage_path, approved_for_marketing: true });
        }
      }

      const admin = supabaseAdmin();
      for (const [closeoutId, photo] of firstPerCloseout) {
        try {
          const { data: urlData } = await admin.storage
            .from("hunt-photos")
            .createSignedUrl(photo.storage_path, 3600);
          if (urlData?.signedUrl) primaryPhotoByCloseout[closeoutId] = urlData.signedUrl;
        } catch (_) {
          // Skip failed signed URL
        }
      }
    }

    const recordsWithPhotos = (filteredRecords as any[]).map((r: any) => ({
      ...r,
      primary_photo_url: r.closeout_id ? primaryPhotoByCloseout[r.closeout_id] ?? null : null,
    }));

    return NextResponse.json({
      records: recordsWithPhotos,
      total: recordsWithPhotos.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
