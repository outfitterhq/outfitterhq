import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET /api/guides/[id]/hunts
 * Get hunts for a specific guide, separated by closed out vs not closed out
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get guide info to find their username/email and full details
    const { data: guideData, error: guideError } = await supabase
      .from("guides")
      .select("id, username, email, user_id, name, phone, is_active, notes, has_guide_license, has_cpr_card, has_leave_no_trace, created_at, updated_at")
      .eq("user_id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (guideError || !guideData) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    const guideUsername = guideData.username || guideData.email || "";

    // Get guide documents
    let documents: any[] = [];
    if (guideData.id) {
      const { data: docsData, error: docsError } = await supabase
        .from("guide_documents")
        .select("id, title, storage_path, uploaded_at")
        .eq("guide_id", guideData.id)
        .order("uploaded_at", { ascending: false });
      
      if (!docsError && docsData) {
        documents = docsData;
      }
    }

    // Get all hunts assigned to this guide
    const { data: hunts, error: huntsError } = await supabase
      .from("calendar_events")
      .select("id, title, species, unit, weapon, start_time, end_time, status, client_email, camp_name")
      .eq("outfitter_id", outfitterId)
      .eq("guide_username", guideUsername)
      .order("start_time", { ascending: false });

    if (huntsError) {
      return NextResponse.json({ error: huntsError.message }, { status: 500 });
    }

    // Get all closeouts for these hunts
    const huntIds = (hunts || []).map((h: any) => h.id);
    let closeouts: any[] = [];
    let closeoutsError = null;
    
    if (huntIds.length > 0) {
      const result = await supabase
        .from("hunt_closeouts")
        .select("hunt_id, id, submitted_at, is_locked")
        .in("hunt_id", huntIds);
      closeouts = result.data || [];
      closeoutsError = result.error;
    }

    if (closeoutsError) {
      return NextResponse.json({ error: closeoutsError.message }, { status: 500 });
    }

    // Create a set of hunt IDs that have closeouts
    const closeoutHuntIds = new Set((closeouts || []).map((c: any) => c.hunt_id));

    // Separate hunts into closed out and not closed out
    const closedOut = (hunts || []).filter((h: any) => closeoutHuntIds.has(h.id));
    const notClosedOut = (hunts || []).filter((h: any) => !closeoutHuntIds.has(h.id));

    return NextResponse.json({
      guide: {
        id: guideData.id,
        user_id: id,
        username: guideUsername,
        name: guideData.name || guideData.username || guideData.email || "Guide",
        email: guideData.email || "",
        phone: guideData.phone || "",
        is_active: guideData.is_active ?? true,
        notes: guideData.notes || "",
        has_guide_license: guideData.has_guide_license ?? false,
        has_cpr_card: guideData.has_cpr_card ?? false,
        has_leave_no_trace: guideData.has_leave_no_trace ?? false,
        created_at: guideData.created_at,
        updated_at: guideData.updated_at,
      },
      documents: documents.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        storage_path: doc.storage_path,
        uploaded_at: doc.uploaded_at,
      })),
      closedOut: closedOut.map((h: any) => ({
        id: h.id,
        title: h.title,
        species: h.species,
        unit: h.unit,
        weapon: h.weapon,
        start_time: h.start_time,
        end_time: h.end_time,
        status: h.status,
        client_email: h.client_email,
        camp_name: h.camp_name,
      })),
      notClosedOut: notClosedOut.map((h: any) => ({
        id: h.id,
        title: h.title,
        species: h.species,
        unit: h.unit,
        weapon: h.weapon,
        start_time: h.start_time,
        end_time: h.end_time,
        status: h.status,
        client_email: h.client_email,
        camp_name: h.camp_name,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
