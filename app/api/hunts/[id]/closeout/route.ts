import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { HuntCloseoutInput } from "@/lib/types/hunt-closeout";

/**
 * POST /api/hunts/[id]/closeout
 * Submit hunt closeout with photos
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: huntId } = await params;
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

    // Verify hunt exists and belongs to outfitter
    const { data: hunt, error: huntError } = await supabase
      .from("calendar_events")
      .select("id, outfitter_id, guide_username, client_email, species, unit, weapon, start_time, end_time")
      .eq("id", huntId)
      .eq("outfitter_id", outfitterId)
      .single();

    if (huntError || !hunt) {
      return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
    }

    // Verify user is the assigned guide or admin
    const { data: guideData } = await supabase
      .from("guides")
      .select("username")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("is_active", true)
      .single();

    const { data: membershipData } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .single();

    const isAdmin = membershipData?.role === "owner" || membershipData?.role === "admin";
    const isGuide = guideData && guideData.username === hunt.guide_username;

    if (!isAdmin && !isGuide) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Check if closeout already exists
    const { data: existingCloseout } = await supabase
      .from("hunt_closeouts")
      .select("id, is_locked")
      .eq("hunt_id", huntId)
      .single();

    if (existingCloseout?.is_locked && !isAdmin) {
      return NextResponse.json({ error: "Closeout is locked. Contact admin to unlock." }, { status: 400 });
    }

    // Parse request body (FormData for file uploads)
    const formData = await req.formData();
    const harvested = formData.get("harvested") === "true";
    const species = formData.get("species")?.toString() || null;
    const weapon = formData.get("weapon")?.toString() || null;
    const unit = formData.get("unit")?.toString() || null;
    const state = formData.get("state")?.toString() || null;
    const huntDatesJson = formData.get("hunt_dates")?.toString() || null;
    const successSummary = formData.get("success_summary")?.toString() || null;
    const weatherConditions = formData.get("weather_conditions")?.toString() || null;
    const animalQualityNotes = formData.get("animal_quality_notes")?.toString() || null;
    const isManualEntry = formData.get("is_manual_entry") === "true";

    // Validate required fields
    if (harvested === undefined) {
      return NextResponse.json({ error: "harvested is required" }, { status: 400 });
    }

    // Get guide username (use hunt's guide_username or current guide)
    const guideUsername = hunt.guide_username || guideData?.username || userRes.user.email?.split("@")[0] || "unknown";

    // Prepare closeout data
    const closeoutData: any = {
      hunt_id: huntId,
      outfitter_id: outfitterId,
      guide_username: guideUsername,
      client_email: hunt.client_email,
      harvested,
      species: species || hunt.species,
      weapon: weapon || hunt.weapon,
      unit: unit || hunt.unit,
      state: state || null,
      hunt_dates: huntDatesJson ? JSON.stringify(JSON.parse(huntDatesJson)) : null,
      success_summary: successSummary,
      weather_conditions: weatherConditions,
      animal_quality_notes: animalQualityNotes,
      submitted_by: guideUsername,
      is_locked: true,
    };

    // Insert or update closeout
    let closeoutId: string;
    if (existingCloseout) {
      // Update existing closeout (admin unlock case)
      const { data: updated, error: updateError } = await supabase
        .from("hunt_closeouts")
        .update(closeoutData)
        .eq("id", existingCloseout.id)
        .select("id")
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      closeoutId = updated.id;
    } else {
      // Insert new closeout
      const { data: inserted, error: insertError } = await supabase
        .from("hunt_closeouts")
        .insert(closeoutData)
        .select("id")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      closeoutId = inserted.id;
    }

    // Handle photo uploads (use admin client so storage + hunt_photos insert are not blocked by RLS)
    const photoFiles = formData.getAll("photos") as File[];
    const uploadedPhotos: Array<{ id: string; storage_path: string }> = [];
    let lastUploadError: string | null = null;
    let lastPhotoInsertError: string | null = null;
    const admin = supabaseAdmin();

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      if (!file || file.size === 0) continue;

      const fileExt = file.name.split(".").pop();
      const fileName = `${closeoutId}/${Date.now()}_${i}.${fileExt}`;
      const storagePath = `${outfitterId}/hunt-closeouts/${fileName}`;

      // Upload to Supabase Storage (bucket "hunt-photos" must exist in Supabase Dashboard → Storage)
      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await admin.storage
        .from("hunt-photos")
        .upload(storagePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Photo upload error:", uploadError);
        lastUploadError = uploadError.message;
        continue; // Skip failed uploads but continue with others
      }

      // Get photo metadata from form
      const category = formData.get(`photo_${i}_category`)?.toString() || null;
      const approvedForMarketing = formData.get(`photo_${i}_approved_for_marketing`) === "true";
      const isPrivate = formData.get(`photo_${i}_is_private`) === "true";

      // Insert photo record (admin bypasses RLS so insert always succeeds after auth check above)
      const { data: photoData, error: photoError } = await admin
        .from("hunt_photos")
        .insert({
          closeout_id: closeoutId,
          hunt_id: huntId,
          outfitter_id: outfitterId,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          category: category,
          approved_for_marketing: approvedForMarketing,
          is_private: isPrivate,
          display_order: i,
          uploaded_by: guideUsername,
        })
        .select("id, storage_path")
        .single();

      if (photoError) {
        console.error("hunt_photos insert error:", photoError);
        lastPhotoInsertError = photoError.message;
      } else if (photoData) {
        uploadedPhotos.push(photoData);
      }
    }

    // Verify at least one photo was uploaded (required for normal closeout; optional for manual entry)
    const anyPhotoError = lastUploadError || lastPhotoInsertError;
    if (uploadedPhotos.length === 0 && !isManualEntry) {
      const msg = anyPhotoError
        ? `Photo failed: ${anyPhotoError}. Ensure the "hunt-photos" storage bucket exists in Supabase (Storage → New bucket → hunt-photos) and has upload policy.`
        : "At least one photo is required";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (uploadedPhotos.length === 0 && isManualEntry && anyPhotoError) {
      return NextResponse.json({
        error: `Photo failed: ${anyPhotoError}. Ensure the "hunt-photos" bucket exists in Supabase Dashboard → Storage.`,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      closeout_id: closeoutId,
      photos_uploaded: uploadedPhotos.length,
      photos: uploadedPhotos,
    });
  } catch (e: any) {
    console.error("Closeout submission error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * GET /api/hunts/[id]/closeout
 * Get closeout details for a hunt
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: huntId } = await params;
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

    // Get closeout
    const { data: closeout, error: closeoutError } = await supabase
      .from("hunt_closeouts")
      .select("*")
      .eq("hunt_id", huntId)
      .eq("outfitter_id", outfitterId)
      .single();

    if (closeoutError) {
      return NextResponse.json({ error: closeoutError.message }, { status: 500 });
    }

    if (!closeout) {
      return NextResponse.json({ closeout: null, photos: [] });
    }

    // Get photos
    const { data: photos, error: photosError } = await supabase
      .from("hunt_photos")
      .select("*")
      .eq("closeout_id", closeout.id)
      .order("display_order", { ascending: true });

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    return NextResponse.json({
      closeout,
      photos: photos || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
