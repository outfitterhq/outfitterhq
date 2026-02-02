import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get lodge photos for camps the client is assigned to
 * Client can only see photos for lodges of camps they're assigned to
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = userRes.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    // Find client record
    const { data: client } = await supabase
      .from("clients")
      .select("id, outfitter_id")
      .eq("email", userEmail)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client record not found" }, { status: 404 });
    }

    // Get camps the client is assigned to
    const { data: campAssignments } = await supabase
      .from("camp_client_assignments")
      .select(`
        camp:camps(
          id,
          lodge_id
        )
      `)
      .eq("client_id", client.id);

    const lodgeIds = new Set<string>();
    (campAssignments || []).forEach((assignment: any) => {
      if (assignment.camp?.lodge_id) {
        lodgeIds.add(assignment.camp.lodge_id);
      }
    });

    if (lodgeIds.size === 0) {
      return NextResponse.json({ photos: [] });
    }

    // Get photos for lodges of assigned camps
    const { data: photos, error } = await supabase
      .from("lodge_photos")
      .select(`
        id,
        lodge_id,
        storage_path,
        photo_type,
        display_order,
        lodge:lodges(
          id,
          name
        )
      `)
      .in("lodge_id", Array.from(lodgeIds))
      .order("lodge_id", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for photos
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo: any) => {
        const { data } = await supabase.storage
          .from("lodge-photos")
          .createSignedUrl(photo.storage_path, 3600); // 1 hour expiry

        return {
          id: photo.id,
          lodge_id: photo.lodge_id,
          lodge_name: photo.lodge?.name || "Unknown Lodge",
          photo_type: photo.photo_type,
          display_order: photo.display_order,
          signed_url: data?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ photos: photosWithUrls });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
