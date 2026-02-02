import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import { createOrUpdateCalendarEventFromContract } from "@/lib/calendar-from-contract";

/**
 * POST: Debug endpoint to manually trigger calendar event creation for a contract
 * Body: { contract_id: string }
 */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdmin();
    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const body = await req.json();
    const { contract_id } = body;

    if (!contract_id) {
      return NextResponse.json({ error: "contract_id is required" }, { status: 400 });
    }

    console.log(`🔧 DEBUG: Manually creating calendar event for contract ${contract_id}`);

    // Call the calendar event creation function
    await createOrUpdateCalendarEventFromContract(admin, contract_id, outfitterId);

    // Check if event was created
    const { data: contract } = await admin
      .from("hunt_contracts")
      .select("hunt_id, client_email, status, client_signed_at, admin_signed_at")
      .eq("id", contract_id)
      .single();

    let eventData = null;
    if (contract?.hunt_id) {
      const { data: event } = await admin
        .from("calendar_events")
        .select("*")
        .eq("id", contract.hunt_id)
        .single();
      eventData = event;
    }

    return NextResponse.json({
      success: true,
      contract: {
        id: contract_id,
        hunt_id: contract?.hunt_id,
        status: contract?.status,
        client_signed_at: contract?.client_signed_at,
        admin_signed_at: contract?.admin_signed_at,
      },
      calendar_event: eventData,
      message: eventData ? "Calendar event found" : "No calendar event created yet",
    });
  } catch (e: any) {
    console.error("Debug calendar event creation error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
