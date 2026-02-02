import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export async function POST(
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

    if (!clientData?.id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    console.log("🔵 Marking predraw as reviewed for clientId:", clientData.id, "outfitterId:", outfitterId);

    // Use admin client to bypass RLS for updates
    const adminClient = supabaseAdmin();

    // First verify the predraw exists
    const { data: existing, error: findError } = await adminClient
      .from("client_predraw_submissions")
      .select("id")
      .eq("client_id", clientData.id)
      .eq("outfitter_id", outfitterId)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Error finding predraw:", findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!existing) {
      console.error("No predraw found for client");
      return NextResponse.json({ error: "Pre-draw submission not found" }, { status: 404 });
    }

    console.log("🔵 Found predraw:", existing.id);

    // Update by ID to ensure we update the right row
    const { data: updateData, error: updateError } = await adminClient
      .from("client_predraw_submissions")
      .update({ admin_reviewed_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select();

    if (updateError) {
      console.error("Error marking predraw as reviewed:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log("✅ Updated predraw:", updateData);

    return NextResponse.json({ success: true, updated: updateData });
  } catch (e: any) {
    console.error("Error in predraw review:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
