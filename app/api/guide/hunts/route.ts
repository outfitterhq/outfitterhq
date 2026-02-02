import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get hunts assigned to the current guide
 * Includes hunt details, client questionnaires, and contract status
 * 
 * Visibility rules:
 * - Guide can only see hunts they are assigned to (via guide_username)
 * - Guide can VIEW (not edit) client questionnaires for assigned hunts
 * - Guide can VIEW contract status for assigned hunts
 */
export async function GET(req: Request) {
  try {
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
      .eq("is_active", true)
      .single();

    if (guideErr) {
      console.error("Guide lookup error:", guideErr);
      return NextResponse.json({ 
        error: "Guide record not found",
        details: guideErr.message 
      }, { status: 404 });
    }

    if (!guide) {
      return NextResponse.json({ error: "Guide record not found" }, { status: 404 });
    }

    // Get hunts where this guide is assigned
    // Match by username or email (whichever was used for assignment)
    const guideUsernameOrEmail = guide.username || guide.email;
    
    if (!guideUsernameOrEmail) {
      console.warn("Guide has no username or email:", guide);
      return NextResponse.json({ 
        error: "Guide username or email not found",
        hunts: [],
        total: 0 
      }, { status: 200 });
    }

    // Build query - match by username or email
    // Note: calendar_events uses start_time/end_time (not start_date/end_date)
    let query = supabase
      .from("calendar_events")
      .select(`
        id,
        title,
        notes,
        start_time,
        end_time,
        camp_name,
        client_email,
        guide_username,
        species,
        unit,
        weapon,
        status,
        hunt_type,
        tag_status,
        contract_generated_at
      `)
      .eq("outfitter_id", guide.outfitter_id);

    // Build OR condition for guide matching
    if (guide.username && guide.email && guide.username !== guide.email) {
      query = query.or(`guide_username.eq.${guide.username},guide_username.eq.${guide.email}`);
    } else if (guideUsernameOrEmail) {
      query = query.eq("guide_username", guideUsernameOrEmail);
    } else {
      query = query.eq("guide_username", guide.email);
    }

    const { data: hunts, error: huntsErr } = await query.order("start_time", { ascending: true });

    if (huntsErr) {
      console.error("Error fetching hunts:", huntsErr);
      return NextResponse.json({ 
        error: huntsErr.message || "Failed to fetch hunts",
        details: huntsErr.details,
        hint: huntsErr.hint
      }, { status: 500 });
    }

    // Get client emails for questionnaire lookup
    const clientEmails = [...new Set(
      (hunts ?? [])
        .map(h => h.client_email)
        .filter(Boolean)
    )];

    // Get questionnaires for assigned clients (VIEW only)
    const { data: questionnaires } = await supabase
      .from("client_questionnaires")
      .select(`
        id,
        client_id,
        full_name,
        contact_phone,
        email,
        emergency_contact_name,
        emergency_contact_phone,
        food_allergies,
        food_preferences,
        physical_limitations,
        health_concerns,
        general_notes,
        submitted_at
      `)
      .eq("outfitter_id", guide.outfitter_id)
      .in("email", clientEmails);

    // Get hunt contracts for assigned hunts
    const huntIds = (hunts ?? []).map(h => h.id);
    const { data: contracts } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        hunt_id,
        status,
        client_signed_at,
        admin_signed_at,
        docusign_status
      `)
      .in("hunt_id", huntIds);

    // Map questionnaires and contracts to hunts
    const questMap = new Map(
      (questionnaires ?? []).map(q => [q.email, q])
    );
    const contractMap = new Map(
      (contracts ?? []).map(c => [c.hunt_id, c])
    );

    const enrichedHunts = (hunts ?? []).map(hunt => ({
      ...hunt,
      client_questionnaire: hunt.client_email ? questMap.get(hunt.client_email) || null : null,
      contract: contractMap.get(hunt.id) || null,
    }));

    return NextResponse.json({
      guide: {
        id: guide.id,
        name: guide.name,
        username: guide.username,
      },
      hunts: enrichedHunts,
      total: enrichedHunts.length,
    });

  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
