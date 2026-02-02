import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * DELETE /api/photos/[id]
 * Delete a photo (removes from storage and database)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params;
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
    const { data: membershipData } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .single();

    const isAdmin = membershipData?.role === "owner" || membershipData?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get photo record to get storage path
    const { data: photo, error: photoError } = await supabase
      .from("hunt_photos")
      .select("storage_path, outfitter_id")
      .eq("id", photoId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Verify photo belongs to outfitter
    if (photo.outfitter_id !== outfitterId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("hunt-photos")
      .remove([photo.storage_path]);

    if (storageError) {
      console.error("Storage deletion error:", storageError);
      // Continue with DB deletion even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("hunt_photos")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * PATCH /api/photos/[id]
 * Update photo metadata (approve/reject for marketing, category, etc.)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params;
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
    const { data: membershipData } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .single();

    const isAdmin = membershipData?.role === "owner" || membershipData?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.approved_for_marketing !== undefined) {
      updateData.approved_for_marketing = body.approved_for_marketing;
    }
    if (body.is_private !== undefined) {
      updateData.is_private = body.is_private;
    }
    if (body.category !== undefined) {
      updateData.category = body.category;
    }
    if (body.display_order !== undefined) {
      updateData.display_order = body.display_order;
    }

    const { data: updated, error: updateError } = await supabase
      .from("hunt_photos")
      .update(updateData)
      .eq("id", photoId)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ photo: updated });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
