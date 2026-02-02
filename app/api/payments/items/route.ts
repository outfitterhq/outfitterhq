import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

// GET /api/payments/items - Get payment items for current user
export async function GET(request: NextRequest) {
  const supabase = await supabaseRoute();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin (get outfitter items) or client (get own items)
  const { data: membership } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  let query = supabase
    .from("payment_items")
    .select(`
      *,
      clients(id, email, full_name),
      calendar_events(id, title, start_time, species)
    `)
    .order("created_at", { ascending: false });

  if (membership) {
    // Admin: get all items for outfitter
    query = query.eq("outfitter_id", membership.outfitter_id);
  } else {
    // Client: get own items
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .ilike("email", user.email || "")
      .single();

    if (!client) {
      return NextResponse.json({ items: [] });
    }
    query = query.eq("client_id", client.id);
  }

  const { data: items, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items, isAdmin: !!membership });
}

// POST /api/payments/items - Create a new payment item (admin only)
export async function POST(request: NextRequest) {
  const supabase = await supabaseRoute();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Must be admin
  const { data: membership } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const {
    client_id,
    item_type,
    description,
    subtotal_dollars,  // Accept dollars for easier input
    hunt_id,
    contract_id,
    due_date,
  } = body;

  if (!client_id || !item_type || !description || !subtotal_dollars) {
    return NextResponse.json(
      { error: "client_id, item_type, description, and subtotal_dollars are required" },
      { status: 400 }
    );
  }

  // Convert to cents
  const subtotalCents = Math.round(subtotal_dollars * 100);

  // Get platform fee config
  const { data: feeConfig } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "platform_fee_percentage")
    .single();

  const feePercentage = feeConfig ? parseFloat(feeConfig.value) : 5.0;
  const platformFeeCents = Math.ceil(subtotalCents * (feePercentage / 100));
  const minFee = 50; // $0.50 minimum
  const finalPlatformFee = Math.max(platformFeeCents, minFee);

  // Create payment item
  const { data: item, error } = await supabase
    .from("payment_items")
    .insert({
      outfitter_id: membership.outfitter_id,
      client_id,
      item_type,
      description,
      subtotal_cents: subtotalCents,
      platform_fee_cents: finalPlatformFee,
      total_cents: subtotalCents + finalPlatformFee,
      hunt_id: hunt_id || null,
      contract_id: contract_id || null,
      due_date: due_date || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    item,
    breakdown: {
      subtotal: subtotalCents / 100,
      platformFee: finalPlatformFee / 100,
      total: (subtotalCents + finalPlatformFee) / 100,
      feePercentage,
    },
  });
}
