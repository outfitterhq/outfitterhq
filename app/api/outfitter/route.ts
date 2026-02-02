import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: Get current outfitter
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("outfitters")
      .select("*")
      .eq("id", outfitterId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outfitter: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT: Update outfitter
export async function PUT(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const body = await req.json();

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.client_portal_logo_url !== undefined) updateData.client_portal_logo_url = body.client_portal_logo_url;
    if (body.client_portal_background_type !== undefined) updateData.client_portal_background_type = body.client_portal_background_type;
    if (body.client_portal_background_color !== undefined) updateData.client_portal_background_color = body.client_portal_background_color;
    if (body.client_portal_background_image_url !== undefined) updateData.client_portal_background_image_url = body.client_portal_background_image_url;
    if (body.client_portal_per_page_backgrounds !== undefined) updateData.client_portal_per_page_backgrounds = body.client_portal_per_page_backgrounds;
    if (body.client_portal_header_color !== undefined) updateData.client_portal_header_color = body.client_portal_header_color;
    if (body.dashboard_hero_title !== undefined) updateData.dashboard_hero_title = body.dashboard_hero_title;
    if (body.dashboard_hero_subtitle !== undefined) updateData.dashboard_hero_subtitle = body.dashboard_hero_subtitle;
    if (body.dashboard_hero_image_url !== undefined) updateData.dashboard_hero_image_url = body.dashboard_hero_image_url;
    if (body.dashboard_cta_primary_text !== undefined) updateData.dashboard_cta_primary_text = body.dashboard_cta_primary_text;
    if (body.dashboard_cta_primary_url !== undefined) updateData.dashboard_cta_primary_url = body.dashboard_cta_primary_url;
    if (body.dashboard_cta_secondary_text !== undefined) updateData.dashboard_cta_secondary_text = body.dashboard_cta_secondary_text;
    if (body.dashboard_cta_secondary_url !== undefined) updateData.dashboard_cta_secondary_url = body.dashboard_cta_secondary_url;
    if (body.dashboard_feature_cards !== undefined) updateData.dashboard_feature_cards = body.dashboard_feature_cards;
    if (body.dashboard_hunt_showcases !== undefined) updateData.dashboard_hunt_showcases = body.dashboard_hunt_showcases;
    if (body.dashboard_testimonials !== undefined) updateData.dashboard_testimonials = body.dashboard_testimonials;
    if (body.dashboard_special_sections !== undefined) updateData.dashboard_special_sections = body.dashboard_special_sections;
    if (body.dashboard_partner_logos !== undefined) updateData.dashboard_partner_logos = body.dashboard_partner_logos;
    if (body.dashboard_contact_enabled !== undefined) updateData.dashboard_contact_enabled = body.dashboard_contact_enabled;
    if (body.dashboard_contact_email !== undefined) updateData.dashboard_contact_email = body.dashboard_contact_email;
    if (body.dashboard_welcome_text !== undefined) updateData.dashboard_welcome_text = body.dashboard_welcome_text;
    if (body.success_history_intro_text !== undefined) updateData.success_history_intro_text = body.success_history_intro_text;
    if (body.success_history_species_photos !== undefined) updateData.success_history_species_photos = body.success_history_species_photos;
    if (body.available_species !== undefined) updateData.available_species = body.available_species;

    const { data, error } = await supabase
      .from("outfitters")
      .update(updateData)
      .eq("id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outfitter: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
