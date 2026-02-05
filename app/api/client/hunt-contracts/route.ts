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

    // Get all contracts for this client
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
        client_email
      `)
      .eq("client_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contracts: contracts || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
