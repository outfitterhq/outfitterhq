import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Get guides assigned to a camp
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

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { id } = await params;

    // Verify camp belongs to outfitter
    const { data: camp } = await supabase
      .from("camps")
      .select("id, max_guides")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // Get assigned guides
    const { data: assignments, error } = await supabase
      .from("camp_guide_assignments")
      .select(`
        *,
        guide:guides(
          id,
          name,
          email,
          username,
          phone
        )
      `)
      .eq("camp_id", id)
      .order("assigned_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      guides: assignments?.map((a) => a.guide) || [],
      assigned_count: assignments?.length || 0,
      max_guides: camp.max_guides,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Assign guides to a camp
 */
export async function POST(
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

    // Verify admin access
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

    const { id } = await params;
    const body = await req.json();
    const { guide_ids } = body;

    if (!Array.isArray(guide_ids)) {
      return NextResponse.json({ error: "guide_ids must be an array" }, { status: 400 });
    }

    // Verify camp belongs to outfitter and check capacity
    const { data: camp } = await supabase
      .from("camps")
      .select("id, max_guides")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // Get current assignments
    const { data: existing } = await supabase
      .from("camp_guide_assignments")
      .select("guide_id")
      .eq("camp_id", id);

    const existingIds = new Set((existing || []).map((e) => e.guide_id));
    const newGuideIds = guide_ids.filter((gid: string) => !existingIds.has(gid));

    // Check capacity
    const totalAfterAdd = (existing?.length || 0) + newGuideIds.length;
    if (camp.max_guides && totalAfterAdd > camp.max_guides) {
      return NextResponse.json(
        { error: `Camp guide capacity exceeded. Max: ${camp.max_guides}, Attempting: ${totalAfterAdd}` },
        { status: 400 }
      );
    }

    // Insert new assignments
    if (newGuideIds.length > 0) {
      const assignments = newGuideIds.map((guideId: string) => ({
        camp_id: id,
        guide_id: guideId,
        assigned_by: userRes.user.id,
      }));

      const { error: insertError } = await supabase
        .from("camp_guide_assignments")
        .insert(assignments);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, added: newGuideIds.length });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE: Remove a guide from a camp
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

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    // Verify admin access
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

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const guideId = searchParams.get("guide_id");

    if (!guideId) {
      return NextResponse.json({ error: "guide_id query parameter required" }, { status: 400 });
    }

    // Verify camp belongs to outfitter
    const { data: camp } = await supabase
      .from("camps")
      .select("id")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("camp_guide_assignments")
      .delete()
      .eq("camp_id", id)
      .eq("guide_id", guideId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
