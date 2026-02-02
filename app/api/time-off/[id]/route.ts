import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// PUT: Update time off request (approve/deny)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const { status, reviewed_by } = body;

    if (!status || !["pending", "approved", "denied"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'pending', 'approved', or 'denied'" },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewed_by || userRes.user.email || "Admin",
    };

    const { data, error } = await supabase
      .from("guide_time_off")
      .update(updateData)
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Time off request not found" }, { status: 404 });
    }

    return NextResponse.json({ request: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE: Delete time off request
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

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from("guide_time_off")
      .delete()
      .eq("id", id)
      .eq("outfitter_id", outfitterId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
