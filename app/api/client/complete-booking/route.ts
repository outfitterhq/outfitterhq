import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { matchPricingForHunt } from "@/lib/pricing-match";
import type { PricingItem } from "@/lib/types/pricing";
import { getHuntCodeByCode } from "@/lib/hunt-codes-server";
import { createHuntContractIfNeeded } from "@/lib/generate-hunt-contract";

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
 * GET: Fetch hunt details and pricing plans.
 * Query: hunt_id (calendar_events id) OR contract_id (hunt_contracts id – when contract exists but hunt not linked yet).
 * Auth: session cookie (web) or Authorization: Bearer <jwt> (e.g. iOS).
 */
export async function GET(req: Request) {
  const supabase = await supabaseRoute();
  const userEmail = await getClientEmail(supabase);
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  let huntId = searchParams.get("hunt_id");
  const contractId = searchParams.get("contract_id");

  const admin = supabaseAdmin();

  if (contractId && !huntId) {
    const { data: contract, error: contractErr } = await admin
      .from("hunt_contracts")
      .select("id, hunt_id, client_email, outfitter_id")
      .eq("id", contractId)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if ((contract.client_email || "").toLowerCase() !== userEmail) {
      return NextResponse.json({ error: "This contract is not yours" }, { status: 403 });
    }

    huntId = contract.hunt_id ?? null;
    if (!huntId) {
      // Try to find an existing unlinked hunt for this client
      const { data: huntsWithTags } = await admin
        .from("calendar_events")
        .select("id, client_email")
        .eq("outfitter_id", contract.outfitter_id)
        .in("tag_status", ["drawn", "confirmed"]);
      const forClient = (huntsWithTags || []).filter(
        (h: { client_email?: string | null }) => (h.client_email || "").toLowerCase() === userEmail
      );
      const { data: linkedHuntIds } = await admin
        .from("hunt_contracts")
        .select("hunt_id")
        .eq("outfitter_id", contract.outfitter_id)
        .not("hunt_id", "is", null);
      const used = new Set((linkedHuntIds || []).map((r: { hunt_id: string }) => r.hunt_id));
      const firstUnlinked = forClient.find((h: { id: string }) => !used.has(h.id));
      if (firstUnlinked) {
        huntId = firstUnlinked.id;
        await admin.from("hunt_contracts").update({ hunt_id: huntId }).eq("id", contractId);
      } else {
        // No existing hunt found - create one from draw_results if available
        // Try to find draw_result by contract_id first, then by client_email + outfitter_id
        let drawResult: { species?: string | null; unit?: string | null; weapon?: string | null; hunt_code?: string | null } | null = null;
        let foundByContract = false;
        
        const { data: drawByContract } = await admin
          .from("draw_results")
          .select("species, unit, weapon, hunt_code")
          .eq("contract_id", contractId)
          .limit(1)
          .maybeSingle();
        
        if (drawByContract) {
          drawResult = drawByContract;
          foundByContract = true;
        } else {
          // Fallback: find by client_email and outfitter_id (for draw contracts created before linking)
          const { data: drawByClient } = await admin
            .from("draw_results")
            .select("species, unit, weapon, hunt_code")
            .eq("outfitter_id", contract.outfitter_id)
            .eq("client_email", contract.client_email)
            .eq("result_status", "drawn")
            .is("hunt_id", null) // Only use unlinked draw results
            .limit(1)
            .maybeSingle();
          
          if (drawByClient) {
            drawResult = drawByClient;
          }
        }
        
        if (drawResult) {
          // Create a calendar_events record for this draw contract
          const { data: newHunt, error: createErr } = await admin
            .from("calendar_events")
            .insert({
              outfitter_id: contract.outfitter_id,
              client_email: contract.client_email,
              title: `${drawResult.species || "Hunt"}${drawResult.unit ? ` - Unit ${drawResult.unit}` : ""}`,
              species: drawResult.species || null,
              unit: drawResult.unit || null,
              weapon: drawResult.weapon || null,
              hunt_code: drawResult.hunt_code || null,
              tag_status: "drawn",
              status: "Pending",
            })
            .select("id")
            .single();
          
          if (!createErr && newHunt) {
            huntId = newHunt.id;
            // Link the contract to the new hunt
            await admin.from("hunt_contracts").update({ hunt_id: huntId }).eq("id", contractId);
            // Also link the draw_result to the new hunt
            if (foundByContract) {
              await admin.from("draw_results").update({ hunt_id: huntId }).eq("contract_id", contractId);
            } else {
              await admin.from("draw_results").update({ hunt_id: huntId, contract_id: contractId })
                .eq("outfitter_id", contract.outfitter_id)
                .eq("client_email", contract.client_email)
                .eq("result_status", "drawn")
                .is("hunt_id", null)
                .limit(1);
            }
          } else {
            console.error("[complete-booking] Failed to create hunt from draw_result:", createErr);
          }
        } else {
          // No draw_result found - create a minimal hunt anyway so user can complete booking
          console.error("[complete-booking] No draw_result found, creating minimal hunt for contract:", contractId, "outfitter_id:", contract.outfitter_id, "client_email:", contract.client_email);
          try {
            // Create minimal hunt with placeholder dates (will be updated when user completes booking)
            const now = new Date();
            const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30); // 30 days from now
            const defaultEnd = new Date(defaultStart);
            defaultEnd.setDate(defaultEnd.getDate() + 5); // 5 day default hunt
            
            const { data: newHunt, error: createErr } = await admin
              .from("calendar_events")
              .insert({
                outfitter_id: contract.outfitter_id,
                client_email: contract.client_email,
                title: "Hunt - Complete Booking",
                tag_status: "drawn",
                status: "Pending",
                start_time: defaultStart.toISOString(),
                end_time: defaultEnd.toISOString(),
              })
              .select("id")
              .single();
            
            if (createErr) {
              console.error("[complete-booking] Error creating minimal hunt:", createErr);
              throw createErr;
            }
            
            if (newHunt) {
              huntId = newHunt.id;
              console.error("[complete-booking] Created minimal hunt:", huntId);
              // Link the contract to the new hunt
              const { error: linkErr } = await admin.from("hunt_contracts").update({ hunt_id: huntId }).eq("id", contractId);
              if (linkErr) {
                console.error("[complete-booking] Error linking contract to hunt:", linkErr);
              } else {
                console.error("[complete-booking] Successfully linked contract to hunt");
              }
            } else {
              console.error("[complete-booking] No hunt returned from insert");
            }
          } catch (err: any) {
            console.error("[complete-booking] Exception creating minimal hunt:", err);
          }
        }
      }
    }
  }

  if (!huntId) {
    return NextResponse.json({ error: "Could not find or create a hunt for this contract. Please contact your outfitter." }, { status: 400 });
  }

  // When we have contract_id (e.g. draw flow), get hunt_code from draw_results so we can show it and look up window dates even if the calendar event doesn't have it yet
  let contractHuntCode: string | null = null;
  if (contractId) {
    const { data: drawRow } = await admin
      .from("draw_results")
      .select("hunt_code")
      .eq("contract_id", contractId)
      .not("hunt_code", "is", null)
      .limit(1)
      .maybeSingle();
    if (drawRow?.hunt_code) contractHuntCode = (drawRow.hunt_code as string).trim();
  }

  // Check if booking is already complete (has dates and pricing)
  const baseSelect = "id, title, species, unit, weapon, hunt_code, hunt_window_start, hunt_window_end, client_email, outfitter_id, start_time, end_time, selected_pricing_item_id";
  let hunt: Record<string, unknown> | null = null;
  let huntErr: { message: string } | null = null;

  let res = await admin
    .from("calendar_events")
    .select(`${baseSelect}, client_addon_data`)
    .eq("id", huntId)
    .single();
  hunt = res.data as Record<string, unknown> | null;
  huntErr = res.error as { message: string } | null;
  
  // If booking is already complete (has dates AND pricing selected), return early with a message
  // But allow re-selection if only dates are set (client can change pricing)
  if (hunt && hunt.start_time && hunt.end_time && hunt.selected_pricing_item_id) {
    // Check if contract exists and has a total set
    const { data: existingContract } = await admin
      .from("hunt_contracts")
      .select("contract_total_cents, selected_pricing_item_id")
      .eq("hunt_id", hunt.id)
      .maybeSingle();
    
    // Only mark as complete if contract has a total > 0 (meaning pricing was actually selected)
    if (existingContract && existingContract.contract_total_cents && existingContract.contract_total_cents > 0) {
      return NextResponse.json({
        hunt: {
          id: hunt.id,
          title: hunt.title,
          species: hunt.species,
          unit: hunt.unit,
          weapon: hunt.weapon === "Bow" ? "Archery" : hunt.weapon,
          hunt_code: hunt.hunt_code,
          hunt_window_start: hunt.hunt_window_start,
          hunt_window_end: hunt.hunt_window_end,
          window_start: hunt.hunt_window_start ? new Date(hunt.hunt_window_start as string).toISOString().slice(0, 10) : null,
          window_end: hunt.hunt_window_end ? new Date(hunt.hunt_window_end as string).toISOString().slice(0, 10) : null,
        },
        pricing_plans: [],
        addon_items: [],
        client_addon_data: hunt.client_addon_data || null,
        booking_complete: true,
        message: "Your booking is already complete. You can view your contract in the Documents section.",
      });
    }
    // Otherwise, allow them to select pricing even if dates are set
  }

  const errMsg = (huntErr as { message?: string } | null)?.message ?? String(huntErr ?? "");
  if (huntErr && (errMsg.includes("client_addon_data") || errMsg.includes("schema cache") || errMsg.includes("does not exist"))) {
    res = await admin
      .from("calendar_events")
      .select(baseSelect)
      .eq("id", huntId)
      .single();
    hunt = res.data as Record<string, unknown> | null;
    huntErr = res.error as { message: string } | null;
  }

  if (huntErr || !hunt) {
    return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
  }

  if ((hunt.client_email as string || "").toLowerCase() !== userEmail) {
    return NextResponse.json({ error: "This hunt is not assigned to you" }, { status: 403 });
  }

  const { data: pricingRows } = await admin
    .from("pricing_items")
    .select("id, title, description, amount_usd, category, addon_type, included_days, species, weapons")
    .eq("outfitter_id", hunt.outfitter_id);

  const allItems = (pricingRows ?? []) as PricingItem[];
  const weaponNorm = hunt.weapon === "Bow" ? "Archery" : hunt.weapon;
  const ADDONS_CATEGORY = "Add-ons";
  const guideFeeItems = allItems.filter((i) => (i.category || "").trim().toLowerCase() !== ADDONS_CATEGORY.toLowerCase());
  const matchingPlans = matchPricingForHunt(guideFeeItems, hunt.species as string | null | undefined, weaponNorm as string | null | undefined, null);
  const addonItems = allItems.filter((i) => (i.category || "").trim().toLowerCase() === ADDONS_CATEGORY.toLowerCase());

  // Effective hunt code: from calendar event first, then from draw result linked to this contract (so draw hunts show code + days)
  const effectiveHuntCode = String(hunt.hunt_code ?? contractHuntCode ?? "").trim();

  // Window dates: from calendar event, or look up from hunt-codes CSV when we have a code but missing window
  let windowStart: string | null = hunt.hunt_window_start
    ? new Date(hunt.hunt_window_start as string).toISOString().slice(0, 10)
    : null;
  let windowEnd: string | null = hunt.hunt_window_end
    ? new Date(hunt.hunt_window_end as string).toISOString().slice(0, 10)
    : null;
  if (effectiveHuntCode && (!windowStart || !windowEnd)) {
    const row = getHuntCodeByCode(effectiveHuntCode);
    if (row?.start_date && row?.end_date) {
      windowStart = row.start_date;
      windowEnd = row.end_date;
      // Persist to calendar_events so future requests and POST date validation use the same window (and hunt_code if missing)
      const startIso = new Date(row.start_date + "T00:00:00Z").toISOString();
      const endIso = new Date(row.end_date + "T23:59:59Z").toISOString();
      const updatePayload: Record<string, unknown> = {
        hunt_window_start: startIso,
        hunt_window_end: endIso,
      };
      if (!hunt.hunt_code && effectiveHuntCode) updatePayload.hunt_code = effectiveHuntCode;
      await admin
        .from("calendar_events")
        .update(updatePayload)
        .eq("id", hunt.id);
    }
  }

  const existingAddonData = (hunt?.client_addon_data as Record<string, unknown> | null | undefined) ?? null;

  return NextResponse.json({
    hunt: {
      id: hunt.id,
      title: hunt.title,
      species: hunt.species,
      unit: hunt.unit,
      weapon: hunt.weapon === "Bow" ? "Archery" : hunt.weapon,
      hunt_code: effectiveHuntCode || hunt.hunt_code,
      hunt_window_start: hunt.hunt_window_start,
      hunt_window_end: hunt.hunt_window_end,
      window_start: windowStart,
      window_end: windowEnd,
    },
    pricing_plans: matchingPlans,
    addon_items: addonItems,
    client_addon_data: existingAddonData,
  });
}

/**
 * POST: Save client's chosen price plan, add-ons, and hunt dates.
 * Body: { hunt_id, pricing_item_id, client_start_date, client_end_date, extra_days?, extra_non_hunters?, extra_spotters?, rifle_rental? }
 * Auth: session cookie (web) or Authorization: Bearer <jwt> (e.g. iOS).
 */
export async function POST(req: Request) {
  const supabase = await supabaseRoute();
  const userEmail = await getClientEmail(supabase);
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { hunt_id, pricing_item_id, client_start_date, client_end_date, extra_days, extra_non_hunters, extra_spotters, rifle_rental } = body;

  if (!hunt_id || !client_start_date || !client_end_date) {
    return NextResponse.json(
      { error: "hunt_id, client_start_date, and client_end_date are required" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  const { data: hunt, error: huntErr } = await admin
    .from("calendar_events")
    .select("id, client_email, outfitter_id, species, weapon, hunt_window_start, hunt_window_end")
    .eq("id", hunt_id)
    .single();

  if (huntErr || !hunt) {
    return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
  }

  if ((hunt.client_email || "").toLowerCase() !== userEmail) {
    return NextResponse.json({ error: "This hunt is not assigned to you" }, { status: 403 });
  }

  const windowStart = hunt.hunt_window_start
    ? new Date(hunt.hunt_window_start).toISOString().slice(0, 10)
    : null;
  const windowEnd = hunt.hunt_window_end
    ? new Date(hunt.hunt_window_end).toISOString().slice(0, 10)
    : null;

  if (windowStart && windowEnd) {
    if (client_start_date < windowStart || client_end_date > windowEnd) {
      return NextResponse.json(
        { error: `Dates must be within the hunt season (${windowStart} – ${windowEnd})` },
        { status: 400 }
      );
    }
  }

  // Use noon UTC for both so inclusive calendar-day count is correct (Jan 1–Jan 7 = 7 days)
  const startAtNoon = new Date(client_start_date + "T12:00:00Z");
  const endAtNoon = new Date(client_end_date + "T12:00:00Z");
  const days = Math.round((endAtNoon.getTime() - startAtNoon.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days < 1) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const extraDaysNum = Math.max(0, Number(extra_days) || 0);
  const extraNonHuntersNum = Math.max(0, Number(extra_non_hunters) || 0);
  const extraSpottersNum = Math.max(0, Number(extra_spotters) || 0);
  const rifleRentalNum = Math.max(0, Number(rifle_rental) || 0);

  if (pricing_item_id) {
    const { data: pricingItem, error: priceErr } = await admin
      .from("pricing_items")
      .select("id, included_days, outfitter_id")
      .eq("id", pricing_item_id)
      .single();

    if (!priceErr && pricingItem && pricingItem.outfitter_id === hunt.outfitter_id) {
      const baseDays = pricingItem.included_days ?? null;
      const requiredTotalDays = baseDays != null ? baseDays + extraDaysNum : null;
      if (requiredTotalDays != null && days !== requiredTotalDays) {
        return NextResponse.json(
          { error: `Your plan includes ${baseDays} days${extraDaysNum > 0 ? ` plus ${extraDaysNum} extra day(s)` : ""}, for a total of ${requiredTotalDays} days. Please choose dates that span ${requiredTotalDays} days.` },
          { status: 400 }
        );
      }
    }
  }

  const startTimeIso = new Date(client_start_date + "T00:00:00Z").toISOString();
  const endTimeIso = new Date(client_end_date + "T23:59:59Z").toISOString();

  const updatePayload: Record<string, unknown> = {
    start_time: startTimeIso,
    end_time: endTimeIso,
  };
  if (pricing_item_id) {
    updatePayload.selected_pricing_item_id = pricing_item_id;
  }
  const clientAddonData: Record<string, number> = {};
  if (extraDaysNum > 0) clientAddonData.extra_days = extraDaysNum;
  if (extraNonHuntersNum > 0) clientAddonData.extra_non_hunters = extraNonHuntersNum;
  if (extraSpottersNum > 0) clientAddonData.extra_spotters = extraSpottersNum;
  if (rifleRentalNum > 0) clientAddonData.rifle_rental = rifleRentalNum;
  if (Object.keys(clientAddonData).length > 0) {
    updatePayload.client_addon_data = clientAddonData;
  }

  let updateErr: { message?: string } | null = null;
  let updateRes = await admin
    .from("calendar_events")
    .update(updatePayload)
    .eq("id", hunt_id)
    .eq("outfitter_id", hunt.outfitter_id);
  updateErr = updateRes.error as { message?: string } | null;

  if (updateErr) {
    const msg = updateErr?.message ?? String(updateErr);
    if (msg.includes("client_addon_data") || msg.includes("schema cache")) {
      delete updatePayload.client_addon_data;
      const retry = await admin
        .from("calendar_events")
        .update(updatePayload)
        .eq("id", hunt_id)
        .eq("outfitter_id", hunt.outfitter_id);
      updateErr = retry.error as { message?: string } | null;
    }
  }

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Get or create contract
  let contractId: string | null = null;
  let contractError: string | undefined = undefined;

  const { data: existingContract } = await admin
    .from("hunt_contracts")
    .select("id, is_locked")
    .eq("hunt_id", hunt_id)
    .maybeSingle();

  if (!existingContract) {
    // Create contract if it doesn't exist (should have been auto-generated, but just in case)
    const result = await createHuntContractIfNeeded(admin, hunt_id);
    contractId = result.contractId;
    contractError = result.error;
    if (contractError && !contractId) {
      console.warn("[complete-booking] createHuntContractIfNeeded:", contractError);
      return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
    }
  } else {
    contractId = existingContract.id;
    
    // Check if contract is locked
    if (existingContract.is_locked) {
      return NextResponse.json(
        { error: "This contract is locked and cannot be modified. It has been signed or a payment has been made." },
        { status: 403 }
      );
    }
  }

  if (!contractId) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Prepare contract update data
  const contractUpdateData: Record<string, unknown> = {
    client_selected_start_date: client_start_date,
    client_selected_end_date: client_end_date,
  };

  if (pricing_item_id) {
    contractUpdateData.selected_pricing_item_id = pricing_item_id;
  }

  // Store add-ons in client_completion_data
  const clientCompletionData: Record<string, unknown> = {};
  if (pricing_item_id) {
    clientCompletionData.selected_pricing_item_id = pricing_item_id;
  }
  if (extraDaysNum > 0) clientCompletionData.extra_days = extraDaysNum;
  if (extraNonHuntersNum > 0) clientCompletionData.extra_non_hunters = extraNonHuntersNum;
  if (extraSpottersNum > 0) clientCompletionData.extra_spotters = extraSpottersNum;
  if (rifleRentalNum > 0) clientCompletionData.rifle_rental = rifleRentalNum;
  
  if (Object.keys(clientCompletionData).length > 0) {
    contractUpdateData.client_completion_data = clientCompletionData;
  }

  // Update contract with dates and pricing
  const { error: contractUpdateErr } = await admin
    .from("hunt_contracts")
    .update(contractUpdateData)
    .eq("id", contractId);

  if (contractUpdateErr) {
    console.error("[complete-booking] Contract update error:", contractUpdateErr);
    return NextResponse.json({ error: "Failed to update contract" }, { status: 500 });
  }

  // Calculate guide fee based on selected days × pricing item
  const { data: guideFeeResult, error: guideFeeErr } = await admin
    .rpc("calculate_contract_guide_fee", { p_contract_id: contractId });

  if (guideFeeErr) {
    console.warn("[complete-booking] Guide fee calculation error:", guideFeeErr);
    // Continue even if guide fee calculation fails - it will be recalculated later
  }

  // Recalculate contract total (guide fee + add-ons + platform fee)
  // Note: Add-ons calculation will be done in the API layer, then we'll call recalculate
  // For now, we'll calculate add-ons here and update calculated_addons_cents
  let addonsCents = 0;
  if (Object.keys(clientCompletionData).length > 0) {
    // Get add-on pricing items
    const { data: addonItems } = await admin
      .from("pricing_items")
      .select("id, amount_usd, addon_type")
      .eq("outfitter_id", hunt.outfitter_id)
      .eq("category", "Add-ons");

    const addonMap = new Map((addonItems || []).map((item: any) => [item.addon_type, item]));
    
    if (extraDaysNum > 0) {
      const extraDayItem = Array.from(addonMap.values()).find((item: any) => 
        item.addon_type === "extra_days" || (item.addon_type === null && item.title?.toLowerCase().includes("extra day"))
      );
      if (extraDayItem) {
        addonsCents += Math.round((extraDayItem.amount_usd || 0) * 100 * extraDaysNum);
      }
    }
    if (extraNonHuntersNum > 0) {
      const nonHunterItem = Array.from(addonMap.values()).find((item: any) => 
        item.addon_type === "non_hunter" || (item.addon_type === null && item.title?.toLowerCase().includes("non"))
      );
      if (nonHunterItem) {
        addonsCents += Math.round((nonHunterItem.amount_usd || 0) * 100 * extraNonHuntersNum);
      }
    }
    if (extraSpottersNum > 0) {
      const spotterItem = Array.from(addonMap.values()).find((item: any) => 
        item.addon_type === "spotter" || (item.addon_type === null && item.title?.toLowerCase().includes("spotter"))
      );
      if (spotterItem) {
        addonsCents += Math.round((spotterItem.amount_usd || 0) * 100 * extraSpottersNum);
      }
    }
    if (rifleRentalNum > 0) {
      const rifleItem = Array.from(addonMap.values()).find((item: any) => 
        item.addon_type === "rifle_rental" || (item.addon_type === null && item.title?.toLowerCase().includes("rifle"))
      );
      if (rifleItem) {
        addonsCents += Math.round((rifleItem.amount_usd || 0) * 100 * rifleRentalNum);
      }
    }
  }

  // Update calculated_addons_cents
  if (addonsCents > 0) {
    await admin
      .from("hunt_contracts")
      .update({ calculated_addons_cents: addonsCents })
      .eq("id", contractId);
  }

  // Recalculate total
  const { error: totalErr } = await admin
    .rpc("recalculate_contract_total", { p_contract_id: contractId });

  if (totalErr) {
    console.warn("[complete-booking] Total recalculation error:", totalErr);
    // Continue even if total recalculation fails
  }

  return NextResponse.json({
    success: true,
    message: "Your hunt dates and price plan have been saved. Your outfitter will send your contract shortly.",
    contract_created: Boolean(contractId),
    ...(contractError && !contractId ? { contract_error: contractError } : {}),
  });
}
