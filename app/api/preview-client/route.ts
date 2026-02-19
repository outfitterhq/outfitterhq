import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET /api/preview-client
 * Admin-only: returns branding + mock dashboard payload for the current outfitter
 * so the admin can preview the client portal without being a client.
 */
export async function GET() {
  const supabase = await supabaseRoute();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await cookies();
  const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
  if (!outfitterId) {
    return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
  }

  // Verify user is admin/owner for this outfitter
  const { data: membership } = await supabase
    .from("outfitter_memberships")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("outfitter_id", outfitterId)
    .eq("status", "active")
    .single();

  const role = (membership as { role?: string } | null)?.role ?? "";
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: outfitter, error: outfitterError } = await supabase
    .from("outfitters")
    .select(`
      name,
      client_portal_logo_url,
      client_portal_background_type,
      client_portal_background_color,
      client_portal_background_image_url,
      client_portal_background_image_urls,
      client_portal_per_page_backgrounds,
      client_portal_header_color,
      client_portal_accent_color,
      dashboard_hero_title,
      dashboard_hero_subtitle,
      dashboard_hero_image_url,
      dashboard_welcome_text,
      dashboard_cta_primary_text,
      dashboard_cta_primary_url,
      dashboard_cta_secondary_text,
      dashboard_cta_secondary_url,
      dashboard_feature_cards,
      dashboard_special_sections,
      dashboard_partner_logos,
      dashboard_contact_enabled,
      dashboard_contact_email
    `)
    .eq("id", outfitterId)
    .single();

  if (outfitterError || !outfitter) {
    return NextResponse.json({ error: "Outfitter not found" }, { status: 404 });
  }

  const o = outfitter as any;
  const branding = {
    logoUrl: o.client_portal_logo_url || undefined,
    backgroundType: o.client_portal_background_type || "color",
    backgroundColor: o.client_portal_background_color || "#f5f5f5",
    backgroundImageUrl: o.client_portal_background_image_url || undefined,
    backgroundImageUrls: Array.isArray(o.client_portal_background_image_urls) ? o.client_portal_background_image_urls : [],
    perPageBackgrounds: o.client_portal_per_page_backgrounds || {},
    headerColor: o.client_portal_header_color || "#1a472a",
    accentColor: o.client_portal_accent_color || "#1a472a",
  };

  const dashboardCustomization = {
    heroTitle: o.dashboard_hero_title || "Welcome to Your Client Portal",
    heroSubtitle: o.dashboard_hero_subtitle || "Manage your hunts, documents, and more",
    heroImageUrl: o.dashboard_hero_image_url || undefined,
    welcomeText: o.dashboard_welcome_text || undefined,
    ctaPrimaryText: o.dashboard_cta_primary_text || undefined,
    ctaPrimaryUrl: o.dashboard_cta_primary_url || undefined,
    ctaSecondaryText: o.dashboard_cta_secondary_text || undefined,
    ctaSecondaryUrl: o.dashboard_cta_secondary_url || undefined,
    featureCards: (o.dashboard_feature_cards as any[]) || [],
    specialSections: (o.dashboard_special_sections as any[]) || [],
    partnerLogos: (o.dashboard_partner_logos as any[]) || [],
    contactEnabled: o.dashboard_contact_enabled || false,
    contactEmail: o.dashboard_contact_email || undefined,
  };

  const dashboardData = {
    client: { id: "", email: "preview@example.com", first_name: "Preview", last_name: "User" },
    outfitterName: o.name || "Outfitter",
    upcomingHunts: [] as any[],
    documentStatus: {
      questionnaire: "not_started" as const,
      predraw: "not_started" as const,
      waiver: "not_started" as const,
      contract: "not_available" as const,
    },
    dashboardCustomization,
    paymentDue: null as any,
    totalOwedFromContracts: 0,
    totalOwedFromContractsFormatted: "$0",
  };

  return NextResponse.json({
    branding,
    ...dashboardData,
  });
}
