import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
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

    // Get current waiver to check if admin_signed_at exists
    const { data: waiver } = await supabase
      .from("documents")
      .select("admin_signed_at")
      .eq("client_id", clientData.id)
      .eq("outfitter_id", outfitterId)
      .eq("document_type", "waiver")
      .maybeSingle();

    // Build update object
    const updates: Record<string, string> = {
      status: "fully_executed",
    };
    
    // If admin hasn't signed yet, set that timestamp too
    if (!waiver?.admin_signed_at) {
      updates.admin_signed_at = new Date().toISOString();
    }

    // Update waiver document
    const { error: updateError } = await supabase
      .from("documents")
      .update(updates)
      .eq("client_id", clientData.id)
      .eq("outfitter_id", outfitterId)
      .eq("document_type", "waiver");

    if (updateError) {
      console.error("Error marking waiver fully executed:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Error in waiver fully-executed:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
