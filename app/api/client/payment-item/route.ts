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
 * GET: Get a single payment item for the current client (by item_id).
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
  if (!itemId) {
    return NextResponse.json({ error: "item_id is required" }, { status: 400 });
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

  const { data: item, error } = await admin
    .from("payment_items")
    .select("id, description, total_cents, amount_paid_cents, status")
    .eq("id", itemId)
    .eq("client_id", client.id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Payment item not found" }, { status: 404 });
  }

  const balanceCents = item.total_cents - (item.amount_paid_cents || 0);
  return NextResponse.json({
    id: item.id,
    description: item.description,
    total_cents: item.total_cents,
    amount_paid_cents: item.amount_paid_cents || 0,
    balance_due_cents: balanceCents,
    status: item.status,
  });
}
