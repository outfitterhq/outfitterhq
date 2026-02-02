import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Hunt packet manifest for a hunt assigned to the current guide
 * Returns hunt, contract (with content), questionnaire, and guide documents list
 * so the UI can display or link to "Download Hunt Packet" (ZIP) or individual items.
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

    const { data: guide, error: guideErr } = await supabase
      .from("guides")
      .select("id, username, email, outfitter_id, name")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .single();

    if (guideErr || !guide) {
      return NextResponse.json({ error: "Guide record not found" }, { status: 404 });
    }

    const { data: hunt, error: huntErr } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", id)
      .eq("outfitter_id", guide.outfitter_id)
      .single();

    if (huntErr || !hunt) {
      return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
    }

    const isAssigned =
      hunt.guide_username === guide.username || hunt.guide_username === guide.email;
    if (!isAssigned) {
      return NextResponse.json({ error: "You are not assigned to this hunt" }, { status: 403 });
    }

    let questionnaire = null;
    if (hunt.client_email) {
      const { data: quest } = await supabase
        .from("client_questionnaires")
        .select("*")
        .eq("email", hunt.client_email)
        .eq("outfitter_id", guide.outfitter_id)
        .single();
      questionnaire = quest;
    }

    const { data: contract } = await supabase
      .from("hunt_contracts")
      .select("id, status, content, client_signed_at, admin_signed_at")
      .eq("hunt_id", id)
      .single();

    const { data: guideDocs } = await supabase
      .from("guide_documents")
      .select("id, title, file_name, storage_path")
      .eq("guide_id", guide.id)
      .order("uploaded_at", { ascending: false });

    return NextResponse.json({
      hunt: {
        id: hunt.id,
        title: hunt.title,
        start_time: hunt.start_time,
        end_time: hunt.end_time,
        species: hunt.species,
        unit: hunt.unit,
        weapon: hunt.weapon,
        client_email: hunt.client_email,
        camp_name: hunt.camp_name,
      },
      contract: contract ?? null,
      questionnaire,
      guide_documents: (guideDocs ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        file_name: d.file_name,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
