import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * DELETE: Delete a lodge photo
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
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

    const { id, photoId } = await params;

    // Verify lodge belongs to outfitter
    const { data: lodge } = await supabase
      .from("lodges")
      .select("id")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found" }, { status: 404 });
    }

    // Get photo to get storage path
    const { data: photo, error: photoError } = await supabase
      .from("lodge_photos")
      .select("storage_path")
      .eq("id", photoId)
      .eq("lodge_id", id)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("lodge-photos")
      .remove([photo.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue to delete DB record even if storage delete fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("lodge_photos")
      .delete()
      .eq("id", photoId)
      .eq("lodge_id", id);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
