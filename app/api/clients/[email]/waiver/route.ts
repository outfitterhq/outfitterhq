import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

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

    if (!clientData?.id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get waiver document
    const { data: waiver, error } = await supabase
      .from("documents")
      .select("id, status, client_signed_at, admin_signed_at, created_at")
      .eq("client_id", clientData.id)
      .eq("outfitter_id", outfitterId)
      .eq("document_type", "waiver")
      .maybeSingle();

    if (error) {
      console.error("Waiver fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!waiver) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    return NextResponse.json({ waiver }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
