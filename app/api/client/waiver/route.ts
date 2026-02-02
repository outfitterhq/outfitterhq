import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  // Get client record
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter
  const { data: links } = await supabase
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .limit(1);

  if (!links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  const outfitterId = links[0].outfitter_id;

  // Get outfitter's waiver PDF path (per-outfitter upload)
  const { data: outfitterRow } = await supabase
    .from("outfitters")
    .select("waiver_document_path")
    .eq("id", outfitterId)
    .single();

  let waiverPdfUrl: string | null = null;
  if (outfitterRow?.waiver_document_path) {
    try {
      const { data: signed } = await supabase.storage
        .from("outfitter-documents")
        .createSignedUrl(outfitterRow.waiver_document_path, 3600); // 1 hour
      waiverPdfUrl = signed?.signedUrl ?? null;
    } catch {
      // Bucket or file may not exist yet
    }
  }

  // Get waiver document
  const { data: waiver } = await supabase
    .from("documents")
    .select("id, status, docusign_envelope_id, docusign_status, client_signed_at")
    .eq("linked_id", userEmail)
    .eq("outfitter_id", outfitterId)
    .eq("document_type", "waiver")
    .single();

  // Get active waiver template for this outfitter
  const { data: template } = await supabase
    .from("contract_templates")
    .select("content")
    .eq("outfitter_id", outfitterId)
    .eq("template_type", "waiver")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Get client and outfitter info for placeholder replacement
  const { data: clientData } = await supabase
    .from("clients")
    .select("first_name, last_name, email")
    .eq("id", client.id)
    .single();

  const { data: outfitterData } = await supabase
    .from("outfitters")
    .select("name")
    .eq("id", outfitterId)
    .single();

  // Replace placeholders in template content
  let waiverContent = template?.content || null;
  if (waiverContent && clientData && outfitterData) {
    const clientName = `${clientData.first_name || ""} ${clientData.last_name || ""}`.trim() || clientData.email;
    waiverContent = waiverContent
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{client_email\}\}/g, clientData.email || "")
      .replace(/\{\{outfitter_name\}\}/g, outfitterData.name || "Outfitter");
  }

  return NextResponse.json({
    status: waiver?.status || "not_started",
    docusign_envelope_id: waiver?.docusign_envelope_id,
    docusign_status: waiver?.docusign_status,
    signed_at: waiver?.client_signed_at,
    content: waiverContent,
    waiver_pdf_url: waiverPdfUrl,
  });
}
