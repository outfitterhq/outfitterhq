import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { getAddonAmountUsd, getContractGuideFeeCents } from "@/lib/guide-fee-bill-server";

async function getClientEmail(supabase: Awaited<ReturnType<typeof supabaseRoute>>): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.email) return (session.user.email || "").toLowerCase();
  const h = await headers();
  const auth = h.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user?.email) return (user.email || "").toLowerCase();
  }
  return null;
}

/**
 * GET: Get guide fee bill for a fully-executed contract.
 * Creates a single guide_fee payment_item if none exists (so client can pay in full or set up payment plan).
 * Returns amount, description, payment_item_id, status, and any installments if payment plan was set.
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseRoute();
  const userEmail = await getClientEmail(supabase);
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contract_id");
  if (!contractId) {
    return NextResponse.json({ error: "contract_id is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: contract, error: contractErr } = await admin
    .from("hunt_contracts")
    .select("id, status, client_email, hunt_id, outfitter_id, client_completion_data")
    .eq("id", contractId)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if ((contract.client_email || "").toLowerCase() !== userEmail) {
    return NextResponse.json({ error: "Not authorized for this contract" }, { status: 403 });
  }
  if (contract.status !== "fully_executed") {
    return NextResponse.json(
      { error: "Guide fee bill is available only after the contract is signed by all parties." },
      { status: 400 }
    );
  }

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .ilike("email", userEmail)
    .limit(1)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // CRITICAL: Use getContractGuideFeeCents which uses calculated_guide_fee_cents (accounts for selected days)
  // DO NOT calculate from pricing item amount directly - that doesn't account for selected days
  const { getContractGuideFeeCents } = await import("@/lib/guide-fee-bill-server");
  const correctTotal = await getContractGuideFeeCents(admin, contractId);
  
  if (!correctTotal || correctTotal.subtotalCents <= 0) {
    return NextResponse.json(
      { error: "No guide fee is set for this hunt. Contact your outfitter." },
      { status: 400 }
    );
  }

  // Get pricing item title for display
  let pricingTitle = "Guide fee";
  let pricingItemId: string | null = null;
  let selectedPricingId: string | null = null;
  if (contract.client_completion_data && typeof contract.client_completion_data === "object") {
    const comp = contract.client_completion_data as { selected_pricing_item_id?: string };
    selectedPricingId = comp.selected_pricing_item_id ?? null;
  }
  if (!selectedPricingId && contract.hunt_id) {
    const { data: hunt } = await admin
      .from("calendar_events")
      .select("selected_pricing_item_id")
      .eq("id", contract.hunt_id)
      .single();
    selectedPricingId = (hunt as { selected_pricing_item_id?: string | null } | null)?.selected_pricing_item_id ?? null;
  }
  if (selectedPricingId) {
    const { data: pricing } = await admin
      .from("pricing_items")
      .select("id, title")
      .eq("id", selectedPricingId)
      .single();
    if (pricing) {
      pricingTitle = pricing.title || "Guide fee";
      pricingItemId = pricing.id;
    }
  }

  // Use calculated amounts (accounts for selected days)
  const subtotalCents = correctTotal.subtotalCents;
  const platformFeeCents = correctTotal.platformFeeCents;
  const totalCents = correctTotal.totalCents;
  const amountUsd = subtotalCents / 100; // For backward compatibility in response

  const { data: existingItems } = await admin
    .from("payment_items")
    .select("id, item_type, total_cents, status, due_date, amount_paid_cents")
    .eq("contract_id", contractId)
    .in("item_type", ["guide_fee", "guide_fee_installment"])
    .order("due_date", { ascending: true });

  const installments = (existingItems || []).filter((i: { item_type: string }) => i.item_type === "guide_fee_installment");
  const fullItem = (existingItems || []).find((i: { item_type: string }) => i.item_type === "guide_fee");

  if (installments.length > 0) {
    const totalDue = installments.reduce(
      (sum: number, i: { total_cents: number }) => sum + i.total_cents,
      0
    );
    const paid = installments.reduce(
      (sum: number, i: { amount_paid_cents?: number }) => sum + (i.amount_paid_cents || 0),
      0
    );
    // Use calculated amounts (accounts for selected days)
    return NextResponse.json({
      amount_usd: amountUsd, // From correctTotal.subtotalCents / 100
      description: pricingTitle,
      total_cents: totalDue,
      platform_fee_cents: platformFeeCents, // From correctTotal.platformFeeCents
      payment_plan: true,
      installments: installments.map((i: { id: string; total_cents: number; status: string; due_date: string | null; amount_paid_cents?: number }) => ({
        payment_item_id: i.id,
        amount_cents: i.total_cents,
        amount_usd: (i.total_cents / 100).toFixed(2),
        due_date: i.due_date,
        status: i.status,
        amount_paid_cents: i.amount_paid_cents || 0,
      })),
      total_paid_cents: paid,
      balance_due_cents: totalDue - paid,
    });
  }

  if (fullItem && fullItem.status !== "cancelled") {
    // Use recalculated amounts so response matches contract BILL (subtotal + platform fee).
    const correct = await getContractGuideFeeCents(admin, contractId);
    const totalCents = correct ? correct.totalCents : fullItem.total_cents;
    const platformFeeCentsReturn = correct ? correct.platformFeeCents : platformFeeCents;
    
    // Update payment_item if it has the wrong total
    if (correct && fullItem.total_cents !== correct.totalCents) {
      Promise.resolve(admin
        .from("payment_items")
        .update({
          subtotal_cents: correct.subtotalCents,
          platform_fee_cents: correct.platformFeeCents,
          total_cents: correct.totalCents,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fullItem.id))
        .catch((err) => {
          console.warn(`[guide-fee-bill] Failed to update payment_item ${fullItem.id}:`, err);
        });
    }
    
    // Use calculated guide fee for amount_usd (not the pricing item amount)
    const calculatedAmountUsd = correct ? correct.subtotalCents / 100 : amountUsd;
    const balanceCents = totalCents - (fullItem.amount_paid_cents || 0);
    return NextResponse.json({
      amount_usd: calculatedAmountUsd,
      description: pricingTitle,
      payment_item_id: fullItem.id,
      total_cents: totalCents,
      platform_fee_cents: platformFeeCentsReturn,
      status: fullItem.status,
      balance_due_cents: balanceCents,
      payment_plan: false,
      installments: [],
    });
  }

  // Use calculated amounts (already computed above from getContractGuideFeeCents)
  // subtotalCents, platformFeeCents, and totalCents are already set correctly

  const { data: newItem, error: insertErr } = await admin
    .from("payment_items")
    .insert({
      outfitter_id: contract.outfitter_id,
      client_id: client.id,
      item_type: "guide_fee",
      description: `${pricingTitle} (signed contract)`,
      subtotal_cents: subtotalCents,
      platform_fee_cents: platformFeeCents,
      total_cents: totalCents,
      hunt_id: contract.hunt_id,
      contract_id: contractId,
      status: "pending",
    })
    .select("id, total_cents, platform_fee_cents, status")
    .single();

  if (insertErr) {
    console.error("Guide fee bill create error:", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    amount_usd: amountUsd,
    description: pricingTitle,
    payment_item_id: newItem.id,
    total_cents: newItem.total_cents,
    platform_fee_cents: newItem.platform_fee_cents,
    status: newItem.status,
    balance_due_cents: newItem.total_cents,
    payment_plan: false,
    installments: [],
  });
}

/**
 * POST: Set up a payment plan for the guide fee (creates installment payment_items, cancels full-amount item).
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseRoute();
  const userEmail = await getClientEmail(supabase);
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { contract_id: contractId, action, number_of_payments: numPayments, first_due_date: firstDueDate } = body;

  if (!contractId || action !== "payment_plan") {
    return NextResponse.json(
      { error: "contract_id and action 'payment_plan' are required" },
      { status: 400 }
    );
  }

  const n = Math.min(12, Math.max(2, Number(numPayments) || 4));
  let firstDue = firstDueDate;
  if (!firstDue || typeof firstDue !== "string") {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    firstDue = d.toISOString().slice(0, 10);
  }

  const admin = supabaseAdmin();

  const { data: contract, error: contractErr } = await admin
    .from("hunt_contracts")
    .select("id, status, client_email, hunt_id, outfitter_id, client_completion_data")
    .eq("id", contractId)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if ((contract.client_email || "").toLowerCase() !== userEmail) {
    return NextResponse.json({ error: "Not authorized for this contract" }, { status: 403 });
  }
  if (contract.status !== "fully_executed") {
    return NextResponse.json({ error: "Contract must be fully signed first." }, { status: 400 });
  }

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .ilike("email", userEmail)
    .limit(1)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  let amountUsd = 0;
  let pricingTitle = "Guide fee";
  if (contract.hunt_id) {
    const { data: hunt } = await admin
      .from("calendar_events")
      .select("selected_pricing_item_id")
      .eq("id", contract.hunt_id)
      .single();
    const selectedId = (hunt as { selected_pricing_item_id?: string | null } | null)?.selected_pricing_item_id;
    if (selectedId) {
      const { data: pricing } = await admin
        .from("pricing_items")
        .select("title, amount_usd")
        .eq("id", selectedId)
        .single();
      if (pricing) {
        pricingTitle = pricing.title || "Guide fee";
        amountUsd = Number(pricing.amount_usd) || 0;
      }
    }
  }
  const addonUsd = await getAddonAmountUsd(admin, contract.outfitter_id, contract.client_completion_data as Record<string, unknown> | null);
  amountUsd += addonUsd;
  if (amountUsd <= 0) {
    return NextResponse.json({ error: "No guide fee set for this hunt." }, { status: 400 });
  }

  const subtotalCents = Math.round(amountUsd * 100);
  const { data: feeConfig } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "platform_fee_percentage")
    .maybeSingle();
  const feePct = feeConfig ? parseFloat(String(feeConfig.value)) : 5;
  const platformFeeCents = Math.max(50, Math.ceil(subtotalCents * (feePct / 100)));
  const totalCents = subtotalCents + platformFeeCents;
  const installmentCents = Math.floor(totalCents / n);
  const remainder = totalCents - installmentCents * n;

  const { data: fullItem } = await admin
    .from("payment_items")
    .select("id")
    .eq("contract_id", contractId)
    .eq("item_type", "guide_fee")
    .neq("status", "cancelled")
    .maybeSingle();

  if (fullItem) {
    await admin
      .from("payment_items")
      .update({ status: "cancelled" })
      .eq("id", fullItem.id);
  }

  const dueDates: string[] = [];
  let d = new Date(firstDue + "T12:00:00Z");
  for (let i = 0; i < n; i++) {
    dueDates.push(d.toISOString().slice(0, 10));
    d.setMonth(d.getMonth() + 1);
  }

  const installments: { payment_item_id: string; amount_cents: number; due_date: string }[] = [];
  for (let i = 0; i < n; i++) {
    const amount = installmentCents + (i < remainder ? 1 : 0);
    const platFee = Math.max(1, Math.ceil(amount * (feePct / 100)));
    const subtotal = amount - platFee;
    const { data: item, error: insErr } = await admin
      .from("payment_items")
      .insert({
        outfitter_id: contract.outfitter_id,
        client_id: client.id,
        item_type: "guide_fee_installment",
        description: `${pricingTitle} – Payment ${i + 1} of ${n}`,
        subtotal_cents: subtotal,
        platform_fee_cents: platFee,
        total_cents: amount,
        hunt_id: contract.hunt_id,
        contract_id: contractId,
        due_date: dueDates[i],
        status: "pending",
      })
      .select("id, total_cents, due_date")
      .single();
    if (insErr) {
      console.error("Installment create error:", insErr);
      return NextResponse.json({ error: "Failed to create payment plan" }, { status: 500 });
    }
    installments.push({
      payment_item_id: item.id,
      amount_cents: item.total_cents,
      due_date: item.due_date,
    });
  }

  return NextResponse.json({
    success: true,
    payment_plan: true,
    number_of_payments: n,
    installments,
    message: `Payment plan set up: ${n} payments. First due ${dueDates[0]}.`,
  });
}
