import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * POST: Upload a photo for a lodge
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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const photoType = formData.get("photo_type") as string || "other";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `lodge-photos/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("lodge-photos")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get display order (max + 1)
    const { data: existingPhotos } = await supabase
      .from("lodge_photos")
      .select("display_order")
      .eq("lodge_id", id)
      .order("display_order", { ascending: false })
      .limit(1);

    const displayOrder = existingPhotos && existingPhotos.length > 0
      ? (existingPhotos[0].display_order || 0) + 1
      : 0;

    // Save photo metadata to database
    const { data: photo, error: dbError } = await supabase
      .from("lodge_photos")
      .insert({
        lodge_id: id,
        storage_path: storagePath,
        photo_type: photoType,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from("lodge-photos").remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ photo }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * GET: List photos for a lodge
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

    const { id } = await params;

    // Get photos
    const { data: photos, error } = await supabase
      .from("lodge_photos")
      .select("*")
      .eq("lodge_id", id)
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for photos
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data } = await supabase.storage
          .from("lodge-photos")
          .createSignedUrl(photo.storage_path, 3600); // 1 hour expiry

        return {
          ...photo,
          signed_url: data?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ photos: photosWithUrls });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
