import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { searchParams } = new URL(req.url);
    const outfitterId = searchParams.get("outfitter_id");

    if (!outfitterId) {
      return NextResponse.json({ error: "outfitter_id is required" }, { status: 400 });
    }

    // Get user session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a client linked to this outfitter
    // First, get the client record for this user
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (!client) {
      return NextResponse.json({ error: "Client record not found" }, { status: 403 });
    }

    // Then check the link using the client record ID
    const { data: clientLink } = await supabase
      .from("client_outfitter_links")
      .select("id")
      .eq("client_id", client.id)
      .eq("outfitter_id", outfitterId)
      .maybeSingle();

    if (!clientLink) {
      return NextResponse.json({ error: "Client not linked to outfitter" }, { status: 403 });
    }

    // Call RPC to get success records (same as iOS)
    // The RPC expects p_outfitter_id as UUID, other params are optional
    const { data: results, error: rpcError } = await supabase.rpc("get_success_records", {
      p_outfitter_id: outfitterId, // Supabase will convert string to UUID
      p_species: null,
      p_weapon: null,
      p_unit: null,
      p_state: null,
      p_year: null,
      p_guide_username: null,
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Filter to only records with marketing-approved photos
    const marketingPhotos: Array<{
      id: string;
      photoUrl: string;
      species?: string;
      weapon?: string;
      unit?: string;
      seasonYear?: number;
    }> = [];

    for (const result of results || []) {
      // Only include records with marketing-approved photos
      if (
        result.primary_photo_storage_path &&
        result.primary_photo_storage_path.length > 0 &&
        (result.marketing_photos ?? 0) > 0
      ) {
        try {
          // Generate signed URL
          const { data: urlData, error: urlError } = await supabase.storage
            .from("hunt-photos")
            .createSignedUrl(result.primary_photo_storage_path, 3600);

          if (urlError || !urlData) {
            console.error(
              `Failed to generate signed URL for path: ${result.primary_photo_storage_path}`,
              urlError
            );
            // Continue to next photo - don't fail entire request
            continue;
          }

          marketingPhotos.push({
            id: result.closeout_id,
            photoUrl: urlData.signedUrl,
            species: result.species || undefined,
            weapon: result.weapon || undefined,
            unit: result.unit || undefined,
            seasonYear: result.season_year || undefined,
          });
        } catch (e) {
          console.error("Error processing photo:", e);
          continue;
        }
      }
    }

    console.log(
      `Marketing photos: Found ${results?.length || 0} success records, ${marketingPhotos.length} with valid photos`
    );

    return NextResponse.json({ photos: marketingPhotos });
  } catch (error: any) {
    console.error("Marketing photos API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
