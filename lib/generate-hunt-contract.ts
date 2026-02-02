import type { SupabaseClient } from "@supabase/supabase-js";
import { matchPricingForHunt, huntDaysFromRange } from "@/lib/pricing-match";
import type { PricingItem } from "@/lib/types/pricing";

type HuntRow = {
  id: string;
  outfitter_id: string;
  title: string | null;
  client_email: string | null;
  species: string | null;
  unit: string | null;
  weapon: string | null;
  camp_name: string | null;
  hunt_type: string | null;
  hunt_code: string | null;
  start_time: string | null;
  end_time: string | null;
  hunt_window_start: string | null;
  hunt_window_end: string | null;
  selected_pricing_item_id: string | null;
  client_addon_data?: Record<string, unknown> | null;
};

/**
 * Create a hunt contract for a calendar event (private land tag hunt) if one doesn't exist.
 * Used when client completes complete-booking so the admin sees the contract for review.
 * Idempotent: if a contract already exists for this hunt_id, returns its id.
 */
export async function createHuntContractIfNeeded(
  admin: SupabaseClient,
  huntId: string
): Promise<{ contractId: string | null; error?: string }> {
  const baseSelect = "id, outfitter_id, title, client_email, species, unit, weapon, camp_name, hunt_type, hunt_code, start_time, end_time, hunt_window_start, hunt_window_end, selected_pricing_item_id";
  let huntRes = await admin
    .from("calendar_events")
    .select(`${baseSelect}, client_addon_data`)
    .eq("id", huntId)
    .single();
  if (huntRes.error) {
    const errMsg = huntRes.error?.message ?? String(huntRes.error);
    if (errMsg.includes("client_addon_data") || errMsg.includes("schema cache")) {
      huntRes = await admin
        .from("calendar_events")
        .select(baseSelect)
        .eq("id", huntId)
        .single();
    }
  }
  const hunt = huntRes.data as HuntRow | null;
  if (huntRes.error || !hunt) {
    return { contractId: null, error: "Hunt not found" };
  }

  if (hunt.hunt_type !== "private_land") {
    return { contractId: null, error: "Only private land hunts get auto-generated contracts" };
  }

  if (!hunt.client_email?.trim()) {
    return { contractId: null, error: "Hunt has no client email" };
  }

  const outfitterId = hunt.outfitter_id;

  const { data: existingContract } = await admin
    .from("hunt_contracts")
    .select("id")
    .eq("hunt_id", huntId)
    .maybeSingle();

  if (existingContract) {
    return { contractId: (existingContract as { id: string }).id };
  }

  const { data: clientRow } = await admin
    .from("clients")
    .select("id, first_name, last_name")
    .ilike("email", hunt.client_email.trim().toLowerCase())
    .limit(1)
    .maybeSingle();

  const clientName =
    clientRow && (clientRow.first_name || clientRow.last_name)
      ? [clientRow.first_name, clientRow.last_name].filter(Boolean).join(" ")
      : hunt.client_email;

  const { data: outfitterRow } = await admin
    .from("outfitters")
    .select("name")
    .eq("id", outfitterId)
    .single();

  const outfitterName = outfitterRow?.name ?? "Outfitter";
  const huntTitle = hunt.title ?? `${hunt.species ?? "Hunt"} Hunt`;
  const huntCode = hunt.hunt_code ?? null;
  const startTime = hunt.start_time ?? null;
  const endTime = hunt.end_time ?? null;
  const startDate = startTime ? new Date(startTime).toISOString().slice(0, 10) : "TBD";
  const endDate = endTime ? new Date(endTime).toISOString().slice(0, 10) : "TBD";

  const huntDays = huntDaysFromRange(startTime, endTime);
  const { data: pricingRows } = await admin
    .from("pricing_items")
    .select("id, title, description, amount_usd, category, addon_type, included_days, species, weapons")
    .eq("outfitter_id", outfitterId);
  const pricingItems = (pricingRows ?? []) as PricingItem[];
  let billPricing: PricingItem[] = [];
  if (hunt.selected_pricing_item_id) {
    const selected = pricingItems.find((p) => p.id === hunt.selected_pricing_item_id);
    if (selected) billPricing = [selected];
  }
  if (billPricing.length === 0) {
    billPricing = matchPricingForHunt(
      pricingItems,
      hunt.species ?? null,
      hunt.weapon ?? null,
      huntDays
    );
  }

  const { data: template } = await admin
    .from("contract_templates")
    .select("id, content")
    .eq("outfitter_id", outfitterId)
    .eq("template_type", "hunt_contract")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let contractContent: string;
  if (template?.content) {
    contractContent = template.content
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{client_email\}\}/g, hunt.client_email)
      .replace(/\{\{hunt_title\}\}/g, huntTitle)
      .replace(/\{\{hunt_code\}\}/g, huntCode ?? "Not specified")
      .replace(/\{\{species\}\}/g, hunt.species ?? "Not specified")
      .replace(/\{\{unit\}\}/g, hunt.unit ?? "Not specified")
      .replace(/\{\{weapon\}\}/g, hunt.weapon ?? "Not specified")
      .replace(/\{\{start_date\}\}/g, startDate)
      .replace(/\{\{end_date\}\}/g, endDate)
      .replace(/\{\{camp_name\}\}/g, hunt.camp_name ?? "Not specified")
      .replace(/\{\{outfitter_name\}\}/g, outfitterName)
      .replace(/\{\{outfitter_phone\}\}/g, "")
      .replace(/\{\{outfitter_email\}\}/g, "");
  } else {
    contractContent =
      "HUNT CONTRACT\n\n" +
      `Client: ${clientName}\n` +
      `Email: ${hunt.client_email}\n\n` +
      "Hunt Details:\n" +
      "- Hunt Type: Private Land Tag\n" +
      `- Hunt Code: ${huntCode ?? "Not specified"}\n` +
      `- Species: ${hunt.species ?? "Not specified"}\n` +
      `- Unit: ${hunt.unit ?? "Not specified"}\n` +
      `- Start Date: ${startDate}\n` +
      `- End Date: ${endDate}\n\n` +
      "This contract confirms your private land tag hunt booking.\n\n" +
      `Generated: ${new Date().toISOString().slice(0, 10)}`;
  }

  const DEFAULT_EXTRA_DAY_USD = 100;
  const DEFAULT_NON_HUNTER_USD = 75;
  const billLines = ["\n---\n\nBILL", ""];
  let total = 0;
  for (const p of billPricing) {
    billLines.push(`${p.title}: $${Number(p.amount_usd).toFixed(2)}`);
    total += Number(p.amount_usd);
  }
  const addonData = hunt.client_addon_data && typeof hunt.client_addon_data === "object" ? hunt.client_addon_data as { extra_days?: number; extra_non_hunters?: number; extra_spotters?: number } : {};
  const extraDays = Math.max(0, Number(addonData.extra_days) || 0);
  const extraNonHunters = Math.max(0, Number(addonData.extra_non_hunters) || 0);
  const extraSpotters = Math.max(0, Number(addonData.extra_spotters) || 0);
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
  const extraDayItem = pricingItems.find((i) => isExtraDay(i));
  const nonHunterItem = pricingItems.find((i) => isNonHunter(i));
  const spotterItem = pricingItems.find((i) => isSpotter(i));
  const DEFAULT_SPOTTER_USD = 50;
  const dayRate = extraDayItem != null ? Number(extraDayItem.amount_usd) || DEFAULT_EXTRA_DAY_USD : DEFAULT_EXTRA_DAY_USD;
  const nonHunterRate = nonHunterItem != null ? Number(nonHunterItem.amount_usd) || DEFAULT_NON_HUNTER_USD : DEFAULT_NON_HUNTER_USD;
  const spotterRate = spotterItem != null ? Number(spotterItem.amount_usd) || DEFAULT_SPOTTER_USD : DEFAULT_SPOTTER_USD;
  if (extraDays > 0) {
    const lineTotal = extraDays * dayRate;
    billLines.push(`Extra days (${extraDays} × $${dayRate.toFixed(2)}/day): $${lineTotal.toFixed(2)}`);
    total += lineTotal;
  }
  if (extraNonHunters > 0) {
    const lineTotal = extraNonHunters * nonHunterRate;
    billLines.push(`Non-hunters (${extraNonHunters} × $${nonHunterRate.toFixed(2)}/person): $${lineTotal.toFixed(2)}`);
    total += lineTotal;
  }
  if (extraSpotters > 0) {
    const lineTotal = extraSpotters * spotterRate;
    billLines.push(`Spotter(s) (${extraSpotters} × $${spotterRate.toFixed(2)}/person): $${lineTotal.toFixed(2)}`);
    total += lineTotal;
  }
  if (billPricing.length > 0 || extraDays > 0 || extraNonHunters > 0 || extraSpotters > 0) {
    billLines.push("");
    billLines.push(`Total: $${total.toFixed(2)}`);
    contractContent = contractContent + billLines.join("\n");
  }

  const clientCompletionData: Record<string, unknown> = {};
  if (hunt.selected_pricing_item_id) {
    clientCompletionData.selected_pricing_item_id = hunt.selected_pricing_item_id;
  }
  if (hunt.client_addon_data && typeof hunt.client_addon_data === "object") {
    Object.assign(clientCompletionData, hunt.client_addon_data);
  }

  const { data: contract, error: contractErr } = await admin
    .from("hunt_contracts")
    .insert({
      outfitter_id: outfitterId,
      hunt_id: huntId,
      client_email: hunt.client_email,
      client_name: clientName,
      content: contractContent,
      status: "pending_client_completion",
      template_id: template?.id ?? null,
      ...(Object.keys(clientCompletionData).length > 0 ? { client_completion_data: clientCompletionData } : {}),
    })
    .select("id, status")
    .single();

  if (contractErr) {
    return { contractId: null, error: contractErr.message };
  }

  await admin
    .from("calendar_events")
    .update({ contract_generated_at: new Date().toISOString() })
    .eq("id", huntId)
    .eq("outfitter_id", outfitterId);

  return { contractId: (contract as { id: string }).id };
}
