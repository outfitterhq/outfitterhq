import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * POST: Admin signs document (DocuSign-style flow).
 * Client signs first → admin reviews & signs → status = fully_executed.
 * Updates documents.status to 'fully_executed' and sets admin_signed_at.
 */
export async function POST(
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

    // Skip placeholders (client-detail API uses placeholder-* ids for "Not submitted")
    if (id.startsWith("placeholder-")) {
      return NextResponse.json(
        { error: "Cannot sign a placeholder document. Upload a document first." },
        { status: 400 }
      );
    }

    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("id, outfitter_id, status, storage_path")
      .eq("id", id)
      .single();

    if (fetchErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.outfitter_id !== outfitterId) {
      return NextResponse.json({ error: "Document does not belong to current outfitter" }, { status: 403 });
    }

    const { error: updateErr } = await supabase
      .from("documents")
      .update({
        status: "fully_executed",
        admin_signed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("outfitter_id", outfitterId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, message: "Document marked as fully executed." },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
