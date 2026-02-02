import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: Get client details by email
export async function GET(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
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

    const { email } = await params;
    const decodedEmail = decodeURIComponent(email);
    
    console.log("🔵 Client detail API - email:", decodedEmail, "outfitterId:", outfitterId);

    // Get client from clients table
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .eq("email", decodedEmail)
      .maybeSingle();
    
    console.log("🔵 Direct client lookup:", clientData?.id || "not found");

    // Get calendar events for this client
    const { data: calendarEvents } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .eq("client_email", decodedEmail)
      .order("start_time", { ascending: false });

    // Get hunt contracts for this client
    const { data: huntContracts } = await supabase
      .from("hunt_contracts")
      .select("id, status, client_email, hunt_id, created_at, client_signed_at, admin_signed_at, content")
      .eq("outfitter_id", outfitterId)
      .eq("client_email", decodedEmail)
      .order("created_at", { ascending: false });

    // Get documents linked to this client (document_type, status, signing timestamps)
    // First get client ID to query by client_id column
    let clientIdForDocs: string | null = clientData?.id || null;
    if (!clientIdForDocs) {
      const { data: clientLookup } = await supabase
        .from("clients")
        .select("id")
        .eq("email", decodedEmail)
        .maybeSingle();
      clientIdForDocs = clientLookup?.id || null;
    }
    
    // Query documents by client_id OR linked_id (for backwards compatibility)
    let rawDocs: any[] = [];
    if (clientIdForDocs) {
      const { data: docsByClientId } = await supabase
        .from("documents")
        .select("id, storage_path, linked_type, linked_id, client_id, created_at, document_type, status, client_signed_at, admin_signed_at")
        .eq("outfitter_id", outfitterId)
        .eq("client_id", clientIdForDocs)
        .order("created_at", { ascending: false });
      rawDocs = docsByClientId || [];
    }
    
    // Also check legacy linked_id (email) documents
    const { data: docsByEmail } = await supabase
      .from("documents")
      .select("id, storage_path, linked_type, linked_id, client_id, created_at, document_type, status, client_signed_at, admin_signed_at")
      .eq("outfitter_id", outfitterId)
      .or(`linked_id.eq.${decodedEmail},linked_id.ilike.%${decodedEmail}%`)
      .order("created_at", { ascending: false });
    
    // Merge and dedupe by id
    const seenIds = new Set(rawDocs.map(d => d.id));
    for (const doc of (docsByEmail || [])) {
      if (!seenIds.has(doc.id)) {
        rawDocs.push(doc);
        seenIds.add(doc.id);
      }
    }
    
    console.log("🔵 Found documents:", rawDocs.length, "for client:", clientIdForDocs || decodedEmail);

    // Get client ID to check questionnaires and pre-draw submissions
    let clientId: string | null = clientData?.id || null;
    
    // If no direct client record, check client_outfitter_links
    if (!clientId) {
      const { data: linkData } = await supabase
        .from("clients")
        .select("id")
        .eq("email", decodedEmail)
        .maybeSingle();
      clientId = linkData?.id || null;
    }

    console.log("🔵 Looking up docs for clientId:", clientId);

    // Check for questionnaire submission (include admin_reviewed_at)
    let hasQuestionnaire = false;
    let questionnaireData: any = null;
    if (clientId) {
      const { data: qData, error: qError } = await supabase
        .from("client_questionnaires")
        .select("id, submitted_at, admin_reviewed_at")
        .eq("client_id", clientId)
        .eq("outfitter_id", outfitterId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log("🔵 Questionnaire lookup:", qData?.id || "none", "reviewed:", qData?.admin_reviewed_at || "no", "error:", qError?.message);
      
      if (qData) {
        hasQuestionnaire = true;
        questionnaireData = qData;
      }
    }

    // Check for pre-draw submission (include admin_reviewed_at)
    let hasPredraw = false;
    let predrawData: any = null;
    if (clientId) {
      const { data: pData, error: pError } = await supabase
        .from("client_predraw_submissions")
        .select("id, submitted_at, docusign_status, admin_reviewed_at")
        .eq("client_id", clientId)
        .eq("outfitter_id", outfitterId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log("🔵 Pre-draw lookup:", pData?.id || "none", "reviewed:", pData?.admin_reviewed_at || "no", "error:", pError?.message);
      
      if (pData) {
        hasPredraw = true;
        predrawData = pData;
      }
    }

    type Doc = {
      id: string;
      storage_path?: string | null;
      linked_type?: string | null;
      linked_id?: string | null;
      created_at?: string | null;
      document_type: "contract" | "waiver" | "questionnaire" | "predraw" | "other";
      status: string;
      client_signed_at?: string | null;
      admin_signed_at?: string | null;
    };

    function inferType(d: any): "contract" | "waiver" | "questionnaire" | "predraw" | "other" {
      const t = (d.document_type || d.linked_type || "").toLowerCase();
      const path = (d.storage_path || "").toLowerCase();
      if (t === "questionnaire" || path.includes("questionnaire")) return "questionnaire";
      if (t === "predraw" || path.includes("predraw")) return "predraw";
      if (t === "waiver" || path.includes("waiver") || path.includes("liability")) return "waiver";
      if (t === "contract" || path.includes("contract")) return "contract";
      return "other";
    }

    const docs: Doc[] = (rawDocs || []).map((d: any) => ({
      id: d.id,
      storage_path: d.storage_path,
      linked_type: d.linked_type,
      linked_id: d.linked_id,
      created_at: d.created_at,
      document_type: (d.document_type && ["contract", "waiver", "questionnaire", "predraw", "other"].includes(d.document_type))
        ? d.document_type
        : inferType(d),
      status: d.status || "not_submitted",
      client_signed_at: d.client_signed_at,
      admin_signed_at: d.admin_signed_at,
    }));

    // Add questionnaire from client_questionnaires if not already in documents
    const hasQuestionnaireDoc = docs.some(d => d.document_type === "questionnaire");
    if (hasQuestionnaire && !hasQuestionnaireDoc && questionnaireData) {
      // Status: if admin reviewed, show as "admin_signed" (reviewed)
      const qStatus = questionnaireData.admin_reviewed_at ? "admin_signed" : "submitted";
      docs.push({
        id: `questionnaire-${questionnaireData.id}`,
        storage_path: null,
        linked_type: "questionnaire",
        linked_id: decodedEmail,
        created_at: questionnaireData.submitted_at,
        document_type: "questionnaire",
        status: qStatus,
        client_signed_at: questionnaireData.submitted_at,
        admin_signed_at: questionnaireData.admin_reviewed_at,
      });
    }

    // Add pre-draw from client_predraw_submissions if not already in documents  
    const hasPredrawDoc = docs.some(d => d.document_type === "predraw" || d.document_type === "contract");
    if (hasPredraw && !hasPredrawDoc && predrawData) {
      // Determine status based on docusign and admin review
      let pStatus = "submitted";
      if (predrawData.docusign_status === "completed") {
        pStatus = predrawData.admin_reviewed_at ? "fully_executed" : "client_signed";
      } else if (predrawData.admin_reviewed_at) {
        pStatus = "admin_signed"; // admin reviewed
      }
      
      docs.push({
        id: `predraw-${predrawData.id}`,
        storage_path: null,
        linked_type: "predraw",
        linked_id: decodedEmail,
        created_at: predrawData.submitted_at,
        document_type: "predraw",
        status: pStatus,
        client_signed_at: predrawData.submitted_at,
        admin_signed_at: predrawData.admin_reviewed_at,
      });
    }

    const requiredTypes: Array<"contract" | "waiver" | "questionnaire" | "predraw"> = ["predraw", "questionnaire", "waiver", "contract"];
    const hasType = (dt: string) => docs.some((d) => d.document_type === dt);
    const placeholders: Doc[] = requiredTypes
      .filter((dt) => !hasType(dt))
      .map((dt) => ({
        id: `placeholder-${dt}`,
        storage_path: null,
        linked_type: null,
        linked_id: null,
        created_at: null,
        document_type: dt,
        status: "not_submitted",
        client_signed_at: null,
        admin_signed_at: null,
      }));

    const documents = [...docs, ...placeholders].sort((a, b) => {
      const order = { predraw: 0, questionnaire: 1, waiver: 2, contract: 3, other: 4 };
      return (order[a.document_type] ?? 4) - (order[b.document_type] ?? 4);
    });

    return NextResponse.json(
      {
        client: clientData || {
          email: decodedEmail,
          first_name: null,
          last_name: null,
          phone: null,
          source: "calendar",
        },
        calendarEvents: calendarEvents || [],
        huntContracts: huntContracts || [],
        documents,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
