import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe =
  process.env.STRIPE_SECRET_KEY?.trim() ?
    new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// POST /api/payments/webhook - Handle Stripe webhooks
export async function POST(request: NextRequest) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(stripe, supabase, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabase, paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(supabase, charge);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdate(supabase, account);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handlePaymentSuccess(stripeClient: Stripe, supabase: any, paymentIntent: Stripe.PaymentIntent) {
  const paymentItemId = paymentIntent.metadata.payment_item_id;
  if (!paymentItemId) return;

  // Get payment method details
  let paymentMethodType = "card";
  let last4 = "";
  let brand = "";

  if (paymentIntent.payment_method) {
    try {
      const pm = await stripeClient.paymentMethods.retrieve(paymentIntent.payment_method as string);
      paymentMethodType = pm.type;
      if (pm.card) {
        last4 = pm.card.last4;
        brand = pm.card.brand;
      }
    } catch (e) {
      console.error("Could not retrieve payment method:", e);
    }
  }

  // Update transaction record
  await supabase
    .from("payment_transactions")
    .update({
      status: "succeeded",
      stripe_charge_id: paymentIntent.latest_charge,
      payment_method_type: paymentMethodType,
      payment_method_last4: last4,
      payment_method_brand: brand,
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  // Update payment item
  const { data: item } = await supabase
    .from("payment_items")
    .select("total_cents, amount_paid_cents")
    .eq("id", paymentItemId)
    .single();

  if (item) {
    const newAmountPaid = item.amount_paid_cents + paymentIntent.amount;
    const newStatus = newAmountPaid >= item.total_cents ? "paid" : "partially_paid";

    await supabase
      .from("payment_items")
      .update({
        amount_paid_cents: newAmountPaid,
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", paymentItemId);
  }

  console.log(`✅ Payment succeeded: ${paymentIntent.id} for item ${paymentItemId}`);
}

async function handlePaymentFailed(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  const paymentItemId = paymentIntent.metadata.payment_item_id;
  if (!paymentItemId) return;

  // Update transaction record
  await supabase
    .from("payment_transactions")
    .update({
      status: "failed",
      failure_reason: paymentIntent.last_payment_error?.message || "Payment failed",
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  console.log(`❌ Payment failed: ${paymentIntent.id}`);
}

async function handleRefund(supabase: any, charge: Stripe.Charge) {
  if (!charge.refunds?.data?.length) return;

  const refund = charge.refunds.data[0];
  
  // Find the transaction
  const { data: transaction } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .single();

  if (!transaction) return;

  // Calculate refund amounts (proportional)
  const refundRatio = refund.amount / transaction.amount_cents;
  const platformFeeRefund = Math.round(transaction.platform_fee_cents * refundRatio);
  const outfitterRefund = refund.amount - platformFeeRefund;

  // Create refund record
  await supabase.from("payment_refunds").insert({
    transaction_id: transaction.id,
    stripe_refund_id: refund.id,
    amount_cents: refund.amount,
    platform_fee_refund_cents: platformFeeRefund,
    outfitter_refund_cents: outfitterRefund,
    status: refund.status,
    reason: refund.reason,
    completed_at: new Date().toISOString(),
  });

  // Update transaction status if fully refunded
  if (charge.refunded) {
    await supabase
      .from("payment_transactions")
      .update({ status: "refunded" })
      .eq("id", transaction.id);
  }

  console.log(`🔄 Refund processed: ${refund.id}`);
}

async function handleAccountUpdate(supabase: any, account: Stripe.Account) {
  // Update the outfitter's Stripe account status
  await supabase
    .from("outfitter_stripe_accounts")
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      stripe_account_status: account.charges_enabled ? "active" : "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);

  console.log(`📝 Account updated: ${account.id}`);
}
