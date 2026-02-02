import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import { createOrUpdateCalendarEventFromContract } from "@/lib/calendar-from-contract";

/**
 * GET: Get a specific hunt contract (admin)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data, error } = await supabase
      .from("hunt_contracts")
      .select(`
        *,
        hunt:calendar_events(
          id, title, species, unit, start_time, end_time,
          guide_username, client_email, hunt_type, tag_status, camp_name
        ),
        template:contract_templates(id, name)
      `)
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({ contract: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * PATCH: Update contract status (admin)
 * Used for manual status changes and cancellation
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify admin role
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

    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const validStatuses = [
      "draft", "pending_client_completion", "ready_for_signature",
      "sent_to_docusign", "client_signed", "fully_executed", "cancelled"
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Get contract before update to check if it's becoming fully_executed
    const { data: currentContract } = await supabase
      .from("hunt_contracts")
      .select("id, status, outfitter_id, client_signed_at, admin_signed_at")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    const updateData: any = { status };
    
    // If setting to fully_executed and admin hasn't signed yet, set admin_signed_at
    if (status === "fully_executed" && !currentContract?.admin_signed_at) {
      updateData.admin_signed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("hunt_contracts")
      .update(updateData)
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select("id, status, client_signed_at, admin_signed_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If status is being set to fully_executed, create/update calendar event
    // OR if both signatures are now present (regardless of status)
    const bothSigned = data?.client_signed_at && data?.admin_signed_at;
    const becameFullyExecuted = status === "fully_executed" && currentContract?.status !== "fully_executed";
    
    if (becameFullyExecuted || (bothSigned && !currentContract?.admin_signed_at)) {
      console.log(`📅 Triggering calendar event creation: status=${status}, bothSigned=${bothSigned}`);
      const admin = supabaseAdmin();
      await createOrUpdateCalendarEventFromContract(admin, id, outfitterId);
    }

    return NextResponse.json({ contract: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
