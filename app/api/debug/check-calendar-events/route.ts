import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Debug endpoint to check if calendar events exist for contracts
 * Query params: ?contract_id=UUID (optional)
 */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdmin();
    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contract_id");

    // Get all fully executed contracts
    const { data: contracts, error: contractError } = await admin
      .from("hunt_contracts")
      .select("id, hunt_id, client_email, status, client_signed_at, admin_signed_at, created_at")
      .eq("outfitter_id", outfitterId)
      .eq("status", "fully_executed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }

    // Get calendar events
    const { data: events, error: eventsError } = await admin
      .from("calendar_events")
      .select("id, title, client_email, status, audience, start_time, end_time, guide_username, outfitter_id")
      .eq("outfitter_id", outfitterId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    // Match contracts to events
    const contractEventMap = contracts?.map((contract) => {
      const event = events?.find((e) => e.id === contract.hunt_id);
      return {
        contract_id: contract.id,
        contract_status: contract.status,
        client_email: contract.client_email,
        hunt_id: contract.hunt_id,
        has_event: !!event,
        event: event ? {
          id: event.id,
          title: event.title,
          status: event.status,
          audience: event.audience,
          guide_username: event.guide_username,
          start_time: event.start_time,
        } : null,
        both_signed: !!(contract.client_signed_at && contract.admin_signed_at),
      };
    });

    return NextResponse.json({
      outfitter_id: outfitterId,
      total_contracts: contracts?.length || 0,
      total_events: events?.length || 0,
      contracts_with_events: contractEventMap?.filter((c) => c.has_event).length || 0,
      contracts_without_events: contractEventMap?.filter((c) => !c.has_event).length || 0,
      contracts: contractEventMap,
      all_events: events,
    });
  } catch (e: any) {
    console.error("Debug calendar events error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
