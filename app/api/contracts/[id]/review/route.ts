import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * PUT: Admin reviews a contract (approve/reject)
 * Body: { action: 'approve' | 'reject', notes?: string }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify admin access
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, notes } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get the contract
    const { data: contract, error: contractErr } = await supabase
      .from("hunt_contracts")
      .select("id, status, outfitter_id")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.status !== "pending_admin_review") {
      return NextResponse.json(
        { error: `Contract is not pending review. Current status: ${contract.status}` },
        { status: 400 }
      );
    }

    // Update contract based on action
    const newStatus = action === "approve" ? "ready_for_signature" : "pending_client_completion";
    const updateData: any = {
      status: newStatus,
      admin_reviewed_at: new Date().toISOString(),
      admin_reviewed_by: userRes.user.email || "Admin",
    };

    if (notes) {
      updateData.admin_review_notes = notes;
    }

    // If rejecting, reset client completion so they can resubmit
    if (action === "reject") {
      updateData.client_completed_at = null;
      updateData.client_completion_data = null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("hunt_contracts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contract: updated,
      message: action === "approve" 
        ? "Contract approved and moved to ready for signature."
        : "Contract rejected. Client can resubmit.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
