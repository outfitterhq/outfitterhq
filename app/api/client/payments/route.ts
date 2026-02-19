import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  // Get client record
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter
  const { data: links } = await supabase
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .limit(1);

  if (!links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  const outfitterId = links[0].outfitter_id;

  // Get payments for this client
  const { data: payments, error: paymentsError } = await supabase
    .from("client_payments")
    .select(`
      id,
      payment_plan,
      total_amount,
      label,
      amount,
      due_date,
      is_paid,
      paid_at,
      hunt_id,
      calendar_events:hunt_id(title, start_time)
    `)
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .order("due_date", { ascending: true });

  if (paymentsError) {
    console.error("Payments error:", paymentsError);
    // Don't fail - table might not exist yet
  }

  // Calculate totals
  const paymentList = payments || [];
  const totalAmount = paymentList.length > 0 ? paymentList[0].total_amount || 0 : 0;
  const amountPaid = paymentList.reduce(
    (sum, p) => sum + (p.is_paid ? (p.amount || 0) : 0),
    0
  );
  const paymentPlan = paymentList.length > 0 ? paymentList[0].payment_plan || "two" : "two";

  // Get hunt info if available
  const huntInfo = paymentList.find((p) => (p as any).calendar_events);
  const hunt = huntInfo
    ? {
        title: (huntInfo as any).calendar_events?.title,
        start_date: (huntInfo as any).calendar_events?.start_time,
      }
    : null;

  const balanceDue = totalAmount - amountPaid;
  let pay_online_url: string | null = null;
  if (balanceDue > 0) {
    const { data: firstUnpaid } = await supabase
      .from("payment_items")
      .select("id, contract_id")
      .eq("client_id", client.id)
      .in("status", ["pending", "partially_paid"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const item = firstUnpaid as { id: string; contract_id: string | null } | null;
    if (item) {
      pay_online_url = item.contract_id
        ? `/client/pay?contract_id=${encodeURIComponent(item.contract_id)}`
        : `/client/pay?item_id=${encodeURIComponent(item.id)}`;
    }
  }

  return NextResponse.json({
    total_amount: totalAmount,
    amount_paid: amountPaid,
    balance_due: balanceDue,
    payment_plan: paymentPlan,
    payments: paymentList.map((p) => ({
      label: p.label,
      amount: p.amount || 0,
      due_date: p.due_date,
      is_paid: p.is_paid,
      paid_at: p.paid_at,
    })),
    hunt,
    pay_online_url: pay_online_url ?? undefined,
  });
}
