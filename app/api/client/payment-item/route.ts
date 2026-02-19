import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";

async function getClientEmail(supabase: Awaited<ReturnType<typeof supabaseRoute>>): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.email) return (session.user.email || "").toLowerCase();
  const h = await headers();
  const auth = h.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user?.email) return (user.email || "").toLowerCase();
  }
  return null;
}

/**
 * GET: Get a single payment item for the current client (by item_id or contract_id).
 * When contract_id is provided, returns the first unpaid payment item for that contract.
 * Used so the client pay page can show amount and description before paying.
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseRoute();
  const userEmail = await getClientEmail(supabase);
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("item_id");
  const contractId = searchParams.get("contract_id");
  if (!itemId && !contractId) {
    return NextResponse.json({ error: "item_id or contract_id is required" }, { status: 400 });
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

  type PaymentItemRow = {
    id: string;
    description: string;
    total_cents: number;
    amount_paid_cents: number | null;
    status: string;
  };

  let item: PaymentItemRow | null = null;
  let err: unknown = null;

  if (itemId) {
    const res = await admin
      .from("payment_items")
      .select("id, description, total_cents, amount_paid_cents, status")
      .eq("id", itemId)
      .eq("client_id", client.id)
      .single();
    item = res.data as PaymentItemRow | null;
    err = res.error;
  } else if (contractId) {
    const res = await admin
      .from("payment_items")
      .select("id, description, total_cents, amount_paid_cents, status")
      .eq("contract_id", contractId)
      .eq("client_id", client.id)
      .neq("status", "paid")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    item = res.data as PaymentItemRow | null;
    err = res.error;
    if (!item && !err) {
      const { data: paid } = await admin
        .from("payment_items")
        .select("id")
        .eq("contract_id", contractId)
        .eq("client_id", client.id)
        .limit(1)
        .maybeSingle();
      if (paid) {
        return NextResponse.json({ error: "This contract is already paid in full" }, { status: 400 });
      }
      return NextResponse.json({ error: "No payment due for this contract yet" }, { status: 404 });
    }
  }

  if (err || !item) {
    return NextResponse.json({ error: "Payment item not found" }, { status: 404 });
  }

  const paymentItem: PaymentItemRow = item;
  const balanceCents = paymentItem.total_cents - (paymentItem.amount_paid_cents ?? 0);
  return NextResponse.json({
    id: paymentItem.id,
    description: paymentItem.description,
    total_cents: paymentItem.total_cents,
    amount_paid_cents: paymentItem.amount_paid_cents ?? 0,
    balance_due_cents: balanceCents,
    status: paymentItem.status,
  });
}
