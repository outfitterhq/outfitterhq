import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get signed URL for viewing a guide document
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Get guide record
    const { data: guide, error: guideError } = await supabase
      .from("guides")
      .select("id")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .single();

    if (guideError || !guide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from("guide_documents")
      .select("storage_path")
      .eq("id", id)
      .eq("guide_id", guide.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("guide-documents")
      .createSignedUrl(document.storage_path, 3600);

    if (urlError || !signedUrlData) {
      return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrlData.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
