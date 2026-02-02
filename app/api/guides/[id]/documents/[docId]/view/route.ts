import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
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

    // Get document
    const { data: docData, error: docError } = await supabase
      .from("guide_documents")
      .select("storage_path, guide_id")
      .eq("id", docId)
      .single();

    if (docError || !docData) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Verify guide belongs to outfitter
    const { data: guideData } = await supabase
      .from("guides")
      .select("id")
      .eq("id", docData.guide_id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!guideData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate signed URL
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("guide-documents")
      .createSignedUrl(docData.storage_path, 3600); // 1 hour expiry

    if (urlError || !signedUrlData) {
      return NextResponse.json({ error: "Failed to generate document URL" }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrlData.signedUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
