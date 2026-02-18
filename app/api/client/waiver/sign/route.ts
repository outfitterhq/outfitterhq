import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * POST /api/client/waiver/sign
 * Signs the waiver. Supports in-app signing (typed_name) or DocuSign.
 */

export async function POST(req: Request) {
  const supabase = await supabaseRoute();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  let body: { typed_name?: string } = {};
  try {
    body = await req.json();
  } catch { /* optional */ }
  const typed_name = body.typed_name;

  // Get client record
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter
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

  // In-app signing when typed_name provided
  const useInAppSigning = typeof typed_name === "string" && typed_name.trim().length > 0;
  if (useInAppSigning) {
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id")
      .eq("linked_id", userEmail)
      .eq("outfitter_id", outfitterId)
      .eq("document_type", "waiver")
      .single();
    if (existingDoc) {
      const { error: updateErr } = await supabase
        .from("documents")
        .update({
          status: "signed",
          client_signed_at: new Date().toISOString(),
          docusign_status: "signed",
        })
        .eq("id", existingDoc.id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    } else {
      const { error: insertErr } = await supabase
        .from("documents")
        .insert({
          outfitter_id: outfitterId,
          linked_type: "client",
          linked_id: userEmail,
          document_type: "waiver",
          status: "signed",
          client_signed_at: new Date().toISOString(),
          docusign_status: "signed",
        });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, signing_method: "in_app", message: "Waiver signed successfully." });
  }

  const outfitterName = (links[0] as any).outfitters?.name || "Outfitter";
  const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || (userEmail ?? "");

  const docusignConfigured = Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY &&
    process.env.DOCUSIGN_ACCOUNT_ID
  );

  if (!docusignConfigured) {
    return NextResponse.json(
      {
        error: "DocuSign is not configured yet. Your outfitter can enable it in settings. You can still review the waiver below.",
        needsConfiguration: true,
      },
      { status: 503 }
    );
  }

  // Check for existing document (only needed once DocuSign is configured)
  let { data: existingDoc } = await supabase
    .from("documents")
    .select("id, docusign_envelope_id")
    .eq("linked_id", userEmail)
    .eq("outfitter_id", outfitterId)
    .eq("document_type", "waiver")
    .single();

  // DocuSign is configured - create envelope and get signing URL
  try {
    const signingUrl = await createDocuSignEnvelope({
      clientEmail: userEmail!,
      clientName,
      outfitterName,
      documentType: "waiver",
    });

    // Update or create document record
    if (existingDoc) {
      await supabase
        .from("documents")
        .update({
          docusign_status: "sent",
          status: "submitted",
        })
        .eq("id", existingDoc.id);
    } else {
      await supabase
        .from("documents")
        .insert({
          outfitter_id: outfitterId,
          linked_type: "client",
          linked_id: userEmail,
          document_type: "waiver",
          status: "submitted",
          docusign_status: "sent",
        });
    }

    return NextResponse.json({
      signingUrl,
      message: "Please complete signing in DocuSign",
    });
  } catch (e: any) {
    console.error("DocuSign error:", e);
    return NextResponse.json({ error: e.message || "DocuSign error" }, { status: 500 });
  }
}

// DocuSign envelope creation (placeholder for actual implementation)
async function createDocuSignEnvelope(params: {
  clientEmail: string;
  clientName: string;
  outfitterName: string;
  documentType: string;
}): Promise<string> {
  // TODO: Implement actual DocuSign API calls
  // 
  // Example implementation:
  // 1. Authenticate with DocuSign API
  // 2. Create envelope definition with template
  // 3. Add recipient (signer)
  // 4. Create envelope
  // 5. Get embedded signing URL
  //
  // const dsApiClient = new docusign.ApiClient();
  // dsApiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH);
  // const accessToken = await getDocuSignAccessToken();
  // dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
  // 
  // const envelopesApi = new docusign.EnvelopesApi(dsApiClient);
  // const envelope = await envelopesApi.createEnvelope(accountId, { envelopeDefinition });
  // const viewRequest = await envelopesApi.createRecipientView(accountId, envelope.envelopeId, { recipientViewRequest });
  // return viewRequest.url;

  throw new Error("DocuSign implementation required");
}
