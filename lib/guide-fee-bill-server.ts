import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Compute add-on amount (extra days + non-hunters + spotters) from client_completion_data using
 * outfitter pricing_items. Returns USD amount to add to base guide fee.
 */
export async function getAddonAmountUsd(
  admin: SupabaseClient,
  outfitterId: string,
  completionData: Record<string, unknown> | null
): Promise<number> {
  if (!completionData || typeof completionData !== "object") return 0;
  const extraDays = Math.max(0, Number(completionData.extra_days) || 0);
  const extraNonHunters = Math.max(0, Number(completionData.extra_non_hunters) || 0);
  const extraSpotters = Math.max(0, Number(completionData.extra_spotters) || 0);
  if (extraDays === 0 && extraNonHunters === 0 && extraSpotters === 0) return 0;

  const { data: items } = await admin
    .from("pricing_items")
    .select("title, amount_usd, category, addon_type")
    .eq("outfitter_id", outfitterId);
  if (!items?.length) return 0;

  const titleLower = (t: string) => (t ?? "").toLowerCase();
  const isExtraDay = (i: { title?: string; category?: string; addon_type?: string | null }) => {
    if ((i as { addon_type?: string }).addon_type === "extra_days") return true;
    const cat = (i.category ?? "").trim().toLowerCase();
    if (cat !== "add-ons") return false; // never use guide-fee items (e.g. "5-Day Hunt" $8000)
    const t = titleLower(i.title ?? "");
    if (t.includes("non")) return false;
    return t.includes("additional day") || t.includes("extra day") || t.includes("day");
  };
  const isNonHunter = (i: { title?: string; category?: string; addon_type?: string | null }) => {
    if ((i as { addon_type?: string }).addon_type === "non_hunter") return true;
    const cat = (i.category ?? "").trim().toLowerCase();
    const t = titleLower(i.title ?? "");
    return cat === "add-ons" && (t.includes("non-hunter") || t.includes("non hunter") || (t.includes("non") && t.includes("hunter")));
  };
  const isSpotter = (i: { title?: string; category?: string; addon_type?: string | null }) => {
    if ((i as { addon_type?: string }).addon_type === "spotter") return true;
    const cat = (i.category ?? "").trim().toLowerCase();
    const t = titleLower(i.title ?? "");
    return cat === "add-ons" && t.includes("spotter");
  };
  const DEFAULT_EXTRA_DAY_USD = 100;
  const DEFAULT_NON_HUNTER_USD = 75;
  const DEFAULT_SPOTTER_USD = 50;
  const extraDayItem = items.find((i) => isExtraDay(i));
  const nonHunterItem = items.find((i) => isNonHunter(i));
  const spotterItem = items.find((i) => isSpotter(i));
  const dayPrice = extraDayItem != null ? Number(extraDayItem.amount_usd) || DEFAULT_EXTRA_DAY_USD : DEFAULT_EXTRA_DAY_USD;
  const nonHunterPrice = nonHunterItem != null ? Number(nonHunterItem.amount_usd) || DEFAULT_NON_HUNTER_USD : DEFAULT_NON_HUNTER_USD;
  const spotterPrice = spotterItem != null ? Number(spotterItem.amount_usd) || DEFAULT_SPOTTER_USD : DEFAULT_SPOTTER_USD;
  return extraDays * dayPrice + extraNonHunters * nonHunterPrice + extraSpotters * spotterPrice;
}

/**
 * When a hunt contract becomes fully_executed (including tags-for-sale), create a guide_fee
 * payment_item so the client sees it on the dashboard and can pay. Idempotent: if a
 * guide_fee or guide_fee_installment already exists for this contract, does nothing.
 * Returns the payment_item id if created or found, or null if no guide fee / error.
 */
export async function createGuideFeePaymentItemIfNeeded(
  admin: SupabaseClient,
  contractId: string
): Promise<string | null> {
  try {
    const { data: contract, error: contractErr } = await admin
      .from("hunt_contracts")
      .select("id, hunt_id, outfitter_id, client_email, client_completion_data")
      .eq("id", contractId)
      .eq("status", "fully_executed")
      .single();

    if (contractErr || !contract) return null;

    const clientEmail = (contract.client_email || "").toLowerCase().trim();
    if (!clientEmail) return null;

    const { data: client } = await admin
      .from("clients")
      .select("id")
      .ilike("email", clientEmail)
      .limit(1)
      .maybeSingle();
    if (!client) return null;

    let pricingTitle = "Guide fee";
    let amountUsd = 0;

    // Prefer client_completion_data so amounts match the signed BILL.
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
        .select("id, title, amount_usd")
        .eq("id", selectedPricingId)
        .single();
      if (pricing) {
        pricingTitle = pricing.title || "Guide fee";
        amountUsd = Number(pricing.amount_usd) || 0;
      }
    }

    const addonUsd = await getAddonAmountUsd(admin, contract.outfitter_id, contract.client_completion_data as Record<string, unknown> | null);
    amountUsd += addonUsd;

    if (amountUsd <= 0) return null;

    const { data: existing } = await admin
      .from("payment_items")
      .select("id")
      .eq("contract_id", contractId)
      .in("item_type", ["guide_fee", "guide_fee_installment"])
      .limit(1);
    if (existing && existing.length > 0) return (existing[0] as { id: string }).id;

    const subtotalCents = Math.round(amountUsd * 100);
    const { data: feeConfig } = await admin
      .from("platform_config")
      .select("value")
      .eq("key", "platform_fee_percentage")
      .maybeSingle();
    const feePct = feeConfig ? parseFloat(String(feeConfig.value)) : 5;
    const platformCents = Math.max(50, Math.ceil(subtotalCents * (feePct / 100)));
    const totalCents = subtotalCents + platformCents;

    const { data: newItem, error: insertErr } = await admin
      .from("payment_items")
      .insert({
        outfitter_id: contract.outfitter_id,
        client_id: client.id,
        item_type: "guide_fee",
        description: `${pricingTitle} (signed contract)`,
        subtotal_cents: subtotalCents,
        platform_fee_cents: platformCents,
        total_cents: totalCents,
        hunt_id: contract.hunt_id,
        contract_id: contractId,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("createGuideFeePaymentItemIfNeeded:", insertErr);
      return null;
    }
    return (newItem as { id: string }).id;
  } catch (e) {
    console.error("createGuideFeePaymentItemIfNeeded error:", e);
    return null;
  }
}

/**
 * Compute the correct guide fee total from a contract (same logic as BILL: base + add-ons, then platform fee).
 * Use this to fix payment_items that were created with wrong amounts.
 */
export async function getContractGuideFeeCents(
  admin: SupabaseClient,
  contractId: string
): Promise<{ subtotalCents: number; platformFeeCents: number; totalCents: number } | null> {
  const { data: contract, error: contractErr } = await admin
    .from("hunt_contracts")
    .select("id, hunt_id, outfitter_id, client_completion_data")
    .eq("id", contractId)
    .single();
  if (contractErr || !contract) return null;

  // Prefer client_completion_data so amounts match the signed BILL (which was built from completion data).
  let amountUsd = 0;
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
      .select("id, title, amount_usd")
      .eq("id", selectedPricingId)
      .single();
    if (pricing) amountUsd = Number(pricing.amount_usd) || 0;
  }
  const addonUsd = await getAddonAmountUsd(admin, contract.outfitter_id, contract.client_completion_data as Record<string, unknown> | null);
  amountUsd += addonUsd;
  if (amountUsd <= 0) return null;

  const subtotalCents = Math.round(amountUsd * 100);
  const { data: feeConfig } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "platform_fee_percentage")
    .maybeSingle();
  const feePct = feeConfig ? parseFloat(String(feeConfig.value)) : 5;
  const platformFeeCents = Math.max(50, Math.ceil(subtotalCents * (feePct / 100)));
  const totalCents = subtotalCents + platformFeeCents;
  return { subtotalCents, platformFeeCents, totalCents };
}

/**
 * If the payment_item is a guide_fee linked to a contract, recalculate the correct total from the contract (BILL logic).
 * If the stored total is wrong, update the payment_item and return the correct breakdown.
 */
export async function recalculateGuideFeePaymentItem(
  admin: SupabaseClient,
  paymentItemId: string
): Promise<{ subtotalCents: number; platformFeeCents: number; totalCents: number } | null> {
  const { data: item, error: itemErr } = await admin
    .from("payment_items")
    .select("id, contract_id, item_type, total_cents, amount_paid_cents")
    .eq("id", paymentItemId)
    .single();
  const itemType = (item as { item_type?: string }).item_type;
  if (itemErr || !item || itemType !== "guide_fee") return null;
  const contractId = (item as { contract_id?: string | null }).contract_id;
  if (!contractId) return null;

  const correct = await getContractGuideFeeCents(admin, contractId);
  if (!correct) return null;

  const storedTotal = (item as { total_cents?: number }).total_cents ?? 0;
  const amountPaid = (item as { amount_paid_cents?: number }).amount_paid_cents ?? 0;
  if (storedTotal !== correct.totalCents) {
    await admin
      .from("payment_items")
      .update({
        subtotal_cents: correct.subtotalCents,
        platform_fee_cents: correct.platformFeeCents,
        total_cents: correct.totalCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentItemId);
  }
  return correct;
}
