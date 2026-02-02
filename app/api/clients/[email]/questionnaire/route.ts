import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: Get questionnaire details for a client
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

    // Get questionnaire
    const { data: questionnaire, error } = await supabase
      .from("client_questionnaires")
      .select("*")
      .eq("client_id", clientData.id)
      .eq("outfitter_id", outfitterId)
      .maybeSingle();

    if (error) {
      console.error("Questionnaire fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!questionnaire) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    return NextResponse.json({ questionnaire }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
