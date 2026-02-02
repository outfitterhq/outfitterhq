import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

const BUCKET = "outfitter-documents";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf"];

/**
 * POST: Upload waiver PDF for the current outfitter.
 * Clients will see this PDF on the Waiver of Liability page and sign via DocuSign.
 */
export async function POST(req: Request) {
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

    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF is allowed." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const storagePath = `${outfitterId}/waiver.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Upload failed. Ensure the storage bucket 'outfitter-documents' exists." },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("outfitters")
      .update({ waiver_document_path: storagePath })
      .eq("id", outfitterId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      path: storagePath,
      message: "Waiver PDF uploaded. Clients will see it on the Waiver of Liability page.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
