import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Redirect to signed URL so the browser downloads the guide document
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const { data: guide, error: guideError } = await supabase
      .from("guides")
      .select("id")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .single();

    if (guideError || !guide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    const { data: document, error: docError } = await supabase
      .from("guide_documents")
      .select("storage_path, file_name")
      .eq("id", id)
      .eq("guide_id", guide.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("guide-documents")
      .createSignedUrl(document.storage_path, 3600);

    if (urlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
    }

    return NextResponse.redirect(signedUrlData.signedUrl);
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
