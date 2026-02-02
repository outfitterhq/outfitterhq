import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";
import Stripe from "stripe";

// Check if Stripe is configured
const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
const stripe = stripeConfigured 
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-12-15.clover" })
  : null;

// GET /api/payments/connect - Get Stripe Connect status for outfitter
export async function GET(request: NextRequest) {
  // Check if Stripe is configured
  if (!stripe) {
    return NextResponse.json({
      connected: false,
      notConfigured: true,
      message: "Stripe is not configured. Add STRIPE_SECRET_KEY to enable payments.",
    });
  }

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

  // Get existing Stripe account
  const { data: stripeAccount } = await supabase
    .from("outfitter_stripe_accounts")
    .select("*")
    .eq("outfitter_id", membership.outfitter_id)
    .single();

  if (!stripeAccount) {
    return NextResponse.json({
      connected: false,
      needsOnboarding: true,
    });
  }

  // Get latest status from Stripe
  try {
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
    
    return NextResponse.json({
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      needsOnboarding: !account.details_submitted,
      accountId: account.id,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: "Could not retrieve Stripe account status",
    });
  }
}

// POST /api/payments/connect - Create or get onboarding link
export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 });
  }

  const supabase = await supabaseRoute();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Must be owner
  const { data: membership } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only owners can set up payments" }, { status: 403 });
  }

  // Get outfitter info
  const { data: outfitter } = await supabase
    .from("outfitters")
    .select("id, name, contact_email")
    .eq("id", membership.outfitter_id)
    .single();

  if (!outfitter) {
    return NextResponse.json({ error: "Outfitter not found" }, { status: 404 });
  }

  // Check for existing account
  let { data: existingAccount } = await supabase
    .from("outfitter_stripe_accounts")
    .select("stripe_account_id")
    .eq("outfitter_id", membership.outfitter_id)
    .single();

  let accountId: string;

  if (existingAccount?.stripe_account_id) {
    accountId = existingAccount.stripe_account_id;
  } else {
    // Create new Stripe Connect account
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: outfitter.contact_email || user.email || undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: outfitter.name,
        product_description: "Hunting guide and outfitter services",
        mcc: "7941", // Sports clubs/fields
      },
      metadata: {
        outfitter_id: outfitter.id,
      },
    });

    accountId = account.id;

    // Save to database
    await supabase.from("outfitter_stripe_accounts").insert({
      outfitter_id: outfitter.id,
      stripe_account_id: account.id,
      stripe_account_status: "pending",
    });
  }

  // Create onboarding link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/settings/payments?refresh=true`,
    return_url: `${baseUrl}/settings/payments?success=true`,
    type: "account_onboarding",
  });

  return NextResponse.json({
    onboardingUrl: accountLink.url,
  });
}
