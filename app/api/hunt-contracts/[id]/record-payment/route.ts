import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * POST: Record a payment for a contract (admin can record offline payments)
 */
export async function POST(
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
    const { amount_cents, payment_item_id, scheduled_payment_id, notes } = body;

    if (!amount_cents || typeof amount_cents !== "number" || amount_cents <= 0) {
      return NextResponse.json(
        { error: "amount_cents must be a positive number" },
        { status: 400 }
      );
    }

    // Get contract to find client
    const { data: contract } = await supabase
      .from("hunt_contracts")
      .select("id, client_email, outfitter_id")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("outfitter_id", outfitterId)
      .eq("email", contract.client_email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    let finalPaymentItemId = payment_item_id;

    // Create payment item if not provided
    if (!finalPaymentItemId) {
      const { data: paymentItem, error: itemError } = await supabase
        .from("payment_items")
        .insert({
          outfitter_id: outfitterId,
          client_id: client.id,
          contract_id: id,
          item_type: "hunt_balance",
          description: `Payment for contract ${id.substring(0, 8)}...`,
          subtotal_cents: Math.round(amount_cents),
          platform_fee_cents: 0, // Admin-recorded payments may not have platform fee
          total_cents: Math.round(amount_cents),
          status: "paid",
          amount_paid_cents: Math.round(amount_cents),
          paid_at: new Date().toISOString(),
          notes: notes || "Admin-recorded payment",
        })
        .select()
        .single();

      if (itemError) {
        return NextResponse.json({ error: itemError.message }, { status: 500 });
      }

      finalPaymentItemId = paymentItem.id;
    } else {
      // Update existing payment item
      const { error: updateError } = await supabase
        .from("payment_items")
        .update({
          amount_paid_cents: Math.round(amount_cents),
          status: "paid",
          paid_at: new Date().toISOString(),
          notes: notes || undefined,
        })
        .eq("id", finalPaymentItemId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Update scheduled payment if provided
    if (scheduled_payment_id) {
      const { error: scheduledError } = await supabase
        .from("contract_scheduled_payments")
        .update({
          status: "paid",
          paid_amount_cents: Math.round(amount_cents),
          paid_at: new Date().toISOString(),
          payment_item_id: finalPaymentItemId,
        })
        .eq("id", scheduled_payment_id);

      if (scheduledError) {
        console.error("Error updating scheduled payment:", scheduledError);
        // Don't fail, just log
      }
    }

    // Update contract totals
    const { error: updateError } = await supabase.rpc("update_contract_payment_totals", {
      p_contract_id: id,
    });

    if (updateError) {
      console.error("Error updating contract payment totals:", updateError);
      // Don't fail the request
    }

    // Get updated contract
    const { data: updatedContract } = await supabase
      .from("hunt_contracts")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({
      success: true,
      payment_item_id: finalPaymentItemId,
      contract: updatedContract,
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
