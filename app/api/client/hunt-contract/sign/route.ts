import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";
import {
  isDocuSignConfigured,
  createRecipientView,
} from "@/lib/docusign";

/**
 * POST: Client requests to sign a hunt contract
 * This endpoint is called when the client clicks "Sign" in their portal.
 * 
 * If DocuSign is configured:
 * - Redirect to DocuSign embedded signing
 * 
 * If DocuSign is not configured:
 * - Return 503 with needsConfiguration so client shows a friendly message.
 *
 * If DocuSign is configured but no envelope yet:
 * - Fallback: mark as client_signed for testing.
 */
export async function POST(req: Request) {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;
  if (!userEmail) {
    return NextResponse.json({ error: "User email not found" }, { status: 400 });
  }

  let body: { contract_id?: string; typed_name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const { contract_id, typed_name } = body;

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
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .limit(1);

  if (!links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  const outfitterId = links[0].outfitter_id;

  // Get the contract (from hunt_contracts table)
  let contractQuery = supabase
    .from("hunt_contracts")
    .select("*")
    .eq("client_email", userEmail)
    .eq("outfitter_id", outfitterId);

  if (contract_id) {
    contractQuery = contractQuery.eq("id", contract_id);
  } else {
    // Get the most recent contract that needs signing
    contractQuery = contractQuery
      .in("status", ["sent_to_docusign", "ready_for_signature"])
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: contracts, error: contractErr } = await contractQuery;

  if (contractErr || !contracts || contracts.length === 0) {
    return NextResponse.json({ error: "No contract available for signing" }, { status: 404 });
  }

  const contract = contracts[0];

  // Verify contract status allows signing
  const signableStatuses = ["ready_for_signature", "sent_to_docusign"];
  if (!signableStatuses.includes(contract.status)) {
    return NextResponse.json(
      { error: `Contract cannot be signed in current status: ${contract.status}` },
      { status: 400 }
    );
  }

  const docusignConfigured = isDocuSignConfigured();
  const isMockEnvelope =
    contract.docusign_envelope_id &&
    String(contract.docusign_envelope_id).startsWith("mock-");
  const useInAppSigning =
    !docusignConfigured ||
    isMockEnvelope ||
    !contract.docusign_envelope_id ||
    (typeof typed_name === "string" && typed_name.trim().length > 0);

  if (useInAppSigning) {
    const { data: updatedContract, error: updateErr } = await supabase
      .from("hunt_contracts")
      .update({
        status: "client_signed",
        client_signed_at: new Date().toISOString(),
        docusign_status: "signed",
      })
      .eq("id", contract.id)
      .eq("client_email", userEmail)
      .select()
      .single();
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      signing_method: "in_app",
      contract: updatedContract,
      message: "Contract signed successfully.",
    });
  }

  // DocuSign path (when configured with real envelope and no typed_name from iOS)
  if (contract.docusign_envelope_id) {
    try {
      const origin =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        "localhost:3000";
      const protocol = req.headers.get("x-forwarded-proto") || "https";
      const returnUrl = `${protocol}://${origin}/client/documents/hunt-contract`;
      const clientName =
        [client.first_name, client.last_name].filter(Boolean).join(" ") ||
        userEmail;

      const signingUrl = await createRecipientView(
        contract.docusign_envelope_id,
        {
          email: userEmail,
          userName: clientName,
          clientUserId: String(client.id),
          returnUrl,
        }
      );

      return NextResponse.json({
        signingUrl,
        message: "Complete signing in DocuSign",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "DocuSign error";
      console.error("Hunt contract DocuSign signing URL error:", e);
      return NextResponse.json(
        { error: message },
        { status: 502 }
      );
    }
  }

  // DocuSign configured but no envelope yet – allow manual for testing
  const { data: updatedContract, error: updateErr } = await supabase
    .from("hunt_contracts")
    .update({
      status: "client_signed",
      client_signed_at: new Date().toISOString(),
      docusign_status: "signed",
    })
    .eq("id", contract.id)
    .eq("client_email", userEmail)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    signing_method: "manual",
    contract: updatedContract,
    message:
      "Contract marked as signed. For production, send the contract to DocuSign from the admin side first.",
  });
}
