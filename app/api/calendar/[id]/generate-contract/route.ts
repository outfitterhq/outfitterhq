import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import { matchPricingForHunt, huntDaysFromRange } from "@/lib/pricing-match";
import type { PricingItem } from "@/lib/types/pricing";

/**
 * POST: Admin generates hunt contract for a private land calendar event.
 * Used when client has purchased a tag; admin sets hunt code and dates, then generates the contract.
 * Body: { hunt_code?: string, start_time?: string (ISO), end_time?: string (ISO) }
 * If a contract already exists, updates its content with current hunt data (dates, guide fee, hunt code).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: huntId } = await params;
    const supabase = await supabaseRoute();

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("outfitter_id", outfitterId)
      .eq("user_id", userRes.user.id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const baseHuntSelect = "id, title, client_email, species, unit, weapon, camp_name, hunt_type, hunt_code, start_time, end_time, hunt_window_start, hunt_window_end, selected_pricing_item_id";
    let huntRes = await supabase
      .from("calendar_events")
      .select(`${baseHuntSelect}, client_addon_data`)
      .eq("id", huntId)
      .eq("outfitter_id", outfitterId)
      .single();
    if (huntRes.error) {
      const errMsg = huntRes.error?.message ?? String(huntRes.error);
      if (errMsg.includes("client_addon_data") || errMsg.includes("schema cache")) {
        huntRes = await supabase
          .from("calendar_events")
          .select(baseHuntSelect)
          .eq("id", huntId)
          .eq("outfitter_id", outfitterId)
          .single();
      }
    }
    const hunt = huntRes.data;
    const huntErr = huntRes.error;

    if (huntErr || !hunt) {
      return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
    }

    if (hunt.hunt_type !== "private_land") {
      return NextResponse.json(
        { error: "Generate contract is only for private land hunts. Draw hunts get contracts when tag status is set to Drawn." },
        { status: 400 }
      );
    }

    if (!hunt.client_email) {
      return NextResponse.json(
        { error: "Assign a client to this hunt before generating the contract." },
        { status: 400 }
      );
    }

    let body: { hunt_code?: string; start_time?: string; end_time?: string } = {};
    try {
      body = await req.json();
    } catch {
      // optional body
    }

    const { data: existingContract } = await supabase
      .from("hunt_contracts")
      .select("id, status")
      .eq("hunt_id", huntId)
      .single();

    // When a contract already exists, we update its content with current hunt data (refresh)
    const isRegenerate = Boolean(existingContract);

    const admin = supabaseAdmin();

    const huntCode = body.hunt_code ?? hunt.hunt_code ?? null;
    const startTime = body.start_time ?? hunt.start_time ?? null;
    const endTime = body.end_time ?? hunt.end_time ?? null;

    const eventUpdate: Record<string, unknown> = {};
    if (huntCode !== null) eventUpdate.hunt_code = huntCode;
    if (startTime !== null) eventUpdate.start_time = startTime;
    if (endTime !== null) eventUpdate.end_time = endTime;

    if (huntCode) {
      const { getHuntCodeByCode } = await import("@/lib/hunt-codes-server");
      const codeRow = getHuntCodeByCode(huntCode);
      if (codeRow?.start_date && codeRow?.end_date) {
        eventUpdate.hunt_window_start = new Date(codeRow.start_date + "T00:00:00Z").toISOString();
        eventUpdate.hunt_window_end = new Date(codeRow.end_date + "T23:59:59Z").toISOString();
      }
      const parts = huntCode.trim().split("-");
      if (parts.length >= 2 && parts[1] && !hunt.weapon) {
        const { weaponDigitToTagType } = await import("@/lib/hunt-codes");
        const w = weaponDigitToTagType(parts[1]);
        eventUpdate.weapon = w === "Archery" ? "Bow" : w;
      }
    }

    if (Object.keys(eventUpdate).length > 0) {
      await admin
        .from("calendar_events")
        .update(eventUpdate)
        .eq("id", huntId)
        .eq("outfitter_id", outfitterId);
    }

    const { data: clientRow } = await admin
      .from("clients")
      .select("id, first_name, last_name")
      .eq("email", hunt.client_email)
      .single();

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
    const startDate = startTime ? new Date(startTime).toISOString().slice(0, 10) : "TBD";
    const endDate = endTime ? new Date(endTime).toISOString().slice(0, 10) : "TBD";

    const huntDays = huntDaysFromRange(startTime, endTime);
    const { data: pricingRows } = await admin
      .from("pricing_items")
      .select("id, title, description, amount_usd, category, included_days, species, weapons")
      .eq("outfitter_id", outfitterId);
    const pricingItems = (pricingRows ?? []) as PricingItem[];
    // Use client's selected plan from complete-booking when set; otherwise match by species/weapon/days
    let billPricing: PricingItem[] = [];
    const selectedId = (hunt as { selected_pricing_item_id?: string | null }).selected_pricing_item_id;
    if (selectedId) {
      const selected = pricingItems.find((p) => p.id === selectedId);
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

    let content: string;
    if (template?.content) {
      content = template.content
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
      content =
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

    if (billPricing.length > 0) {
      const billLines = ["\n---\n\nBILL", ""];
      let total = 0;
      for (const p of billPricing) {
        billLines.push(`${p.title}: $${Number(p.amount_usd).toFixed(2)}`);
        total += Number(p.amount_usd);
      }
      billLines.push("");
      billLines.push(`Total: $${total.toFixed(2)}`);
      content = content + billLines.join("\n");
    }

    if (isRegenerate && existingContract) {
      const huntWithAddon = hunt as { client_addon_data?: Record<string, unknown> | null; selected_pricing_item_id?: string | null };
      const regenCompletionData: Record<string, unknown> = {};
      if (huntWithAddon.selected_pricing_item_id) regenCompletionData.selected_pricing_item_id = huntWithAddon.selected_pricing_item_id;
      if (huntWithAddon.client_addon_data && typeof huntWithAddon.client_addon_data === "object") {
        Object.assign(regenCompletionData, huntWithAddon.client_addon_data);
      }
      const { error: updateErr } = await admin
        .from("hunt_contracts")
        .update({
          content,
          client_name: clientName,
          updated_at: new Date().toISOString(),
          ...(Object.keys(regenCompletionData).length > 0 ? { client_completion_data: regenCompletionData } : {}),
        })
        .eq("id", existingContract.id)
        .eq("outfitter_id", outfitterId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        contract: { id: existingContract.id, status: existingContract.status },
        message: "Contract updated with current hunt data (dates, hunt code, guide fee). Client will see the refreshed contract.",
      });
    }

    const huntWithAddon = hunt as { client_addon_data?: Record<string, unknown> | null; selected_pricing_item_id?: string | null };
    const clientCompletionData: Record<string, unknown> = {};
    if (huntWithAddon.selected_pricing_item_id) {
      clientCompletionData.selected_pricing_item_id = huntWithAddon.selected_pricing_item_id;
    }
    if (huntWithAddon.client_addon_data && typeof huntWithAddon.client_addon_data === "object") {
      Object.assign(clientCompletionData, huntWithAddon.client_addon_data);
    }

    const { data: contract, error: contractErr } = await admin
      .from("hunt_contracts")
      .insert({
        outfitter_id: outfitterId,
        hunt_id: huntId,
        client_email: hunt.client_email,
        client_name: clientName,
        content,
        status: "pending_client_completion",
        template_id: template?.id ?? null,
        ...(Object.keys(clientCompletionData).length > 0 ? { client_completion_data: clientCompletionData } : {}),
      })
      .select("id, status")
      .single();

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 });
    }

    await admin
      .from("calendar_events")
      .update({ contract_generated_at: new Date().toISOString() })
      .eq("id", huntId)
      .eq("outfitter_id", outfitterId);

    return NextResponse.json({
      success: true,
      contract: { id: contract.id, status: contract.status },
      message: "Hunt contract generated. Client can complete and sign it from their Documents page.",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
