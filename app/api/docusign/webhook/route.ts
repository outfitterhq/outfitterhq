import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST: DocuSign Connect webhook handler
 * 
 * Receives status updates from DocuSign when envelope events occur:
 * - sent: Envelope sent to signers
 * - delivered: Envelope viewed by signer
 * - signed: Signer has signed
 * - completed: All signers have signed
 * - declined: Signer declined
 * - voided: Envelope voided
 * 
 * This webhook updates hunt_contracts with the latest status.
 */
export async function POST(req: Request) {
  try {
    // DocuSign sends XML by default, but can be configured for JSON
    const contentType = req.headers.get("content-type") || "";
    
    let envelopeId: string | null = null;
    let envelopeStatus: string | null = null;
    let signerStatuses: Array<{ email: string; status: string; signedAt?: string }> = [];

    if (contentType.includes("application/json")) {
      const body = await req.json();
      
      // DocuSign JSON format
      envelopeId = body.envelopeId || body.data?.envelopeId;
      envelopeStatus = body.status || body.data?.envelopeSummary?.status;
      
      // Extract signer info
      if (body.data?.envelopeSummary?.recipients?.signers) {
        signerStatuses = body.data.envelopeSummary.recipients.signers.map((s: any) => ({
          email: s.email,
          status: s.status,
          signedAt: s.signedDateTime,
        }));
      }
    } else {
      // Handle XML (DocuSign default)
      const xmlBody = await req.text();
      
      // Simple XML parsing for envelope status
      const envelopeIdMatch = xmlBody.match(/<EnvelopeID>([^<]+)<\/EnvelopeID>/);
      const statusMatch = xmlBody.match(/<Status>([^<]+)<\/Status>/);
      
      envelopeId = envelopeIdMatch?.[1] || null;
      envelopeStatus = statusMatch?.[1] || null;
    }

    if (!envelopeId) {
      console.log("DocuSign webhook: No envelope ID found");
      return NextResponse.json({ error: "No envelope ID" }, { status: 400 });
    }

    // Create admin supabase client for webhook (no user context)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the contract by envelope ID
    const { data: contract, error: findErr } = await supabase
      .from("hunt_contracts")
      .select("id, status, client_email")
      .eq("docusign_envelope_id", envelopeId)
      .single();

    if (findErr || !contract) {
      console.log(`DocuSign webhook: Contract not found for envelope ${envelopeId}`);
      // Return 200 to prevent DocuSign from retrying
      return NextResponse.json({ 
        received: true, 
        processed: false,
        reason: "Contract not found" 
      });
    }

    // Map DocuSign status to our status
    const statusMap: Record<string, { docusignStatus: string; contractStatus?: string }> = {
      sent: { docusignStatus: "sent" },
      delivered: { docusignStatus: "delivered" },
      signed: { docusignStatus: "signed", contractStatus: "client_signed" },
      completed: { docusignStatus: "completed", contractStatus: "fully_executed" },
      declined: { docusignStatus: "declined", contractStatus: "cancelled" },
      voided: { docusignStatus: "voided", contractStatus: "cancelled" },
    };

    const statusLower = envelopeStatus?.toLowerCase() || "";
    const mapped = statusMap[statusLower];

    if (!mapped) {
      console.log(`DocuSign webhook: Unknown status ${envelopeStatus}`);
      return NextResponse.json({ 
        received: true, 
        processed: false,
        reason: `Unknown status: ${envelopeStatus}` 
      });
    }

    // Build update object
    const updateData: any = {
      docusign_status: mapped.docusignStatus,
    };

    if (mapped.contractStatus) {
      updateData.status = mapped.contractStatus;
    }

    // Set signature timestamps based on status
    if (statusLower === "signed" || statusLower === "completed") {
      // Check if client signed
      const clientSigner = signerStatuses.find(s => s.email === contract.client_email);
      if (clientSigner?.signedAt) {
        updateData.client_signed_at = clientSigner.signedAt;
      }
    }

    if (statusLower === "completed") {
      updateData.admin_signed_at = new Date().toISOString();
    }

    // Update the contract
    const { error: updateErr } = await supabase
      .from("hunt_contracts")
      .update(updateData)
      .eq("id", contract.id);

    if (updateErr) {
      console.error("DocuSign webhook update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // When contract becomes fully_executed, create guide fee payment item so it shows on client dashboard (tags-for-sale and draw)
    if (statusLower === "completed") {
      const { createGuideFeePaymentItemIfNeeded } = await import("@/lib/guide-fee-bill-server");
      await createGuideFeePaymentItemIfNeeded(supabase, contract.id);
    }

    console.log(`DocuSign webhook: Updated contract ${contract.id} to ${mapped.docusignStatus}`);

    return NextResponse.json({
      received: true,
      processed: true,
      envelope_id: envelopeId,
      status: mapped.docusignStatus,
      contract_id: contract.id,
    });

  } catch (e: any) {
    console.error("DocuSign webhook error:", e);
    // Return 200 to prevent retries for parsing errors
    return NextResponse.json({ 
      received: true, 
      processed: false,
      error: String(e) 
    });
  }
}

/**
 * GET: Health check for DocuSign webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/docusign/webhook",
    description: "DocuSign Connect webhook receiver for hunt contract status updates",
  });
}
