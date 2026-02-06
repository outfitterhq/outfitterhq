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
  console.log(`[DEBUG guide-fee-bill GET] Starting for contract ${contractId}`);
  const { getContractGuideFeeCents } = await import("@/lib/guide-fee-bill-server");
  const correctTotal = await getContractGuideFeeCents(admin, contractId);
  
  console.log(`[DEBUG guide-fee-bill GET] correctTotal from getContractGuideFeeCents:`, correctTotal);
  
  if (!correctTotal || correctTotal.subtotalCents <= 0) {
    console.log(`[DEBUG guide-fee-bill GET] No valid total, returning error`);
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
    console.log(`[DEBUG guide-fee-bill GET] Found existing payment_item:`, {
      id: fullItem.id,
      total_cents: fullItem.total_cents,
      total_usd: (fullItem.total_cents / 100).toFixed(2),
    });
    
    // Use recalculated amounts so response matches contract BILL (subtotal + platform fee).
    const correct = await getContractGuideFeeCents(admin, contractId);
    console.log(`[DEBUG guide-fee-bill GET] correct from getContractGuideFeeCents:`, correct);
    
    const totalCents = correct ? correct.totalCents : fullItem.total_cents;
    const platformFeeCentsReturn = correct ? correct.platformFeeCents : platformFeeCents;
    
    console.log(`[DEBUG guide-fee-bill GET] Using values:`, {
      totalCents,
      totalUsd: (totalCents / 100).toFixed(2),
      platformFeeCentsReturn,
      platformFeeUsd: (platformFeeCentsReturn / 100).toFixed(2),
      payment_item_total_cents: fullItem.total_cents,
      payment_item_total_usd: (fullItem.total_cents / 100).toFixed(2),
      match: fullItem.total_cents === totalCents,
    });
    
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

  const n = Math.min(6, Math.max(1, Number(numPayments) || 4)); // Allow 1-6 payments

  const admin = supabaseAdmin();

  const { data: contract, error: contractErr } = await admin
    .from("hunt_contracts")
    .select("id, status, client_email, hunt_id, outfitter_id, client_completion_data, client_signed_at, admin_signed_at")
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

  // CRITICAL: Use getContractGuideFeeCents which uses calculated_guide_fee_cents (accounts for selected days)
  const { getContractGuideFeeCents } = await import("@/lib/guide-fee-bill-server");
  const correctTotal = await getContractGuideFeeCents(admin, contractId);
  
  if (!correctTotal || correctTotal.subtotalCents <= 0) {
    return NextResponse.json({ error: "No guide fee set for this hunt." }, { status: 400 });
  }

  // Get pricing item title and hunt start date for display
  let pricingTitle = "Guide fee";
  let huntStartDate: Date | null = null;
  if (contract.hunt_id) {
    const { data: hunt } = await admin
      .from("calendar_events")
      .select("selected_pricing_item_id, start_time")
      .eq("id", contract.hunt_id)
      .single();
    const selectedId = (hunt as { selected_pricing_item_id?: string | null } | null)?.selected_pricing_item_id;
    if (selectedId) {
      const { data: pricing } = await admin
        .from("pricing_items")
        .select("title")
        .eq("id", selectedId)
        .single();
      if (pricing) {
        pricingTitle = pricing.title || "Guide fee";
      }
    }
    if (hunt && (hunt as { start_time?: string | null }).start_time) {
      huntStartDate = new Date((hunt as { start_time: string }).start_time);
    }
  }

  // Get contract completion date (when both parties signed - use the later of the two)
  let contractCompletionDate: Date | null = null;
  const clientSigned = contract.client_signed_at ? new Date(contract.client_signed_at) : null;
  const adminSigned = contract.admin_signed_at ? new Date(contract.admin_signed_at) : null;
  if (clientSigned && adminSigned) {
    contractCompletionDate = clientSigned > adminSigned ? clientSigned : adminSigned;
  } else if (clientSigned) {
    contractCompletionDate = clientSigned;
  } else if (adminSigned) {
    contractCompletionDate = adminSigned;
  } else {
    // Fallback to current date if neither is signed (shouldn't happen for fully_executed contracts)
    contractCompletionDate = new Date();
  }

  // Validate we have both dates
  if (!huntStartDate || !contractCompletionDate) {
    return NextResponse.json(
      { error: "Missing hunt start date or contract completion date. Cannot calculate payment schedule." },
      { status: 400 }
    );
  }

  // Ensure hunt start is after contract completion
  if (huntStartDate <= contractCompletionDate) {
    return NextResponse.json(
      { error: "Hunt start date must be after contract completion date." },
      { status: 400 }
    );
  }

  // Calculate payment dates evenly spaced from contract completion to hunt start
  // If n=1, payment is due at hunt start
  // If n>1, payments are evenly spaced between completion and hunt start
  const timeDiff = huntStartDate.getTime() - contractCompletionDate.getTime();
  const daysBetween = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24))); // Days between dates
  
  const dueDates: string[] = [];
  if (n === 1) {
    // Single payment due on hunt start date
    dueDates.push(huntStartDate.toISOString().slice(0, 10));
  } else {
    // Multiple payments: space evenly from completion to hunt start
    const intervalDays = Math.floor(daysBetween / n);
    for (let i = 0; i < n; i++) {
      const paymentDate = new Date(contractCompletionDate);
      // First payment is due shortly after contract completion (3 days)
      // Subsequent payments are evenly spaced
      if (i === 0) {
        paymentDate.setDate(paymentDate.getDate() + 3); // First payment 3 days after completion
      } else {
        // Space remaining payments evenly to hunt start
        const daysFromStart = 3 + (intervalDays * i);
        paymentDate.setDate(paymentDate.getDate() + daysFromStart);
        // Ensure last payment is not after hunt start
        if (paymentDate > huntStartDate) {
          paymentDate.setTime(huntStartDate.getTime());
        }
      }
      dueDates.push(paymentDate.toISOString().slice(0, 10));
    }
    // Ensure last payment is on or before hunt start
    const lastDate = new Date(dueDates[dueDates.length - 1]);
    if (lastDate > huntStartDate) {
      dueDates[dueDates.length - 1] = huntStartDate.toISOString().slice(0, 10);
    }
  }

  // Use calculated amounts (accounts for selected days)
  const subtotalCents = correctTotal.subtotalCents;
  const { data: feeConfig } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "platform_fee_percentage")
    .maybeSingle();
  const feePct = feeConfig ? parseFloat(String(feeConfig.value)) : 5;
  const platformFeeCents = correctTotal.platformFeeCents;
  const totalCents = correctTotal.totalCents;
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

  // dueDates already calculated above

  const installments: { payment_item_id: string; amount_cents: number; due_date: string }[] = [];
  const calendarEventIds: string[] = [];
  
  for (let i = 0; i < n; i++) {
    const amount = installmentCents + (i < remainder ? 1 : 0);
    const platFee = Math.max(1, Math.ceil(amount * (feePct / 100)));
    const subtotal = amount - platFee;
    const dueDate = dueDates[i];
    
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
        due_date: dueDate,
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

    // Create calendar event/reminder for this payment
    const paymentDate = new Date(dueDate + "T09:00:00Z"); // 9 AM on due date
    const reminderDate = new Date(paymentDate);
    reminderDate.setDate(reminderDate.getDate() - 7); // 7 days before
    
    // Create reminder event 7 days before payment
    const { data: reminderEvent, error: reminderErr } = await admin
      .from("calendar_events")
      .insert({
        outfitter_id: contract.outfitter_id,
        client_email: contract.client_email,
        title: `Payment Reminder: ${pricingTitle} Payment ${i + 1} of ${n}`,
        start_time: reminderDate.toISOString(),
        end_time: new Date(reminderDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour event
        notes: `Payment due in 7 days: $${(amount / 100).toFixed(2)} for ${pricingTitle} (Payment ${i + 1} of ${n})`,
        audience: "client",
        status: "Pending",
      })
      .select("id")
      .single();
    
    if (!reminderErr && reminderEvent) {
      calendarEventIds.push(reminderEvent.id);
    }

    // Create payment due event on the due date
    const { data: dueEvent, error: dueErr } = await admin
      .from("calendar_events")
      .insert({
        outfitter_id: contract.outfitter_id,
        client_email: contract.client_email,
        title: `Payment Due: ${pricingTitle} Payment ${i + 1} of ${n}`,
        start_time: paymentDate.toISOString(),
        end_time: new Date(paymentDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour event
        notes: `Payment due today: $${(amount / 100).toFixed(2)} for ${pricingTitle} (Payment ${i + 1} of ${n})`,
        audience: "client",
        status: "Pending",
      })
      .select("id")
      .single();
    
    if (!dueErr && dueEvent) {
      calendarEventIds.push(dueEvent.id);
    }
  }

  return NextResponse.json({
    success: true,
    payment_plan: true,
    number_of_payments: n,
    installments,
    calendar_events_created: calendarEventIds.length,
    message: `Payment plan set up: ${n} payments spaced from contract completion to hunt start. First due ${dueDates[0]}. Calendar reminders created.`,
  });
}
