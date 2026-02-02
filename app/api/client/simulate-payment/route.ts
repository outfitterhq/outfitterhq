import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";

async function getClientEmail(supabase: Awaited<ReturnType<typeof supabaseRoute>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) return (user.email as string).toLowerCase().trim();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.email) return (session.user.email as string).toLowerCase().trim();
  const h = await headers();
  const auth = h.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token);
    if (!error && tokenUser?.email) return (tokenUser.email as string).toLowerCase().trim();
  }
  return null;
}

/**
 * POST: Simulate payment for a payment item (testing only).
 * Marks the item as paid without charging a card.
 * Allowed only when NODE_ENV=development or NEXT_PUBLIC_ALLOW_SIMULATE_PAYMENT=true.
 */
export async function POST(req: NextRequest) {
  const allowSimulate =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ALLOW_SIMULATE_PAYMENT === "true";
  if (!allowSimulate) {
    return NextResponse.json(
      { error: "Simulate payment is only available in development or when NEXT_PUBLIC_ALLOW_SIMULATE_PAYMENT is set." },
      { status: 403 }
    );
  }

  const supabase = await supabaseRoute();
  const userEmail = await getClientEmail(supabase);
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const paymentItemId = body.payment_item_id ?? body.item_id;
  if (!paymentItemId) {
    return NextResponse.json({ error: "payment_item_id is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .ilike("email", userEmail)
    .limit(1)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: item, error: fetchErr } = await admin
    .from("payment_items")
    .select("id, total_cents, amount_paid_cents, status, client_id")
    .eq("id", paymentItemId)
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ error: "Payment item not found" }, { status: 404 });
  }
  if (item.client_id !== client.id) {
    return NextResponse.json({ error: "Not authorized for this payment item" }, { status: 403 });
  }
  if (item.status === "paid" && (item.amount_paid_cents ?? 0) >= item.total_cents) {
    return NextResponse.json({ message: "Already paid", already_paid: true }, { status: 200 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("payment_items")
    .update({
      amount_paid_cents: item.total_cents,
      status: "paid",
      paid_at: now,
      updated_at: now,
    })
    .eq("id", paymentItemId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message || "Failed to simulate payment" }, { status: 500 });
  }

  return NextResponse.json({
    message: "Payment simulated successfully. Item marked as paid.",
    payment_item_id: paymentItemId,
    status: "paid",
  });
}
