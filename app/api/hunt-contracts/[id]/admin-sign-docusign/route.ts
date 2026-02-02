import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import {
  isDocuSignConfigured,
  createRecipientView,
} from "@/lib/docusign";
import { createGuideFeePaymentItemIfNeeded } from "@/lib/guide-fee-bill-server";

/**
 * POST: Admin gets embedded DocuSign signing URL to sign the hunt contract (counter-sign).
 * Auth: session cookie (web) or Authorization: Bearer + body.outfitter_id (iOS).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
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

    const adminEmail = user.email;
    if (!adminEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

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
      .select("id, outfitter_id, docusign_envelope_id, status")
      .eq("id", contractId)
      .eq("outfitter_id", outfitterId)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (!contract.docusign_envelope_id) {
      return NextResponse.json(
        { error: "Contract has not been sent to DocuSign yet. Send it to DocuSign first." },
        { status: 400 }
      );
    }

    const isMockEnvelope = String(contract.docusign_envelope_id).startsWith("mock-");

    if (!isDocuSignConfigured() || isMockEnvelope) {
      const { data: updated, error: updateErr } = await supabase
        .from("hunt_contracts")
        .update({
          status: "fully_executed",
          admin_signed_at: new Date().toISOString(),
          docusign_status: "completed",
        })
        .eq("id", contractId)
        .eq("outfitter_id", outfitterId)
        .select()
        .single();
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      // Create guide fee payment item so it shows on client dashboard (tags-for-sale and draw)
      const admin = supabaseAdmin();
      await createGuideFeePaymentItemIfNeeded(admin, contractId);
      return NextResponse.json({
        success: true,
        contract: updated,
        message: isMockEnvelope
          ? "Contract marked fully executed (mock)."
          : "DocuSign not configured; contract marked fully executed for testing.",
        mock: true,
      });
    }

    const adminName =
      user.user_metadata?.full_name ??
      user.email ??
      "Admin";

    const origin =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const returnUrl = `${protocol}://${origin}/calendar`;

    const signingUrl = await createRecipientView(
      contract.docusign_envelope_id,
      {
        email: adminEmail,
        userName: adminName,
        clientUserId: String(user.id),
        returnUrl,
      }
    );

    return NextResponse.json({
      signingUrl,
      message: "Complete your signature in DocuSign",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "DocuSign error";
    console.error("Admin sign DocuSign error:", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
