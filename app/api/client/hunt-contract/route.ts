import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { createHuntContractIfNeeded } from "@/lib/generate-hunt-contract";

async function getClientEmail(supabase: Awaited<ReturnType<typeof supabaseRoute>>): Promise<string | null> {
  // Prefer getUser() in route handlers so the token is verified with the auth server (recommended for API routes)
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) return (user.email as string).toLowerCase().trim();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (!error && session?.user?.email) return (session.user.email as string).toLowerCase().trim();
  const h = await headers();
  const auth = h.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const { data: { user: tokenUser }, error: userErr } = await supabase.auth.getUser(token);
    if (!userErr && tokenUser?.email) return (tokenUser.email as string).toLowerCase().trim();
  }
  return null;
}

/**
 * GET: Get client's hunt contracts
 * Returns all contracts where tag has been confirmed (drawn/confirmed status)
 * Auth: session cookie (web) or Authorization: Bearer <jwt> (e.g. iOS).
 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return local[0] + "***" + domain;
  return local[0] + "***" + local[local.length - 1] + domain;
}

export async function GET(req: Request) {
  const supabase = await supabaseRoute();
  const userEmail = await getClientEmail(supabase);
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmailLower = userEmail;
  const debug = new URL(req.url).searchParams.get("debug") === "1";
  const fixBill = new URL(req.url).searchParams.get("fix_bill") === "1";

  // Use admin for all table reads to avoid RLS policies that reference auth.users
  const admin = supabaseAdmin();

  // Get client record (case-insensitive email)
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .ilike("email", userEmailLower)
    .limit(1)
    .maybeSingle();

  if (!client) {
    return NextResponse.json(
      {
        error: "Client record not found. Ask your outfitter to add you as a client and link your account.",
        ...(debug ? { debug: { email_mask: maskEmail(userEmailLower), client_found: false } } : {}),
      },
      { status: 404 }
    );
  }

  // Get all linked outfitters (so contracts for any linked outfitter show on web, same as calendar)
  const { data: links } = await admin
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true);

  if (!links || links.length === 0) {
    return NextResponse.json(
      {
        error: "Not linked to any outfitter. Ask your outfitter to link your account.",
        ...(debug ? { debug: { email_mask: maskEmail(userEmailLower), client_found: true, link_count: 0 } } : {}),
      },
      { status: 403 }
    );
  }

  const outfitterIds = links.map((l: { outfitter_id: string }) => l.outfitter_id);
  const outfitterId = outfitterIds[0]; // for addon pricing / huntsWithoutContracts query

  // 1a) Dedicated query for id -> hunt_id only (all linked outfitters)
  const { data: idHuntIdRows } = await admin
    .from("hunt_contracts")
    .select("id, hunt_id")
    .in("outfitter_id", outfitterIds);
  const contractIdToHuntId = new Map<string, string | null>(
    (idHuntIdRows || []).map((r: { id: string; hunt_id: string | null }) => [String(r.id), r.hunt_id])
  );

  // 1b) Full contract rows for all linked outfitters (include client_completion_data, outfitter_id for BILL patch)
  const { data: contractRows, error: contractsErr } = await admin
    .from("hunt_contracts")
    .select("id, hunt_id, status, content, client_completed_at, client_signed_at, admin_signed_at, created_at, client_email, client_completion_data, outfitter_id, selected_pricing_item_id, calculated_guide_fee_cents, client_selected_start_date, client_selected_end_date, contract_total_cents")
    .in("outfitter_id", outfitterIds)
    .order("created_at", { ascending: false });

  if (contractsErr) {
    return NextResponse.json(
      { error: contractsErr.message || "Failed to load contracts" },
      { status: 500 }
    );
  }

  const rawContractCount = (contractRows || []).length;
  const filteredContractRows = (contractRows || []).filter(
    (c: { client_email?: string | null }) =>
      c.client_email != null && (c.client_email as string).toLowerCase().trim() === userEmailLower
  );
  const huntIds = [...new Set(
    filteredContractRows.map((c: { id?: string; hunt_id?: string | null }) =>
      contractIdToHuntId.get(String((c as { id?: string }).id)) ?? (c as { hunt_id?: string | null }).hunt_id
    ).filter(Boolean) as string[]
  )];

  // 2) Get hunt details (calendar_events) for those hunt_ids
  type HuntRow = { id?: string; start_time?: string | null; end_time?: string | null; selected_pricing_item_id?: string | null; hunt_code?: string | null; hunt_window_start?: string | null; hunt_window_end?: string | null; private_land_tag_id?: string | null; title?: string; species?: string; unit?: string; weapon?: string | null; guide_username?: string; camp_name?: string | null };
  let huntDetailsByHuntId = new Map<string, HuntRow>();
  if (huntIds.length > 0) {
    const { data: huntRows } = await admin
      .from("calendar_events")
      .select("id, title, species, unit, weapon, start_time, end_time, hunt_type, tag_status, guide_username, camp_name, hunt_code, hunt_window_start, hunt_window_end, private_land_tag_id, selected_pricing_item_id")
      .in("id", huntIds);
    huntDetailsByHuntId = new Map((huntRows || []).map((h: HuntRow & { id?: string }) => [String(h.id), h]));
  }

  // 3) Build response: hunt_id from map first (reliable), then row; attach hunt from calendar_events
  let contracts = filteredContractRows.map((c: Record<string, unknown>) => {
    const contractId = c.id != null ? String(c.id) : undefined;
    const huntId = (contractId ? contractIdToHuntId.get(contractId) : undefined) ?? (c.hunt_id ?? c.huntId ?? null) as string | null;
    const hunt = huntId ? huntDetailsByHuntId.get(String(huntId)) : undefined;
    
    // Check if contract is already completed (has completion data with pricing)
    const completionData = c.client_completion_data as Record<string, unknown> | null | undefined;
    const hasCompletionData = completionData != null && typeof completionData === "object";
    const hasPricingInCompletion = hasCompletionData && Boolean(completionData.selected_pricing_item_id);
    const contractStatus = c.status as string;
    const isCompleted = contractStatus !== "pending_client_completion" || hasPricingInCompletion;
    
    // Contract needs booking if it doesn't have:
    // 1. selected_pricing_item_id (guide fee selected) in contract
    // 2. client_selected_start_date AND client_selected_end_date (dates selected) in contract
    const cAny = c as Record<string, unknown>;
    const hasPricing = Boolean(cAny.selected_pricing_item_id);
    const hasDates = Boolean(cAny.client_selected_start_date && cAny.client_selected_end_date);
    const needsCompleteBooking = !hasPricing || !hasDates;
    
    return {
      id: c.id as string,
      status: c.status,
      content: c.content,
      client_completed_at: c.client_completed_at,
      client_signed_at: c.client_signed_at,
      admin_signed_at: c.admin_signed_at,
      created_at: c.created_at,
      client_completion_data: c.client_completion_data,
      outfitter_id: c.outfitter_id,
      hunt_id: huntId,
      huntId: huntId ?? undefined,
      hunt,
      hunt_code: hunt?.hunt_code ?? null,
      hunt_window_start: hunt?.hunt_window_start ?? null,
      hunt_window_end: hunt?.hunt_window_end ?? null,
      tag_type: null as string | null,
      needs_complete_booking: needsCompleteBooking,
      contract_total_cents: c.contract_total_cents as number | undefined,
    };
  });

  const tagIds = [...new Set(contracts.map((c) => c.hunt?.private_land_tag_id).filter(Boolean) as string[])];
  if (tagIds.length > 0) {
    const { data: tags } = await admin.from("private_land_tags").select("id, tag_type").in("id", tagIds);
    const tagTypeById = new Map((tags || []).map((t: { id: string; tag_type?: string | null }) => [t.id, t.tag_type ?? null]));
    contracts = contracts.map((c) => ({
      ...c,
      tag_type: c.hunt?.private_land_tag_id ? (tagTypeById.get(c.hunt.private_land_tag_id) ?? null) : null,
    }));
  }

  // Add-on pricing: use outfitter pricing_items when present, else defaults so add-ons always show and add to total
  const DEFAULT_EXTRA_DAY_USD = 100;
  const DEFAULT_NON_HUNTER_USD = 75;
  const DEFAULT_SPOTTER_USD_MAIN = 50;
  let addonPricing: { extra_day_usd: number; non_hunter_usd: number; spotter_usd: number } = { extra_day_usd: DEFAULT_EXTRA_DAY_USD, non_hunter_usd: DEFAULT_NON_HUNTER_USD, spotter_usd: DEFAULT_SPOTTER_USD_MAIN };
  const { data: addonItems } = await admin
    .from("pricing_items")
    .select("title, amount_usd, category, addon_type")
    .eq("outfitter_id", outfitterId);
  if (addonItems?.length) {
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
    const isSpotterAddon = (i: { title?: string; category?: string; addon_type?: string | null }) => {
      if ((i as { addon_type?: string }).addon_type === "spotter") return true;
      const cat = (i.category ?? "").trim().toLowerCase();
      const t = titleLower(i.title ?? "");
      return cat === "add-ons" && t.includes("spotter");
    };
    const extraDay = addonItems.find((i) => isExtraDay(i));
    const nonHunter = addonItems.find((i) => isNonHunter(i));
    const spotterItem = addonItems.find((i) => isSpotterAddon(i));
    addonPricing = {
      extra_day_usd: extraDay != null ? Number(extraDay.amount_usd) || DEFAULT_EXTRA_DAY_USD : DEFAULT_EXTRA_DAY_USD,
      non_hunter_usd: nonHunter != null ? Number(nonHunter.amount_usd) || DEFAULT_NON_HUNTER_USD : DEFAULT_NON_HUNTER_USD,
      spotter_usd: spotterItem != null ? Number(spotterItem.amount_usd) || DEFAULT_SPOTTER_USD_MAIN : DEFAULT_SPOTTER_USD_MAIN,
    };
  }
  // Base guide fee per contract (from selected pricing item)
  const pricingItemIds = [...new Set(contracts.map((c: { hunt?: { selected_pricing_item_id?: string | null } }) => c.hunt?.selected_pricing_item_id).filter(Boolean) as string[])];
  let pricingAmountById = new Map<string, number>();
  if (pricingItemIds.length > 0) {
    const { data: pricingRows } = await admin.from("pricing_items").select("id, amount_usd").in("id", pricingItemIds);
    pricingAmountById = new Map((pricingRows || []).map((p: { id: string; amount_usd?: number | null }) => [p.id, Number(p.amount_usd) || 0]));
  }
  contracts = contracts.map((c) => {
    const hunt = c.hunt as { selected_pricing_item_id?: string | null } | undefined;
    const baseGuideFeeUsd = hunt?.selected_pricing_item_id ? (pricingAmountById.get(hunt.selected_pricing_item_id) ?? 0) : 0;
    return { ...c, addon_pricing: addonPricing, base_guide_fee_usd: baseGuideFeeUsd };
  });

  // Also check for hunts that have tags but no contract yet (edge case) — any linked outfitter
  const { data: huntsWithTags } = await admin
    .from("calendar_events")
    .select("id, title, species, unit, start_time, end_time, hunt_type, tag_status, client_email, selected_pricing_item_id")
    .in("outfitter_id", outfitterIds)
    .in("tag_status", ["drawn", "confirmed"]);

  const huntsForClient = (huntsWithTags || []).filter(
    (h: { client_email?: string | null }) =>
      h.client_email != null && (h.client_email as string).toLowerCase() === userEmailLower
  );

  // Find hunts without contracts (only for this client); mark if they still need complete-booking (no dates/guide fee)
  let contractHuntIds = contracts.map((c: { hunt_id?: string | null }) => c.hunt_id).filter(Boolean);
  let huntsWithoutContracts = huntsForClient
    .filter((h: { id: string }) => !contractHuntIds.includes(h.id))
    .map((h: { id: string; title?: string; species?: string; unit?: string; start_time?: string | null; end_time?: string | null; selected_pricing_item_id?: string | null }) => ({
      id: h.id,
      title: h.title,
      species: h.species,
      unit: h.unit,
      needs_complete_booking: !(h.start_time && h.end_time && h.selected_pricing_item_id),
    }));

  // Auto-create missing contracts for this client's hunts (e.g. tag purchase created hunt but contract failed earlier)
  // Only create if hunt doesn't already have a contract (prevent duplicates)
  if (huntsWithoutContracts.length > 0) {
    for (const h of huntsWithoutContracts) {
      // Check if contract already exists before creating
      const { data: existing } = await admin
        .from("hunt_contracts")
        .select("id")
        .eq("hunt_id", h.id)
        .maybeSingle();
      
      if (!existing) {
        await createHuntContractIfNeeded(admin, h.id);
      }
    }
    // Re-fetch contracts so response includes the newly created one(s)
    const { data: idHuntIdRows2 } = await admin
      .from("hunt_contracts")
      .select("id, hunt_id")
      .in("outfitter_id", outfitterIds);
    const contractIdToHuntId2 = new Map<string, string | null>(
      (idHuntIdRows2 || []).map((r: { id: string; hunt_id: string | null }) => [String(r.id), r.hunt_id])
    );
    const { data: contractRows2 } = await admin
      .from("hunt_contracts")
      .select("id, hunt_id, status, content, client_completed_at, client_signed_at, admin_signed_at, created_at, client_email, client_completion_data, outfitter_id, selected_pricing_item_id, calculated_guide_fee_cents, calculated_addons_cents, client_selected_start_date, client_selected_end_date, contract_total_cents")
      .in("outfitter_id", outfitterIds)
      .order("created_at", { ascending: false });
    const filteredContractRows2 = (contractRows2 || []).filter(
      (c: { client_email?: string | null }) =>
        c.client_email != null && (c.client_email as string).toLowerCase().trim() === userEmailLower
    );
    const huntIds2 = [...new Set(
      filteredContractRows2.map((c: { id?: string; hunt_id?: string | null }) =>
        contractIdToHuntId2.get(String((c as { id?: string }).id)) ?? (c as { hunt_id?: string | null }).hunt_id
      ).filter(Boolean) as string[]
    )];
    let huntDetailsByHuntId2 = new Map<string, HuntRow>();
    if (huntIds2.length > 0) {
      const { data: huntRows2 } = await admin
        .from("calendar_events")
        .select("id, title, species, unit, weapon, start_time, end_time, hunt_type, tag_status, guide_username, camp_name, hunt_code, hunt_window_start, hunt_window_end, private_land_tag_id, selected_pricing_item_id")
        .in("id", huntIds2);
      huntDetailsByHuntId2 = new Map((huntRows2 || []).map((h: HuntRow & { id?: string }) => [String(h.id), h]));
    }
    contracts = filteredContractRows2.map((c: Record<string, unknown>) => {
      const contractId = c.id != null ? String(c.id) : undefined;
      const huntId = (contractId ? contractIdToHuntId2.get(contractId) : undefined) ?? (c.hunt_id ?? c.huntId ?? null) as string | null;
      const hunt = huntId ? huntDetailsByHuntId2.get(String(huntId)) : undefined;
      
      // Check if contract is already completed (has completion data with pricing)
      const completionData = c.client_completion_data as Record<string, unknown> | null | undefined;
      const hasCompletionData = completionData != null && typeof completionData === "object";
      const hasPricingInCompletion = hasCompletionData && Boolean(completionData.selected_pricing_item_id);
      const contractStatus = c.status as string;
      const isCompleted = contractStatus !== "pending_client_completion" || hasPricingInCompletion;
      
      // Only need booking if contract is not completed AND hunt doesn't have dates/price
      const hasDatesAndPrice = Boolean(hunt?.start_time && hunt?.end_time && hunt?.selected_pricing_item_id);
      const needsCompleteBooking = !isCompleted && !hasDatesAndPrice;
      
      return {
        id: c.id as string,
        status: c.status,
        content: c.content,
        client_completed_at: c.client_completed_at,
        client_signed_at: c.client_signed_at,
        admin_signed_at: c.admin_signed_at,
        created_at: c.created_at,
        client_completion_data: c.client_completion_data,
        outfitter_id: c.outfitter_id,
        hunt_id: huntId,
        huntId: huntId ?? undefined,
        hunt,
        hunt_code: hunt?.hunt_code ?? null,
        hunt_window_start: hunt?.hunt_window_start ?? null,
        hunt_window_end: hunt?.hunt_window_end ?? null,
        tag_type: null as string | null,
        needs_complete_booking: (() => {
          // Contract needs booking if it doesn't have:
          // 1. selected_pricing_item_id (guide fee selected)
          // 2. client_selected_start_date AND client_selected_end_date (dates selected)
          const cAny = c as Record<string, unknown>;
          const hasPricing = Boolean(cAny.selected_pricing_item_id);
          const hasDates = Boolean(cAny.client_selected_start_date && cAny.client_selected_end_date);
          // Need booking if missing pricing OR dates
          return !hasPricing || !hasDates;
        })(),
        contract_total_cents: c.contract_total_cents as number | undefined,
      };
    });
    const tagIds2 = [...new Set(contracts.map((c) => c.hunt?.private_land_tag_id).filter(Boolean) as string[])];
    if (tagIds2.length > 0) {
      const { data: tags2 } = await admin.from("private_land_tags").select("id, tag_type").in("id", tagIds2);
      const tagTypeById2 = new Map((tags2 || []).map((t: { id: string; tag_type?: string | null }) => [t.id, t.tag_type ?? null]));
      contracts = contracts.map((c) => ({
        ...c,
        tag_type: c.hunt?.private_land_tag_id ? (tagTypeById2.get(c.hunt.private_land_tag_id) ?? null) : null,
      }));
    }
    // Recalculate contract totals using the same logic as "Pay in Full" button
    // This ensures displayed totals match what clients will actually pay
    const { getContractGuideFeeCents } = await import("@/lib/guide-fee-bill-server");
    const contractTotals = new Map<string, number>();
    await Promise.all(
      contracts.map(async (c) => {
        if (!c.id) return;
        try {
          const correctTotal = await getContractGuideFeeCents(admin, c.id);
          if (correctTotal) {
            contractTotals.set(c.id, correctTotal.totalCents);
            // Update database if stored value is wrong (async, don't block)
            const cAny = c as Record<string, unknown>;
            const currentTotal = (cAny.contract_total_cents as number) || 0;
            if (currentTotal !== correctTotal.totalCents) {
              Promise.resolve(admin
                .from("hunt_contracts")
                .update({ contract_total_cents: correctTotal.totalCents })
                .eq("id", c.id))
                .catch((err) => {
                  console.warn(`[hunt-contract] Failed to update total for contract ${c.id}:`, err);
                });
            }
          }
        } catch (err) {
          console.warn(`[hunt-contract] Failed to recalculate total for contract ${c.id}:`, err);
        }
      })
    );

    contracts = contracts.map((c) => {
      // Use calculated guide fee from contract if available, otherwise calculate from pricing item
      const cAny = c as Record<string, unknown>;
      let baseGuideFeeUsd = 0;
      if (cAny.calculated_guide_fee_cents) {
        baseGuideFeeUsd = (cAny.calculated_guide_fee_cents as number) / 100;
      } else if (cAny.selected_pricing_item_id) {
        baseGuideFeeUsd = pricingAmountById.get(cAny.selected_pricing_item_id as string) ?? 0;
      } else {
        // Fallback to hunt's selected_pricing_item_id
        const hunt = c.hunt as { selected_pricing_item_id?: string | null } | undefined;
        if (hunt?.selected_pricing_item_id) {
          baseGuideFeeUsd = pricingAmountById.get(hunt.selected_pricing_item_id) ?? 0;
        }
      }
      
      // Use recalculated total (same as "Pay in Full") if available, otherwise use stored value
      const recalculatedTotal = c.id ? contractTotals.get(c.id) : undefined;
      const storedTotal = (cAny.contract_total_cents as number) || 0;
      const finalContractTotal = recalculatedTotal ?? (storedTotal > 0 ? storedTotal : undefined);
      
      return { ...c, addon_pricing: addonPricing, base_guide_fee_usd: baseGuideFeeUsd, contract_total_cents: finalContractTotal };
    });
    contractHuntIds = contracts.map((c) => c.hunt_id).filter(Boolean);
    huntsWithoutContracts = huntsForClient
      .filter((h: { id: string }) => !contractHuntIds.includes(h.id))
      .map((h: { id: string; title?: string; species?: string; unit?: string; start_time?: string | null; end_time?: string | null; selected_pricing_item_id?: string | null }) => ({
        id: h.id,
        title: h.title,
        species: h.species,
        unit: h.unit,
        needs_complete_booking: !(h.start_time && h.end_time && h.selected_pricing_item_id),
      }));
  }

  // Patch BILL in content for contracts already submitted with add-ons (so you see add-ons when viewing)
  // Use ?fix_bill=1 to force re-patch and persist for any contract with client_completion_data
  const DEFAULT_SPOTTER_USD = 50;
  function parseAddonCounts(raw: unknown): { extraDays: number; extraNonHunters: number; extraSpotters: number; rifleRental: number } {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const num = (v: unknown) => Math.max(0, parseInt(String(v ?? ""), 10) || Number(v) || 0);
    const extraDays = num(o.extra_days ?? o.additional_days ?? 0);
    const extraNonHunters = num(o.extra_non_hunters ?? o.non_hunters ?? 0);
    const extraSpotters = num(o.extra_spotters ?? 0);
    const rifleRental = num(o.rifle_rental ?? 0);
    return { extraDays, extraNonHunters, extraSpotters, rifleRental };
  }
  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    const rawCompletion = c.client_completion_data;
    const { extraDays, extraNonHunters, extraSpotters, rifleRental } = parseAddonCounts(rawCompletion);
    const hasAddonsInCompletion = extraDays > 0 || extraNonHunters > 0 || extraSpotters > 0 || rifleRental > 0;
    const hasCompletionData = rawCompletion != null && typeof rawCompletion === "object" && Object.keys(rawCompletion as object).length > 0;
    if (!hasAddonsInCompletion && !(fixBill && hasCompletionData)) continue;
    const outId = c.outfitter_id as string | undefined;
    const huntId = c.hunt_id as string | null | undefined;
    if (!outId) continue;
    const content = (c.content as string) || "";
    let guideFeeTitle = "Guide fee";
    const cAny = c as Record<string, unknown>;
    let baseGuideFeeUsd = (cAny.base_guide_fee_usd as number) ?? 0;
    if (huntId) {
      const { data: huntRow } = await admin.from("calendar_events").select("selected_pricing_item_id").eq("id", huntId).single();
      const selId = (huntRow as { selected_pricing_item_id?: string | null } | null)?.selected_pricing_item_id;
      if (selId) {
        const { data: pr } = await admin.from("pricing_items").select("title, amount_usd").eq("id", selId).single();
        if (pr) {
          guideFeeTitle = (pr as { title?: string }).title ?? guideFeeTitle;
          baseGuideFeeUsd = Number((pr as { amount_usd?: number }).amount_usd) || 0;
        }
      }
    }
    const { data: addonItemsForPatch } = await admin.from("pricing_items").select("title, amount_usd, category, addon_type").eq("outfitter_id", outId);
    const tl = (t: string) => (t ?? "").toLowerCase();
    const isED = (i: { title?: string; category?: string; addon_type?: string | null }) => { if ((i as { addon_type?: string }).addon_type === "extra_days") return true; const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase(); if (cat !== "add-ons") return false; const t = tl((i as { title?: string }).title ?? ""); if (t.includes("non")) return false; return t.includes("additional day") || t.includes("extra day") || t.includes("day"); };
    const isNH = (i: { title?: string; category?: string; addon_type?: string | null }) => { if ((i as { addon_type?: string }).addon_type === "non_hunter") return true; const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase(); const t = tl((i as { title?: string }).title ?? ""); return cat === "add-ons" && (t.includes("non-hunter") || t.includes("non hunter") || (t.includes("non") && t.includes("hunter"))); };
    const isSpotter = (i: { title?: string; category?: string; addon_type?: string | null }) => { if ((i as { addon_type?: string }).addon_type === "spotter") return true; const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase(); const t = tl((i as { title?: string }).title ?? ""); return cat === "add-ons" && t.includes("spotter"); };
    const isRifleRental = (i: { title?: string; category?: string; addon_type?: string | null }) => { if ((i as { addon_type?: string }).addon_type === "rifle_rental") return true; const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase(); const t = tl((i as { title?: string }).title ?? ""); return cat === "add-ons" && (t.includes("rifle") && (t.includes("rental") || t.includes("rent"))); };
    const edItem = (addonItemsForPatch ?? []).find((x) => isED(x));
    const nhItem = (addonItemsForPatch ?? []).find((x) => isNH(x));
    const spotterItem = (addonItemsForPatch ?? []).find((x) => isSpotter(x));
    const rifleRentalItem = (addonItemsForPatch ?? []).find((x) => isRifleRental(x));
    const DEFAULT_RIFLE_RENTAL_USD = 500;
    const dayRate = edItem != null ? Number((edItem as { amount_usd?: number }).amount_usd) || DEFAULT_EXTRA_DAY_USD : DEFAULT_EXTRA_DAY_USD;
    const nhRate = nhItem != null ? Number((nhItem as { amount_usd?: number }).amount_usd) || DEFAULT_NON_HUNTER_USD : DEFAULT_NON_HUNTER_USD;
    const spotterRate = spotterItem != null ? Number((spotterItem as { amount_usd?: number }).amount_usd) || DEFAULT_SPOTTER_USD : DEFAULT_SPOTTER_USD;
    const rifleRentalRate = rifleRentalItem != null ? Number((rifleRentalItem as { amount_usd?: number }).amount_usd) || DEFAULT_RIFLE_RENTAL_USD : DEFAULT_RIFLE_RENTAL_USD;
    const addonUsd = extraDays * dayRate + extraNonHunters * nhRate + extraSpotters * spotterRate + rifleRental * rifleRentalRate;
    const totalUsd = baseGuideFeeUsd + addonUsd;
    const lines = ["\n---\n\nBILL", "", `${guideFeeTitle}: $${baseGuideFeeUsd.toFixed(2)}`];
    if (extraDays > 0) lines.push(`Extra days (${extraDays} × $${dayRate.toFixed(2)}/day): $${(extraDays * dayRate).toFixed(2)}`);
    if (extraNonHunters > 0) lines.push(`Non-hunters (${extraNonHunters} × $${nhRate.toFixed(2)}/person): $${(extraNonHunters * nhRate).toFixed(2)}`);
    if (extraSpotters > 0) lines.push(`Spotter(s) (${extraSpotters} × $${spotterRate.toFixed(2)}/person): $${(extraSpotters * spotterRate).toFixed(2)}`);
    if (rifleRental > 0) lines.push(`Rifle Rental (${rifleRental} × $${rifleRentalRate.toFixed(2)}/rental): $${(rifleRental * rifleRentalRate).toFixed(2)}`);
    lines.push("", `Total: $${totalUsd.toFixed(2)}`);
    const newBill = lines.join("\n");
    // Match BILL section (permissive: --- BILL, BILL at start of line, etc.)
    const billMatch =
      content.match(/(\r?\n)?---\s*\r?\n+\s*BILL[\s\S]*/i) ??
      content.match(/(\r?\n)?---\s*BILL[\s\S]*/i) ??
      content.match(/(\r?\n)\s*BILL\s*\r?\n[\s\S]*/i) ??
      content.match(/\n\s*Bill\s*\n[\s\S]*/i);
    const newContent = billMatch
      ? content.slice(0, content.length - billMatch[0].length) + newBill
      : content.trimEnd() + newBill;
    contracts[i] = { ...c, content: newContent };
    // Persist so the contract you have now stays fixed
    await admin
      .from("hunt_contracts")
      .update({ content: newContent })
      .eq("id", c.id as string);
  }

  const firstContract = contracts[0];
  return NextResponse.json(
    {
      contracts: contracts ?? [],
      hunts_without_contracts: huntsWithoutContracts,
      eligible: (contracts && contracts.length > 0) || (huntsWithoutContracts.length > 0),
      first_hunt_id: firstContract?.hunt_id ?? null,
      ...(debug ? {
        debug: {
          email_mask: maskEmail(userEmailLower),
          client_found: true,
          link_count: links.length,
          outfitter_ids_count: outfitterIds.length,
          contracts_raw_count: rawContractCount,
          contracts_after_email_filter: filteredContractRows.length,
        },
      } : {}),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

/**
 * POST: Client completes and submits their portion of the contract
 */
export async function POST(req: Request) {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = (userData.user.email || "").toLowerCase().trim();
  const body = await req.json();
  const { contract_id, completion_data } = body;

  if (!contract_id) {
    return NextResponse.json({ error: "contract_id is required" }, { status: 400 });
  }

  // Get the contract by id and verify ownership (case-insensitive email)
  const admin = supabaseAdmin();
  const { data: contract, error: contractErr } = await admin
    .from("hunt_contracts")
    .select("id, status, client_email, hunt_id, content, outfitter_id, calculated_guide_fee_cents, selected_pricing_item_id, calculated_addons_cents")
    .eq("id", contract_id)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const contractEmail = (contract.client_email || "").toLowerCase().trim();
  if (contractEmail !== userEmail) {
    return NextResponse.json({ error: "This contract is not assigned to you" }, { status: 403 });
  }

  // Verify status allows completion
  if (contract.status !== "pending_client_completion") {
    return NextResponse.json(
      { error: `Contract cannot be completed in current status: ${contract.status}` },
      { status: 400 }
    );
  }

  const completion = completion_data || {};
  let clientStart = completion.client_start_date as string | undefined;
  let clientEnd = completion.client_end_date as string | undefined;

  // If client didn't send dates (details are at top from complete-booking), use hunt's existing dates
  if ((!clientStart || !clientEnd) && contract.hunt_id) {
    const { data: huntEvent } = await supabase
      .from("calendar_events")
      .select("start_time, end_time")
      .eq("id", contract.hunt_id)
      .single();
    if (huntEvent?.start_time && huntEvent?.end_time) {
      clientStart = clientStart || new Date(huntEvent.start_time).toISOString().slice(0, 10);
      clientEnd = clientEnd || new Date(huntEvent.end_time).toISOString().slice(0, 10);
    }
  }

  if (!clientStart || !clientEnd) {
    return NextResponse.json(
      { error: "Hunt dates are required. Your hunt details should show dates at the top; if not, contact your outfitter." },
      { status: 400 }
    );
  }

  // When the hunt has a season window (hunt code), enforce dates are within that window
  if (contract.hunt_id) {
    const { data: huntEvent } = await supabase
      .from("calendar_events")
      .select("hunt_window_start, hunt_window_end, hunt_code")
      .eq("id", contract.hunt_id)
      .single();

    let windowStart: string | null = huntEvent?.hunt_window_start
      ? new Date(huntEvent.hunt_window_start).toISOString().slice(0, 10)
      : null;
    let windowEnd: string | null = huntEvent?.hunt_window_end
      ? new Date(huntEvent.hunt_window_end).toISOString().slice(0, 10)
      : null;

    // If event has hunt_code but no stored window, look up from hunt codes CSV
    if (huntEvent?.hunt_code && (!windowStart || !windowEnd)) {
      const { getHuntCodeByCode } = await import("@/lib/hunt-codes-server");
      const codeRow = getHuntCodeByCode(huntEvent.hunt_code);
      if (codeRow?.start_date && codeRow?.end_date) {
        windowStart = codeRow.start_date.slice(0, 10);
        windowEnd = codeRow.end_date.slice(0, 10);
      }
    }

    if (huntEvent?.hunt_code && windowStart && windowEnd) {
      if (clientStart < windowStart || clientEnd > windowEnd || clientStart > clientEnd) {
        return NextResponse.json(
          {
            error: `Hunt dates must be within your hunt code season (${windowStart} – ${windowEnd}).`,
          },
          { status: 400 }
        );
      }
    }
  }

  // If client specified their hunt dates, update the linked calendar event
  // Also update selected_pricing_item_id if it's in completion data (mark booking as complete)
  if (contract.hunt_id && clientStart && clientEnd) {
    const startTimeIso = new Date(clientStart + "T00:00:00Z").toISOString();
    const endTimeIso = new Date(clientEnd + "T23:59:59Z").toISOString();
    const updateData: Record<string, unknown> = {
      start_time: startTimeIso,
      end_time: endTimeIso,
    };
    
    // If completion data has selected_pricing_item_id, update hunt to mark booking complete
    const completion = completion_data || {};
    const selectedPricingId = (completion as Record<string, unknown>).selected_pricing_item_id as string | undefined;
    if (selectedPricingId) {
      updateData.selected_pricing_item_id = selectedPricingId;
    }
    
    await admin
      .from("calendar_events")
      .update(updateData)
      .eq("id", contract.hunt_id);
  }

  // Rewrite BILL section in contract content to include add-ons (extra_days, extra_non_hunters) and correct total
  // CRITICAL: Use calculated_guide_fee_cents from contract (accounts for selected days), NOT pricing item amount
  const DEFAULT_EXTRA_DAY_USD = 100;
  const DEFAULT_NON_HUNTER_USD = 75;
  let baseGuideFeeUsd = 0;
  let guideFeeTitle = "Guide fee";
  
  // Use calculated_guide_fee_cents from contract if available (this accounts for selected days)
  if (contract.calculated_guide_fee_cents && contract.calculated_guide_fee_cents > 0) {
    baseGuideFeeUsd = (contract.calculated_guide_fee_cents as number) / 100;
    // Get pricing item title for display
    if (contract.selected_pricing_item_id) {
      const { data: pricingRow } = await admin
        .from("pricing_items")
        .select("title")
        .eq("id", contract.selected_pricing_item_id)
        .single();
      if (pricingRow) {
        guideFeeTitle = (pricingRow as { title?: string }).title ?? guideFeeTitle;
      }
    }
  } else if (contract.hunt_id) {
    // Fallback: use pricing item amount (for contracts created before per-day calculation)
    const { data: huntRow } = await admin
      .from("calendar_events")
      .select("selected_pricing_item_id")
      .eq("id", contract.hunt_id)
      .single();
    const selectedId = (huntRow as { selected_pricing_item_id?: string | null } | null)?.selected_pricing_item_id;
    if (selectedId) {
      const { data: pricingRow } = await admin
        .from("pricing_items")
        .select("title, amount_usd")
        .eq("id", selectedId)
        .single();
      if (pricingRow) {
        guideFeeTitle = (pricingRow as { title?: string }).title ?? guideFeeTitle;
        baseGuideFeeUsd = Number((pricingRow as { amount_usd?: number }).amount_usd) || 0;
      }
    }
  }
  const { data: addonItems } = await admin
    .from("pricing_items")
    .select("title, amount_usd, category, addon_type")
    .eq("outfitter_id", contract.outfitter_id);
  const titleLower = (t: string) => (t ?? "").toLowerCase();
  const isExtraDay = (i: { title?: string; category?: string; addon_type?: string | null }) => {
    if ((i as { addon_type?: string }).addon_type === "extra_days") return true;
    const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase();
    if (cat !== "add-ons") return false; // never use guide-fee items (e.g. "5-Day Hunt" $8000)
    const t = titleLower((i as { title?: string }).title ?? "");
    if (t.includes("non")) return false;
    return t.includes("additional day") || t.includes("extra day") || t.includes("day");
  };
  const isNonHunter = (i: { title?: string; category?: string }) => {
    const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase();
    const t = titleLower((i as { title?: string }).title ?? "");
    return cat === "add-ons" && (t.includes("non-hunter") || t.includes("non hunter") || (t.includes("non") && t.includes("hunter")));
  };
  const isSpotter = (i: { title?: string; category?: string; addon_type?: string | null }) => {
    if ((i as { addon_type?: string }).addon_type === "spotter") return true;
    const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase();
    const t = titleLower((i as { title?: string }).title ?? "");
    return cat === "add-ons" && t.includes("spotter");
  };
  const isRifleRental = (i: { title?: string; category?: string; addon_type?: string | null }) => {
    if ((i as { addon_type?: string }).addon_type === "rifle_rental") return true;
    const cat = ((i as { category?: string }).category ?? "").trim().toLowerCase();
    const t = titleLower((i as { title?: string }).title ?? "");
    return cat === "add-ons" && (t.includes("rifle") && (t.includes("rental") || t.includes("rent")));
  };
  const extraDayItem = (addonItems ?? []).find((i: { title?: string }) => isExtraDay(i));
  const nonHunterItem = (addonItems ?? []).find((i: { title?: string; category?: string }) => isNonHunter(i));
  const spotterItem = (addonItems ?? []).find((i) => isSpotter(i));
  const rifleRentalItem = (addonItems ?? []).find((i) => isRifleRental(i));
  const dayRate = extraDayItem != null ? Number((extraDayItem as { amount_usd?: number }).amount_usd) || DEFAULT_EXTRA_DAY_USD : DEFAULT_EXTRA_DAY_USD;
  const nonHunterRate = nonHunterItem != null ? Number((nonHunterItem as { amount_usd?: number }).amount_usd) || DEFAULT_NON_HUNTER_USD : DEFAULT_NON_HUNTER_USD;
  const DEFAULT_SPOTTER_USD_POST = 50;
  const DEFAULT_RIFLE_RENTAL_USD_POST = 500;
  const spotterRate = spotterItem != null ? Number((spotterItem as { amount_usd?: number }).amount_usd) || DEFAULT_SPOTTER_USD_POST : DEFAULT_SPOTTER_USD_POST;
  const rifleRentalRate = rifleRentalItem != null ? Number((rifleRentalItem as { amount_usd?: number }).amount_usd) || DEFAULT_RIFLE_RENTAL_USD_POST : DEFAULT_RIFLE_RENTAL_USD_POST;
  const co = completion as Record<string, unknown>;
  const extraDays = Math.max(0, parseInt(String(co.extra_days ?? co.additional_days ?? 0), 10) || Number(co.extra_days ?? co.additional_days) || 0);
  const extraNonHunters = Math.max(0, parseInt(String(co.extra_non_hunters ?? co.non_hunters ?? 0), 10) || Number(co.extra_non_hunters ?? co.non_hunters) || 0);
  const extraSpotters = Math.max(0, parseInt(String(co.extra_spotters ?? 0), 10) || Number(co.extra_spotters) || 0);
  const rifleRental = Math.max(0, parseInt(String(co.rifle_rental ?? 0), 10) || Number(co.rifle_rental) || 0);
  const addonUsd = extraDays * dayRate + extraNonHunters * nonHunterRate + extraSpotters * spotterRate + rifleRental * rifleRentalRate;
  const totalUsd = baseGuideFeeUsd + addonUsd;

  const newBillLines = [
    "\n---\n\nBILL",
    "",
    `${guideFeeTitle}: $${baseGuideFeeUsd.toFixed(2)}`,
  ];
  if (extraDays > 0) {
    newBillLines.push(`Extra days (${extraDays} × $${dayRate.toFixed(2)}/day): $${(extraDays * dayRate).toFixed(2)}`);
  }
  if (extraNonHunters > 0) {
    newBillLines.push(`Non-hunters (${extraNonHunters} × $${nonHunterRate.toFixed(2)}/person): $${(extraNonHunters * nonHunterRate).toFixed(2)}`);
  }
  if (extraSpotters > 0) {
    newBillLines.push(`Spotter(s) (${extraSpotters} × $${spotterRate.toFixed(2)}/person): $${(extraSpotters * spotterRate).toFixed(2)}`);
  }
  if (rifleRental > 0) {
    newBillLines.push(`Rifle Rental (${rifleRental} × $${rifleRentalRate.toFixed(2)}/rental): $${(rifleRental * rifleRentalRate).toFixed(2)}`);
  }
  newBillLines.push("");
  newBillLines.push(`Total: $${totalUsd.toFixed(2)}`);

  let newContent = (contract.content as string) || "";
  const billMatch = newContent.match(/\n?---\s*\n+\s*BILL[\s\S]*/);
  if (billMatch) {
    newContent = newContent.slice(0, newContent.length - billMatch[0].length) + newBillLines.join("\n");
  } else {
    newContent = newContent.trimEnd() + "\n" + newBillLines.join("\n");
  }

  // Update contract: status, completion data, and content with BILL including add-ons
  const { data, error } = await admin
    .from("hunt_contracts")
    .update({
      status: "pending_admin_review",
      client_completed_at: new Date().toISOString(),
      client_completion_data: completion,
      content: newContent,
    })
    .eq("id", contract_id)
    .eq("client_email", userEmail)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    contract: data,
    message: "Contract submitted successfully! It has been sent to your outfitter for review.",
  });
}
