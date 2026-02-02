import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET /api/photos/[id]/url
 * Get a fresh signed URL for a photo (for displaying species photos)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params;
    
    if (!photoId || photoId.trim() === "") {
      return NextResponse.json({ error: "Photo ID is required" }, { status: 400 });
    }

    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get photo storage path
    const { data: photo, error: photoError } = await supabase
      .from("hunt_photos")
      .select("storage_path, outfitter_id, approved_for_marketing")
      .eq("id", photoId)
      .maybeSingle();

    if (photoError) {
      console.error("Error fetching photo:", photoError);
      return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 });
    }

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // For client access, only allow marketing-approved photos
    // Check if user is a client
    const { data: clientData } = await supabase
      .from("clients")
      .select("id")
      .eq("email", userRes.user.email)
      .maybeSingle();

    const isClient = !!clientData;
    if (isClient && !photo.approved_for_marketing) {
      return NextResponse.json({ error: "Photo not available" }, { status: 403 });
    }

    // Generate signed URL (valid for 24 hours for species photos)
    const { data: urlData, error: urlError } = await supabase.storage
      .from("hunt-photos")
      .createSignedUrl(photo.storage_path, 86400); // 24 hours

    if (urlError) {
      console.error("Error generating signed URL:", urlError);
      return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
    }

    if (!urlData || !urlData.signedUrl) {
      return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
    }

    return NextResponse.json({ url: urlData.signedUrl });
  } catch (e: any) {
    console.error("Photo URL API error:", e);
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
