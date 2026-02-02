import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get current guide's documents
 */
export async function GET() {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

    // Get documents
    const { data: documents, error: docsError } = await supabase
      .from("guide_documents")
      .select("*")
      .eq("guide_id", guide.id)
      .order("uploaded_at", { ascending: false });

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Upload a document for current guide
 */
export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get guide record
    const { data: guide, error: guideError } = await supabase
      .from("guides")
      .select("id, outfitter_id")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .single();

    if (guideError || !guide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;

    if (!file || !title) {
      return NextResponse.json(
        { error: "file and title are required" },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${guide.id}/${Date.now()}.${fileExt}`;
    // Storage path is just the file path within the bucket (bucket name is separate)
    const storagePath = fileName;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("guide-documents")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Create document record
    const { data: document, error: docError } = await supabase
      .from("guide_documents")
      .insert({
        guide_id: guide.id,
        outfitter_id: guide.outfitter_id,
        title,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
      })
      .select()
      .single();

    if (docError) {
      // Clean up uploaded file if document creation fails
      await supabase.storage.from("guide-documents").remove([storagePath]);
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
