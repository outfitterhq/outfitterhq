import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import { createEnvelope, isDocuSignConfigured } from "@/lib/docusign";

const BUCKET = "outfitter-documents";

/**
 * POST: Send hunt contract to DocuSign for signatures.
 * Auth: session cookie (web) or Authorization: Bearer + body.outfitter_id (iOS).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await supabaseRoute();

    const { data: { session } } = await supabase.auth.getSession();
    let user = session?.user ?? null;
    if (!user) {
      const h = await headers();
      const auth = h.get("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: { user: u } } = await supabase.auth.getUser(auth.slice(7));
        user = u ?? null;
      }
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const adminEmail = user.email ?? undefined;
    const adminName = user.user_metadata?.full_name ?? user.email ?? "Admin";

    const store = await cookies();
    const body = await req.json().catch(() => ({})) as { outfitter_id?: string };
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value ?? body.outfitter_id ?? null;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("outfitter_id", outfitterId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: contract, error: contractErr } = await supabase
      .from("hunt_contracts")
      .select(`
        *,
        hunt:calendar_events(title, species, unit, start_time, end_time)
      `)
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.status !== "ready_for_signature") {
      return NextResponse.json(
        {
          error: `Contract must be in 'ready_for_signature' status to send to DocuSign. Current status: ${contract.status}`,
          hint: "Client must complete the contract first.",
        },
        { status: 400 }
      );
    }

    const useMockDocuSign = !isDocuSignConfigured();

    if (useMockDocuSign) {
      const { randomUUID } = await import("crypto");
      const mockEnvelopeId = "mock-" + randomUUID();
      const { data: updatedContract, error: updateErr } = await supabase
        .from("hunt_contracts")
        .update({
          status: "sent_to_docusign",
          docusign_envelope_id: mockEnvelopeId,
          docusign_status: "sent",
          docusign_sent_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("outfitter_id", outfitterId)
        .select()
        .single();
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        contract: updatedContract,
        docusign: {
          envelope_id: mockEnvelopeId,
          status: "sent",
          message: "DocuSign not configured; contract marked as sent for testing. Client can use Sign in their Documents page.",
        },
        mock: true,
      });
    }

    const { data: outfitter } = await supabase
      .from("outfitters")
      .select("name, hunt_contract_document_path")
      .eq("id", outfitterId)
      .single();

    const { data: clientRow } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .eq("email", contract.client_email)
      .single();

    if (!clientRow) {
      return NextResponse.json(
        { error: "Client record not found for contract signer" },
        { status: 404 }
      );
    }

    const clientName =
      [clientRow.first_name, clientRow.last_name].filter(Boolean).join(" ") ||
      contract.client_name ||
      contract.client_email;

    const documentPath =
      (outfitter as { hunt_contract_document_path?: string } | null)
        ?.hunt_contract_document_path ?? null;

    if (!documentPath) {
      return NextResponse.json(
        {
          error:
            "No hunt contract PDF set. Upload a hunt contract PDF in Settings → Hunt Contract to send to DocuSign.",
          hint: "Settings → Hunt Contract → Upload Hunt Contract PDF",
        },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const { data: fileData, error: downloadErr } = await admin.storage
      .from(BUCKET)
      .download(documentPath);

    if (downloadErr || !fileData) {
      console.error("Hunt contract PDF download error:", downloadErr);
      return NextResponse.json(
        {
          error:
            "Could not load hunt contract PDF. Re-upload it in Settings → Hunt Contract.",
        },
        { status: 500 }
      );
    }

    const bytes = await fileData.arrayBuffer();
    const documentBase64 = Buffer.from(bytes).toString("base64");

    const envelopeId = await createEnvelope({
      documentBase64,
      documentName: "Hunt Contract.pdf",
      signer: {
        email: contract.client_email,
        name: clientName,
        clientUserId: String(clientRow.id),
      },
      adminSigner:
        adminEmail
          ? {
              email: adminEmail,
              name: adminName,
              clientUserId: String(user.id),
            }
          : undefined,
      emailSubject: `Hunt Contract – ${outfitter?.name ?? "Outfitter"}`,
    });

    const { data: updatedContract, error: updateErr } = await supabase
      .from("hunt_contracts")
      .update({
        status: "sent_to_docusign",
        docusign_envelope_id: envelopeId,
        docusign_status: "sent",
        docusign_sent_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contract: updatedContract,
      docusign: {
        envelope_id: envelopeId,
        status: "sent",
        message:
          "Contract sent to DocuSign. Client can sign via the link in their Documents → Hunt Contract page.",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Send hunt contract to DocuSign error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
