import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe =
  process.env.STRIPE_SECRET_KEY?.trim() ?
    new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;

// POST /api/payments/create-intent - Create a payment intent for a payment item
export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }
  const supabase = await supabaseRoute();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { payment_item_id } = body;

  if (!payment_item_id) {
    return NextResponse.json({ error: "payment_item_id is required" }, { status: 400 });
  }

  // Get the payment item
  const { data: paymentItem, error: itemError } = await supabase
    .from("payment_items")
    .select(`
      *,
      clients!inner(id, email, full_name),
      outfitters!inner(id, name)
    `)
    .eq("id", payment_item_id)
    .single();

  if (itemError || !paymentItem) {
    return NextResponse.json({ error: "Payment item not found" }, { status: 404 });
  }

  // Verify the user owns this payment item
  const clientEmail = (paymentItem.clients as any)?.email?.toLowerCase();
  if (clientEmail !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Not authorized for this payment" }, { status: 403 });
  }

  // Check if already paid
  if (paymentItem.status === "paid") {
    return NextResponse.json({ error: "This item is already paid" }, { status: 400 });
  }

  // Get the outfitter's Stripe Connect account
  const { data: stripeAccount } = await supabase
    .from("outfitter_stripe_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("outfitter_id", paymentItem.outfitter_id)
    .single();

  if (!stripeAccount?.stripe_account_id || !stripeAccount.charges_enabled) {
    return NextResponse.json(
      { error: "This outfitter is not set up to accept payments yet" },
      { status: 400 }
    );
  }

  try {
    // Calculate amounts
    const amountToCharge = paymentItem.total_cents - paymentItem.amount_paid_cents;
    const platformFee = paymentItem.platform_fee_cents;

    // Create payment intent with application fee (our 5%)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountToCharge,
      currency: "usd",
      // Transfer to the outfitter's connected account, minus our fee
      application_fee_amount: platformFee,
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata: {
        payment_item_id: paymentItem.id,
        outfitter_id: paymentItem.outfitter_id,
        client_id: paymentItem.client_id,
        item_type: paymentItem.item_type,
      },
      description: `${(paymentItem.outfitters as any)?.name} - ${paymentItem.description}`,
      receipt_email: clientEmail,
    });

    // Create a transaction record (pending)
    await supabase.from("payment_transactions").insert({
      payment_item_id: paymentItem.id,
      outfitter_id: paymentItem.outfitter_id,
      client_id: paymentItem.client_id,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: amountToCharge,
      platform_fee_cents: platformFee,
      outfitter_amount_cents: amountToCharge - platformFee,
      status: "pending",
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: amountToCharge,
      platformFee: platformFee,
      outfitterAmount: amountToCharge - platformFee,
    });
  } catch (error: any) {
    console.error("Stripe error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}
