import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { recalculateGuideFeePaymentItem } from "@/lib/guide-fee-bill-server";

async function getAuthUserEmail(supabase: Awaited<ReturnType<typeof supabaseRoute>>): Promise<string | null> {
  // Use getUser() instead of getSession() for security (validates with Supabase Auth server)
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!error && user?.email) return user.email;
  
  // Fallback to Bearer token for API requests
  const h = await headers();
  const auth = h.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const { data: { user: tokenUser }, error: userErr } = await supabase.auth.getUser(token);
    if (!userErr && tokenUser?.email) return tokenUser.email;
  }
  return null;
}

export async function GET() {
  const supabase = await supabaseRoute();
  const userEmail = await getAuthUserEmail(supabase);
  
  console.log("[Client Dashboard API] User email:", userEmail || "NOT_FOUND");
  
  if (!userEmail) {
    console.log("[Client Dashboard API] ERROR: No authenticated user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get client record
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, email, first_name, last_name, phone")
    .eq("email", userEmail)
    .single();

  console.log("[Client Dashboard API] Client lookup:", client?.id || "NOT_FOUND", "Error:", clientError?.message || "none");

  if (clientError || !client) {
    console.log("[Client Dashboard API] ERROR: No client record for email:", userEmail);
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter(s)
  const { data: links, error: linkError } = await supabase
    .from("client_outfitter_links")
    .select(`
      outfitter_id,
      outfitters:outfitters(id, name)
    `)
    .eq("client_id", client.id)
    .eq("is_active", true);

  console.log("[Client Dashboard API] Client links:", links?.length || 0, "Error:", linkError?.message || "none");

  if (linkError || !links || links.length === 0) {
    console.log("[Client Dashboard API] ERROR: Client not linked to any outfitter. Client ID:", client.id);
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  // Use first linked outfitter for now
  const currentLink = links[0] as any;
  const outfitterId = currentLink.outfitter_id;
  const outfitterName = currentLink.outfitters?.name || "Outfitter";

  // Get upcoming calendar events (hunts)
  const now = new Date().toISOString();
  const { data: upcomingHunts, error: huntsError } = await supabase
    .from("calendar_events")
    .select("id, title, start_time, end_time, species, unit, status, guide_username, camp_name")
    .eq("client_email", userEmail)
    .eq("outfitter_id", outfitterId)
    .gte("end_time", now)
    .order("start_time", { ascending: true })
    .limit(5);

  // Get document statuses
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("document_type, status")
    .eq("linked_id", userEmail)
    .eq("outfitter_id", outfitterId);

  // Get questionnaire status
  const { data: questionnaire } = await supabase
    .from("client_questionnaires")
    .select("id, submitted_at")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .single();

  // Get pre-draw status
  const currentYear = new Date().getFullYear();
  const { data: predraw } = await supabase
    .from("client_predraw_submissions")
    .select("id, docusign_status, submitted_at")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .eq("year", currentYear)
    .single();

  // Determine document statuses
  const docStatus = {
    questionnaire: questionnaire ? "completed" : "not_started",
    predraw: predraw?.docusign_status === "completed" ? "completed" : 
             predraw ? "in_progress" : "not_started",
    waiver: "not_started",
    contract: "not_available",
  };

  // Check documents table for waiver and contract
  if (documents) {
    for (const doc of documents) {
      if (doc.document_type === "waiver") {
        docStatus.waiver = doc.status === "fully_executed" ? "completed" : 
                          doc.status === "not_submitted" ? "not_started" : "in_progress";
      }
      if (doc.document_type === "contract") {
        docStatus.contract = doc.status === "fully_executed" ? "completed" :
                            doc.status === "not_submitted" ? "not_started" : "in_progress";
      }
    }
  }

  // Check if client is eligible for hunt contract (has private tag or booked hunt)
  const { data: privateTags } = await supabase
    .from("private_land_tags")
    .select("id")
    .eq("client_email", userEmail)
    .eq("outfitter_id", outfitterId)
    .limit(1);

  const { data: bookedHunts } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("client_email", userEmail)
    .eq("outfitter_id", outfitterId)
    .eq("status", "Booked")
    .limit(1);

  if ((privateTags && privateTags.length > 0) || (bookedHunts && bookedHunts.length > 0)) {
    // Client is eligible for hunt contract
    if (docStatus.contract === "not_available") {
      docStatus.contract = "not_started";
    }
  }

  // Payment due: only guide_fee (signed contract) — show on dashboard; for guide_fee items recalculate from contract BILL so breakdown matches. Stripe takes platform fee via application_fee_amount; client pays full total.
  const { data: paymentItems } = await supabase
    .from("payment_items")
    .select("id, description, subtotal_cents, platform_fee_cents, total_cents, amount_paid_cents, status, contract_id, item_type")
    .eq("client_id", client.id)
    .in("status", ["pending", "partially_paid"])
    .in("item_type", ["guide_fee", "guide_fee_installment"]);

  const admin = supabaseAdmin();
  let balanceDueCents = 0;
  const payItemIds: string[] = [];
  const breakdown: Array<{
    payment_item_id: string;
    description: string;
    subtotal_cents: number;
    platform_fee_cents: number;
    total_cents: number;
    balance_due_cents: number;
  }> = [];
  for (const item of paymentItems || []) {
    let subtotalCents = item.subtotal_cents ?? item.total_cents - (item.platform_fee_cents ?? 0);
    let platformFeeCents = item.platform_fee_cents ?? 0;
    let totalCents = item.total_cents;
    if (item.contract_id && (item.item_type === "guide_fee")) {
      const correct = await recalculateGuideFeePaymentItem(admin, item.id);
      if (correct) {
        subtotalCents = correct.subtotalCents;
        platformFeeCents = correct.platformFeeCents;
        totalCents = correct.totalCents;
      }
    }
    const amountPaid = item.amount_paid_cents || 0;
    const balance = totalCents - amountPaid;
    if (balance > 0) {
      balanceDueCents += balance;
      payItemIds.push(item.id);
      breakdown.push({
        payment_item_id: item.id,
        description: item.description || "Payment",
        subtotal_cents: subtotalCents,
        platform_fee_cents: platformFeeCents,
        total_cents: totalCents,
        balance_due_cents: balance,
      });
    }
  }
  const paymentDue =
    balanceDueCents > 0
      ? {
          balanceDueCents,
          balanceDueFormatted: `$${(balanceDueCents / 100).toLocaleString()}`,
          itemCount: payItemIds.length,
          firstPayItemId: payItemIds[0] ?? null,
          breakdown,
        }
      : null;

  // Get total owed from contracts - use same calculation as payment dashboard
  // Sum up all payment items with recalculated totals (not contract.remaining_balance_cents which might be wrong)
  const { data: allPaymentItems } = await supabase
    .from("payment_items")
    .select("id, contract_id, subtotal_cents, platform_fee_cents, total_cents, amount_paid_cents, status, item_type")
    .eq("client_id", client.id)
    .in("item_type", ["guide_fee", "guide_fee_installment"]);

  let totalOwedFromContractsCents = 0;
  for (const item of allPaymentItems || []) {
    let totalCents = item.total_cents;
    if (item.contract_id && (item.item_type === "guide_fee")) {
      const correct = await recalculateGuideFeePaymentItem(admin, item.id);
      if (correct) {
        totalCents = correct.totalCents;
      }
    }
    const amountPaid = item.amount_paid_cents || 0;
    const balance = totalCents - amountPaid;
    if (balance > 0) {
      totalOwedFromContractsCents += balance;
    }
  }
  const totalOwedFromContracts = totalOwedFromContractsCents / 100;

  // Get dashboard customization from outfitter
  const { data: outfitterData } = await supabase
    .from("outfitters")
    .select(`
      dashboard_hero_title,
      dashboard_hero_subtitle,
      dashboard_hero_image_url,
      dashboard_welcome_text,
      dashboard_cta_primary_text,
      dashboard_cta_primary_url,
      dashboard_cta_secondary_text,
      dashboard_cta_secondary_url,
      dashboard_feature_cards,
      dashboard_hunt_showcases,
      dashboard_testimonials,
      dashboard_special_sections,
      dashboard_partner_logos,
      dashboard_contact_enabled,
      dashboard_contact_email,
      success_history_intro_text,
      success_history_species_photos,
      available_species
    `)
    .eq("id", outfitterId)
    .single();

  const dashboardCustomization = {
    heroTitle: outfitterData?.dashboard_hero_title || "Welcome to Your Client Portal",
    heroSubtitle: outfitterData?.dashboard_hero_subtitle || "Manage your hunts, documents, and more",
    heroImageUrl: outfitterData?.dashboard_hero_image_url || undefined,
    welcomeText: outfitterData?.dashboard_welcome_text || undefined,
    ctaPrimaryText: outfitterData?.dashboard_cta_primary_text || undefined,
    ctaPrimaryUrl: outfitterData?.dashboard_cta_primary_url || undefined,
    ctaSecondaryText: outfitterData?.dashboard_cta_secondary_text || undefined,
    ctaSecondaryUrl: outfitterData?.dashboard_cta_secondary_url || undefined,
    featureCards: (outfitterData?.dashboard_feature_cards as any[]) || [],
    huntShowcases: (outfitterData?.dashboard_hunt_showcases as any[]) || [],
    testimonials: (outfitterData?.dashboard_testimonials as any[]) || [],
    specialSections: (outfitterData?.dashboard_special_sections as any[]) || [],
    partnerLogos: (outfitterData?.dashboard_partner_logos as any[]) || [],
    contactEnabled: outfitterData?.dashboard_contact_enabled || false,
    contactEmail: outfitterData?.dashboard_contact_email || undefined,
  };

  const successHistoryCustomization = {
    introText: outfitterData?.success_history_intro_text || undefined,
    speciesPhotos: (outfitterData?.success_history_species_photos as Record<string, string>) || {},
  };

  const availableSpecies = (outfitterData?.available_species as string[]) || [
    "Elk",
    "Deer",
    "Antelope",
    "Oryx",
    "Ibex",
    "Aoudad",
    "Bighorn Sheep",
    "Bear",
    "Mountain Lion",
    "Turkey",
  ];

  return NextResponse.json({
    client,
    outfitterName,
    upcomingHunts: upcomingHunts || [],
    documentStatus: docStatus,
    dashboardCustomization,
    successHistoryCustomization,
    availableSpecies,
    paymentDue,
    totalOwedFromContracts,
    totalOwedFromContractsFormatted: `$${totalOwedFromContracts.toLocaleString()}`,
  });
}
