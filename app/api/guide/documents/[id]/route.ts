import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * DELETE: Delete a guide document
 */
export async function DELETE(
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

    // Get document to verify ownership and get storage path
    const { data: document, error: docError } = await supabase
      .from("guide_documents")
      .select("storage_path")
      .eq("id", id)
      .eq("guide_id", guide.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete from storage
    if (document.storage_path) {
      await supabase.storage.from("guide-documents").remove([document.storage_path]);
    }

    // Delete document record
    const { error: deleteError } = await supabase
      .from("guide_documents")
      .delete()
      .eq("id", id)
      .eq("guide_id", guide.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
