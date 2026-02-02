import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  // Get client record
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter
  const { data: links } = await supabase
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .limit(1);

  if (!links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  const outfitterId = links[0].outfitter_id;

  // Get pricing items for this outfitter - include all fields
  const { data: items, error: itemsError } = await supabase
    .from("pricing_items")
    .select("id, title, description, amount_usd, category, species, weapons, included_days, addon_type")
    .eq("outfitter_id", outfitterId)
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (itemsError) {
    console.error("Pricing error:", itemsError);
    return NextResponse.json({ error: "Failed to load pricing" }, { status: 500 });
  }

  return NextResponse.json({
    items: items || [],
  });
}
