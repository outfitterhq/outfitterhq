import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * POST: Create a payment plan for a contract
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
    const { plan_name, total_amount_cents, payments } = body;

    if (!total_amount_cents || !payments || !Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: "total_amount_cents and payments array are required" },
        { status: 400 }
      );
    }

    // Validate payments array
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      if (!payment.payment_number || !payment.amount_cents || !payment.due_date) {
        return NextResponse.json(
          { error: `Payment ${i + 1} is missing required fields (payment_number, amount_cents, due_date)` },
          { status: 400 }
        );
      }
    }

    // Create payment plan using RPC function
    // Note: p_payments should be JSONB, so we pass the array directly
    const { data: planId, error: planError } = await supabase.rpc(
      "create_contract_payment_plan",
      {
        p_contract_id: id,
        p_total_amount_cents: Math.round(total_amount_cents),
        p_payments: payments.map((p: any) => ({
          payment_number: p.payment_number,
          amount_cents: Math.round(p.amount_cents),
          due_date: p.due_date,
        })),
        p_plan_name: plan_name || null,
      }
    );

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    // Get the created plan with scheduled payments
    const { data: plan } = await supabase
      .from("contract_payment_plans")
      .select(`
        *,
        scheduled_payments:contract_scheduled_payments(*)
      `)
      .eq("id", planId)
      .single();

    return NextResponse.json({ paymentPlan: plan }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * GET: Get payment plan for a contract
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

    // Get active payment plan
    const { data: plan } = await supabase
      .from("contract_payment_plans")
      .select(`
        *,
        scheduled_payments:contract_scheduled_payments(*)
      `)
      .eq("contract_id", id)
      .eq("status", "active")
      .single();

    if (!plan) {
      return NextResponse.json({ paymentPlan: null }, { status: 200 });
    }

    return NextResponse.json({ paymentPlan: plan }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
