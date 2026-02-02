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
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, email")
    .eq("email", userEmail)
    .maybeSingle();

  if (clientError) {
    console.error("Error fetching client:", clientError);
    // Return empty customization instead of error
    return NextResponse.json({
      introText: undefined,
      speciesPhotos: {},
    });
  }

  if (!client) {
    // Return empty customization instead of error
    return NextResponse.json({
      introText: undefined,
      speciesPhotos: {},
    });
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

  if (linkError || !links || links.length === 0) {
    // Return empty customization instead of error
    return NextResponse.json({
      introText: undefined,
      speciesPhotos: {},
    });
  }

  // Use first linked outfitter for now
  const currentLink = links[0] as any;
  const outfitterId = currentLink.outfitter_id;

  // Get success history customization and available species from outfitter
  const { data: outfitterData, error: outfitterError } = await supabase
    .from("outfitters")
    .select(`
      success_history_intro_text,
      success_history_species_photos,
      available_species
    `)
    .eq("id", outfitterId)
    .maybeSingle();

  // Return customization data (empty if not found)
  return NextResponse.json({
    introText: outfitterData?.success_history_intro_text || undefined,
    speciesPhotos: (outfitterData?.success_history_species_photos as Record<string, string>) || {},
    availableSpecies: (outfitterData?.available_species as string[]) || [],
  });
}
