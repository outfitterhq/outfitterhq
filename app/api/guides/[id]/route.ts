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

    // Get guide by user_id (since id param is user_id)
    const { data, error } = await supabase
      .from("guides")
      .select("*")
      .eq("user_id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    return NextResponse.json({ guide: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE: Soft delete (deactivate) a guide
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

    // Soft delete: set is_active to false
    const { data, error } = await supabase
      .from("guides")
      .update({ is_active: false })
      .eq("user_id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // Also deactivate the membership if it exists
    await supabase
      .from("outfitter_memberships")
      .update({ status: "inactive" })
      .eq("user_id", id)
      .eq("outfitter_id", outfitterId);

    return NextResponse.json({ guide: data, message: "Guide deactivated successfully" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
