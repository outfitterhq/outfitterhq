import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get hunt contracts for the logged-in client
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = userRes.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Get client record to find linked outfitters
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get linked outfitters
    const { data: links } = await supabase
      .from("client_outfitter_links")
      .select("outfitter_id")
      .eq("client_id", client.id)
      .eq("is_active", true);

    if (!links || links.length === 0) {
      return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
    }

    const outfitterIds = links.map((l: any) => l.outfitter_id);

    // Get all contracts for this client across all linked outfitters
    const { data: contracts, error } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        status,
        hunt_id,
        created_at,
        contract_total_cents,
        amount_paid_cents,
        remaining_balance_cents,
        payment_status,
        client_email,
        outfitter_id
      `)
      .eq("client_email", userEmail)
      .in("outfitter_id", outfitterIds)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contracts: contracts || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
