import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export type PendingActionType = "assign_to_calendar" | "generate_contract" | "send_docusign" | "admin_sign";

export interface PendingActionItem {
  hunt_id: string;
  contract_id?: string;
  action: PendingActionType;
  title: string;
  start_time: string | null;
  client_email: string | null;
}

/**
 * GET: Pending actions for admin (calendar workflow)
 * Returns counts and list of hunts that need: contract generated, send to DocuSign, or admin signature.
 */
export async function GET() {
  try {
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

    const items: PendingActionItem[] = [];
    const now = new Date().toISOString();

    // 1) Contracts without calendar events - need to assign to calendar
    // Show ALL contracts that don't have a calendar event, regardless of status
    const { data: contractsNoHunt } = await supabase
      .from("hunt_contracts")
      .select("id, client_email, status, created_at, client_completion_data")
      .eq("outfitter_id", outfitterId)
      .is("hunt_id", null) // Contracts without calendar events
      .order("created_at", { ascending: true }); // Show oldest first

    for (const contract of contractsNoHunt ?? []) {
      const completionData = (contract.client_completion_data as any) || {};
      const title = completionData.species 
        ? `${completionData.species} Hunt`
        : "Hunt Contract";
      items.push({
        hunt_id: "", // No hunt_id yet
        contract_id: contract.id,
        action: "assign_to_calendar" as any, // New action type
        title: title,
        start_time: completionData.client_start_date 
          ? new Date(completionData.client_start_date + "T00:00:00Z").toISOString()
          : null,
        client_email: contract.client_email,
      });
    }

    // 2) Needs contract: hunts with client, tag drawn/confirmed, no contract yet
    const { data: huntsNoContract } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, client_email")
      .eq("outfitter_id", outfitterId)
      .not("client_email", "is", null)
      .in("tag_status", ["drawn", "confirmed"])
      .gte("end_time", now) // future or current hunts only
      .order("start_time", { ascending: true });

    const huntIds = (huntsNoContract ?? []).map((h) => h.id);
    let contractByHuntId: Map<string, { id: string; status: string }> = new Map();
    if (huntIds.length > 0) {
      const { data: contracts } = await supabase
        .from("hunt_contracts")
        .select("id, hunt_id, status")
        .eq("outfitter_id", outfitterId)
        .in("hunt_id", huntIds);
      (contracts ?? []).forEach((c) => contractByHuntId.set(c.hunt_id, { id: c.id, status: c.status }));
    }

    for (const h of huntsNoContract ?? []) {
      if (!contractByHuntId.has(h.id)) {
        items.push({
          hunt_id: h.id,
          action: "generate_contract",
          title: h.title ?? "Hunt",
          start_time: h.start_time ?? null,
          client_email: h.client_email ?? null,
        });
      }
    }

    // 2) Ready for DocuSign + 3) Needs admin sign
    const { data: contractsActionable } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        hunt_id,
        status,
        hunt:calendar_events(id, title, start_time, client_email)
      `)
      .eq("outfitter_id", outfitterId)
      .in("status", ["ready_for_signature", "client_signed"])
      .order("created_at", { ascending: true });

    for (const c of contractsActionable ?? []) {
      const hunt = (c as any).hunt;
      const huntId = c.hunt_id;
      const title = hunt?.title ?? "Hunt";
      const startTime = hunt?.start_time ?? null;
      const clientEmail = hunt?.client_email ?? null;
      if (c.status === "ready_for_signature") {
        items.push({
          hunt_id: huntId,
          contract_id: c.id,
          action: "send_docusign",
          title,
          start_time: startTime,
          client_email: clientEmail,
        });
      } else if (c.status === "client_signed") {
        items.push({
          hunt_id: huntId,
          contract_id: c.id,
          action: "admin_sign",
          title,
          start_time: startTime,
          client_email: clientEmail,
        });
      }
    }

    const counts = {
      assign_to_calendar: items.filter((i) => i.action === "assign_to_calendar").length,
      generate_contract: items.filter((i) => i.action === "generate_contract").length,
      send_docusign: items.filter((i) => i.action === "send_docusign").length,
      admin_sign: items.filter((i) => i.action === "admin_sign").length,
    };
    const total = items.length;

    return NextResponse.json({
      total,
      counts,
      items,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
