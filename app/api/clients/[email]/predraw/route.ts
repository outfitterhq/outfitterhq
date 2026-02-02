import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: Get pre-draw contract details for a client
export async function GET(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
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

    const { email } = await params;
    const decodedEmail = decodeURIComponent(email);

    // Get client ID
    const { data: clientData } = await supabase
      .from("clients")
      .select("id")
      .eq("email", decodedEmail)
      .maybeSingle();

    if (!clientData) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get pre-draw submission
    const { data: predraw, error } = await supabase
      .from("client_predraw_submissions")
      .select("*")
      .eq("client_id", clientData.id)
      .eq("outfitter_id", outfitterId)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Pre-draw fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!predraw) {
      return NextResponse.json({ error: "Pre-draw contract not found" }, { status: 404 });
    }

    // Get species selections
    const { data: selections } = await supabase
      .from("predraw_species_selections")
      .select("*")
      .eq("submission_id", predraw.id)
      .order("species", { ascending: true })
      .order("choice_index", { ascending: true });

    return NextResponse.json({ 
      predraw,
      selections: selections || []
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
