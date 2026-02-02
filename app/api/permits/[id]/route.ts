import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await req.json();

    const updateData: any = {};
    if (body.permit_type !== undefined) updateData.permit_type = body.permit_type;
    if (body.agency !== undefined) updateData.agency = body.agency || null;
    if (body.area !== undefined) updateData.area = body.area || null;
    if (body.identifier !== undefined) updateData.identifier = body.identifier || null;
    if (body.effective_date !== undefined) updateData.effective_date = body.effective_date || null;
    if (body.expiry_date !== undefined) updateData.expiry_date = body.expiry_date || null;
    if (body.attachment_document_id !== undefined)
      updateData.attachment_document_id = body.attachment_document_id || null;
    if (body.metadata !== undefined) updateData.metadata = body.metadata || {};

    const { data, error } = await supabase
      .from("permits")
      .update(updateData)
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ permit: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { error } = await supabase.from("permits").delete().eq("id", id).eq("outfitter_id", outfitterId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
