import { NextResponse } from "next/server";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { getHuntCodeByCode } from "@/lib/hunt-codes-server";

/**
 * GET: List available private land tags for purchase
 * Returns all tags where is_available = true for the client's linked outfitter.
 * Uses admin client so RLS does not hide tags (auth already verified above).
 */
export async function GET() {
  const supabase = await supabaseRoute();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

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

  // Use admin so RLS doesn't hide tags; client + link already verified. Returns all columns including price (tag price).
  const { data: tags, error: tagsError } = await supabaseAdmin()
    .from("private_land_tags")
    .select("*")
    .or(`outfitter_id.eq.${outfitterId},outfitter_id.is.null`)
    .eq("is_available", true)
    .order("species", { ascending: true })
    .order("price", { ascending: true });

  if (tagsError) {
    console.error("Tags error:", tagsError);
    return NextResponse.json({ 
      error: "Failed to load available tags",
      details: tagsError.message,
      debug: {
        outfitter_id: outfitterId,
        client_id: client.id,
        user_email: userEmail,
      }
    }, { status: 500 });
  }

  // If any tags had null outfitter_id, treat as this outfitter's for display (client can purchase and we set outfitter_id on purchase)
  const forOutfitter = (tags || []).filter(
    (t: { outfitter_id?: string | null }) => t.outfitter_id === outfitterId || t.outfitter_id == null
  );

  // Enhance tags with weapon and season dates from hunt codes
  const enhancedTags = await Promise.all(
    forOutfitter.map(async (tag: any) => {
      const enhanced: any = { ...tag };
      
      // Derive weapon from hunt code (middle digit: 1=Rifle, 2=Archery, 3=Muzzleloader)
      if (tag.hunt_code) {
        const parts = tag.hunt_code.split("-");
        if (parts.length >= 2) {
          const weaponDigit = parts[1];
          switch (weaponDigit) {
            case "2":
              enhanced.weapon = "Archery";
              break;
            case "3":
              enhanced.weapon = "Muzzleloader";
              break;
            default:
              enhanced.weapon = "Rifle";
          }
        }
        
        // Fetch season dates from hunt codes
        try {
          const huntCodeData = getHuntCodeByCode(tag.hunt_code);
          if (huntCodeData) {
            if (huntCodeData.start_date && huntCodeData.end_date) {
              enhanced.season_dates = `${huntCodeData.start_date} – ${huntCodeData.end_date}`;
            } else if (huntCodeData.season_text) {
              enhanced.season_dates = huntCodeData.season_text;
            }
          }
        } catch (e) {
          // Silently fail - season dates are optional
        }
      }
      
      // For unit-wide tags, derive weapon from first hunt code option
      if (tag.tag_type === "unit_wide" && tag.hunt_code_options && !enhanced.weapon) {
        const firstCode = tag.hunt_code_options.split(",")[0]?.trim();
        if (firstCode) {
          const parts = firstCode.split("-");
          if (parts.length >= 2) {
            const weaponDigit = parts[1];
            switch (weaponDigit) {
              case "2":
                enhanced.weapon = "Archery";
                break;
              case "3":
                enhanced.weapon = "Muzzleloader";
                break;
              default:
                enhanced.weapon = "Rifle";
            }
          }
        }
      }
      
      return enhanced;
    })
  );

  // Debug: Log if no tags found
  if (enhancedTags.length === 0) {
    console.warn("No available tags found", {
      outfitter_id: outfitterId,
      total_tags_in_query: tags?.length || 0,
      all_tags_for_outfitter: tags?.map((t: any) => ({ id: t.id, is_available: t.is_available, outfitter_id: t.outfitter_id }))
    });
  }

  return NextResponse.json({
    tags: enhancedTags,
    outfitter_id: outfitterId,
    debug: process.env.NODE_ENV === "development" ? {
      total_tags_found: tags?.length || 0,
      filtered_tags: enhancedTags.length,
      client_id: client.id,
    } : undefined,
  });
}
