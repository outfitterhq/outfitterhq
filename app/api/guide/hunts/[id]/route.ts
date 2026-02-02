import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get detailed view of a specific hunt assigned to the guide
 * Includes full questionnaire and contract details
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

    // Get guide record for current user
    const { data: guide, error: guideErr } = await supabase
      .from("guides")
      .select("id, username, email, outfitter_id, name")
      .eq("user_id", userRes.user.id)
      .single();

    if (guideErr || !guide) {
      return NextResponse.json({ error: "Guide record not found" }, { status: 404 });
    }

    // Get the hunt
    const { data: hunt, error: huntErr } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", id)
      .eq("outfitter_id", guide.outfitter_id)
      .single();

    if (huntErr || !hunt) {
      return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
    }

    // Verify guide is assigned to this hunt
    const isAssigned = 
      hunt.guide_username === guide.username || 
      hunt.guide_username === guide.email;

    if (!isAssigned) {
      return NextResponse.json(
        { error: "You are not assigned to this hunt" },
        { status: 403 }
      );
    }

    // Get client info
    let clientInfo = null;
    let questionnaire = null;
    
    if (hunt.client_email) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone")
        .eq("email", hunt.client_email)
        .single();

      clientInfo = client;

      // Get questionnaire (VIEW only)
      const { data: quest } = await supabase
        .from("client_questionnaires")
        .select("*")
        .eq("email", hunt.client_email)
        .eq("outfitter_id", guide.outfitter_id)
        .single();

      questionnaire = quest;
    }

    // Get contract for this hunt
    const { data: contract } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        status,
        client_completed_at,
        client_signed_at,
        admin_signed_at,
        docusign_status,
        signed_document_path
      `)
      .eq("hunt_id", id)
      .single();

    return NextResponse.json({
      hunt,
      client: clientInfo,
      questionnaire,
      contract,
      guide_permissions: {
        can_view_questionnaire: true,
        can_edit_questionnaire: false,
        can_view_contract: true,
        can_edit_contract: false,
      },
    });

  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
