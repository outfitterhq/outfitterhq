import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await supabaseRoute();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get client record
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get linked outfitter
    const { data: links } = await supabase
      .from("client_outfitter_links")
      .select("outfitter_id")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!links) {
      return NextResponse.json({ error: "Not linked to outfitter" }, { status: 404 });
    }

    return NextResponse.json({ outfitter_id: links.outfitter_id });
  } catch (error: any) {
    console.error("Outfitter link API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
