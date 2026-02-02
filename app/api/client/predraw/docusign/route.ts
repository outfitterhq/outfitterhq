import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * POST /api/client/predraw/docusign
 * Creates a DocuSign signing envelope for the current user's pre-draw contract and returns the signing URL.
 * Matches iOS DocuSign flow (DocuSignService.createSigningURL).
 * Returns 503 if DocuSign is not configured.
 */
export async function POST() {
  const supabase = await supabaseRoute();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  const { data: links } = await supabase
    .from("client_outfitter_links")
    .select("outfitter_id, outfitters:outfitters(name)")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .limit(1);

  if (!links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  const outfitterId = links[0].outfitter_id;
  const outfitterName = (links[0] as any).outfitters?.name || "Outfitter";
  const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || userEmail || "";

  const currentYear = new Date().getFullYear();
  const { data: predraw } = await supabase
    .from("client_predraw_submissions")
    .select("id, docusign_envelope_id, docusign_status")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .eq("year", currentYear)
    .single();

  // DocuSign integration: same pattern as waiver/sign
  const docusignConfigured = Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY && process.env.DOCUSIGN_ACCOUNT_ID
  );

  if (!docusignConfigured) {
    return NextResponse.json(
      {
        error: "DocuSign integration is not configured. Please contact your outfitter to sign the pre-draw contract.",
        needsConfiguration: true,
      },
      { status: 503 }
    );
  }

  // TODO: Implement actual DocuSign envelope creation for pre-draw (template + signer)
  // 1. Create envelope with pre-draw contract template
  // 2. Add client as signer
  // 3. Generate embedded signing URL
  // 4. Update client_predraw_submissions.docusign_envelope_id and docusign_status
  try {
    // Placeholder: when DocuSign is wired, call createDocuSignEnvelope({ clientEmail, clientName, outfitterName, documentType: "predraw" })
    // and update predraw row with envelope ID
    const signingUrl = ""; // await createDocuSignEnvelope(...)
    if (!signingUrl) {
      throw new Error("DocuSign implementation required");
    }
    return NextResponse.json({ signingUrl, message: "Complete signing in DocuSign" });
  } catch (e: any) {
    console.error("Pre-draw DocuSign error:", e);
    return NextResponse.json(
      { error: e.message || "DocuSign is not fully configured for pre-draw signing yet." },
      { status: 503 }
    );
  }
}
