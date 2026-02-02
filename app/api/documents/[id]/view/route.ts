import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get document
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select("storage_path, outfitter_id")
      .eq("id", id)
      .single();

    if (docError || !docData) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Verify document belongs to outfitter
    if (docData.outfitter_id !== outfitterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!docData.storage_path) {
      return NextResponse.json({ error: "Document path not available" }, { status: 404 });
    }

    // Try to generate signed URL from storage
    // First, try to determine the bucket name from the path
    const pathParts = docData.storage_path.split("/");
    const bucketName = pathParts[0] || "documents";
    const filePath = pathParts.slice(1).join("/");

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (urlError || !signedUrlData) {
      // If signed URL fails, try to construct a direct URL
      // This assumes the storage path is accessible
      return NextResponse.redirect(new URL(docData.storage_path, req.url));
    }

    // Redirect to the signed URL
    return NextResponse.redirect(new URL(signedUrlData.signedUrl));
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
