import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Get contract payment details including payment status, totals, and payment plans
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

    const userEmail = (userRes.user.email || "").toLowerCase().trim();
    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;

    // Get contract with payment info
    // Allow access if user is admin (has outfitter cookie) OR if user is the client
    const { data: contract, error: contractError } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        contract_total_cents,
        amount_paid_cents,
        remaining_balance_cents,
        payment_status,
        client_email,
        outfitter_id
      `)
      .eq("id", id)
      .single();

    if (contractError || !contract) {
      return NextResponse.json(
        { error: contractError?.message || "Contract not found" },
        { status: contractError ? 500 : 404 }
      );
    }

    // Verify access: admin (has outfitter cookie and matches) OR client (email matches)
    const contractEmail = (contract.client_email || "").toLowerCase().trim();
    const isClient = contractEmail === userEmail;
    const isAdmin = outfitterId && contract.outfitter_id === outfitterId;

    if (!isClient && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized - you can only view your own contracts" },
        { status: 403 }
      );
    }

    // Use admin client for queries to avoid RLS issues (both admin and client can access)
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const admin = supabaseAdmin();

    // Get payment items for this contract
    const { data: paymentItems } = await admin
      .from("payment_items")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false });

    // If contract_total_cents is 0 but we have payment items, calculate total from items
    let contractTotalCents = contract.contract_total_cents || 0;
    if (contractTotalCents === 0 && paymentItems && paymentItems.length > 0) {
      contractTotalCents = paymentItems.reduce((sum: number, item: any) => sum + (item.total_cents || 0), 0);
      // Update contract total if it was 0 (only admins can update)
      if (contractTotalCents > 0 && isAdmin) {
        await admin
          .from("hunt_contracts")
          .update({ contract_total_cents: contractTotalCents })
          .eq("id", id);
        // Recalculate payment totals
        await admin.rpc("update_contract_payment_totals", { p_contract_id: id });
        // Refetch contract to get updated values
        const { data: updatedContract } = await admin
          .from("hunt_contracts")
          .select(`
            id,
            contract_total_cents,
            amount_paid_cents,
            remaining_balance_cents,
            payment_status
          `)
          .eq("id", id)
          .single();
        if (updatedContract) {
          contract.contract_total_cents = updatedContract.contract_total_cents;
          contract.amount_paid_cents = updatedContract.amount_paid_cents;
          contract.remaining_balance_cents = updatedContract.remaining_balance_cents;
          contract.payment_status = updatedContract.payment_status;
        }
      }
    }

    // Get active payment plan
    const { data: paymentPlan } = await admin
      .from("contract_payment_plans")
      .select("*")
      .eq("contract_id", id)
      .eq("status", "active")
      .single();

    // Get scheduled payments if plan exists
    let scheduledPayments: any[] = [];
    if (paymentPlan) {
      const { data: scheduled } = await admin
        .from("contract_scheduled_payments")
        .select("*")
        .eq("payment_plan_id", paymentPlan.id)
        .order("payment_number", { ascending: true });
      scheduledPayments = scheduled || [];
    }

    // Get payment transactions
    const paymentItemIds = (paymentItems || []).map((pi: any) => pi.id);
    let transactions: any[] = [];
    if (paymentItemIds.length > 0) {
      const { data: trans } = await admin
        .from("payment_transactions")
        .select("*")
        .in("payment_item_id", paymentItemIds)
        .order("created_at", { ascending: false });
      transactions = trans || [];
    }

    // Use calculated total if contract_total_cents was 0
    const finalContractTotal = contractTotalCents > 0 ? contractTotalCents : contract.contract_total_cents || 0;
    
    return NextResponse.json({
      contract: {
        ...contract,
        contract_total_cents: finalContractTotal,
        contract_total_usd: finalContractTotal / 100,
        amount_paid_usd: contract.amount_paid_cents / 100,
        remaining_balance_usd: contract.remaining_balance_cents / 100,
        payment_percentage: finalContractTotal > 0
          ? Math.round((contract.amount_paid_cents / finalContractTotal) * 100 * 10) / 10
          : 0,
      },
      paymentItems: paymentItems || [],
      paymentPlan: paymentPlan || null,
      scheduledPayments: scheduledPayments.map((sp: any) => ({
        ...sp,
        amount_usd: sp.amount_cents / 100,
        paid_amount_usd: sp.paid_amount_cents / 100,
        is_overdue: sp.due_date && new Date(sp.due_date) < new Date() && sp.status !== "paid",
      })),
      transactions: transactions || [],
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Set contract total amount or update payment info
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
    const { contract_total_cents } = body;

    if (contract_total_cents === undefined) {
      return NextResponse.json(
        { error: "contract_total_cents is required" },
        { status: 400 }
      );
    }

    if (typeof contract_total_cents !== "number" || contract_total_cents < 0) {
      return NextResponse.json(
        { error: "contract_total_cents must be a non-negative number" },
        { status: 400 }
      );
    }

    // Update contract total
    const { data, error } = await supabase
      .from("hunt_contracts")
      .update({ contract_total_cents: Math.round(contract_total_cents) })
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate payment totals
    const { error: updateError } = await supabase.rpc("update_contract_payment_totals", {
      p_contract_id: id,
    });

    if (updateError) {
      console.error("Error updating contract payment totals:", updateError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ contract: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
