import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET /api/outfitter/species
 * Get available species list for the current outfitter
 * Can be accessed by clients (for filtering) or admins
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    let outfitterId = store.get(OUTFITTER_COOKIE)?.value;

    // If no outfitter cookie (client), get from client_outfitter_links
    if (!outfitterId) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("email", userRes.user.email)
        .maybeSingle();

      if (clientData) {
        const { data: linkData } = await supabase
          .from("client_outfitter_links")
          .select("outfitter_id")
          .eq("client_id", clientData.id)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (linkData) {
          outfitterId = linkData.outfitter_id;
        }
      }
    }

    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter found" }, { status: 400 });
    }

    // Get available species from outfitter
    const { data: outfitterData } = await supabase
      .from("outfitters")
      .select("available_species")
      .eq("id", outfitterId)
      .single();

    const species = (outfitterData?.available_species as string[]) || [
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

    return NextResponse.json({ species });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
