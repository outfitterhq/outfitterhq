import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    // First get the guide to find guide_id
    const { data: guideData } = await supabase
      .from("guides")
      .select("id")
      .eq("user_id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!guideData) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // Get documents for this guide
    const { data, error } = await supabase
      .from("guide_documents")
      .select("*")
      .eq("guide_id", guideData.id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ documents: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
