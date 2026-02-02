import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: List lodges for iOS app
 * Returns lodges with photos for mobile display
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    let outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    
    // If no outfitter cookie, try to infer from user's membership or guide/client record
    if (!outfitterId) {
      // Check guide record first
      const { data: guide } = await supabase
        .from("guides")
        .select("outfitter_id")
        .eq("user_id", userRes.user.id)
        .eq("is_active", true)
        .single();
      
      if (guide?.outfitter_id) {
        outfitterId = guide.outfitter_id;
      } else {
        // Check client record
        const { data: client } = await supabase
          .from("clients")
          .select("outfitter_id")
          .eq("email", userRes.user.email)
          .limit(1)
          .single();
        
        if (client?.outfitter_id) {
          outfitterId = client.outfitter_id;
        } else {
          // Check membership
          const { data: membership } = await supabase
            .from("outfitter_memberships")
            .select("outfitter_id")
            .eq("user_id", userRes.user.id)
            .eq("status", "active")
            .limit(1)
            .single();
          
          if (membership?.outfitter_id) {
            outfitterId = membership.outfitter_id;
          }
        }
      }
    }
    
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter found" }, { status: 400 });
    }

    const { data: lodges, error } = await supabase
      .from("lodges")
      .select(`
        id,
        name,
        address,
        gps_latitude,
        gps_longitude,
        onx_share_link,
        description,
        max_clients,
        max_guides,
        max_beds,
        photos:lodge_photos(
          id,
          storage_path,
          photo_type,
          display_order
        )
      `)
      .eq("outfitter_id", outfitterId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for photos
    const lodgesWithPhotoUrls = await Promise.all(
      (lodges || []).map(async (lodge) => {
        if (lodge.photos && lodge.photos.length > 0) {
          const photosWithUrls = await Promise.all(
            lodge.photos.map(async (photo: any) => {
              const { data } = await supabase.storage
                .from("lodge-photos")
                .createSignedUrl(photo.storage_path, 3600); // 1 hour expiry

              return {
                ...photo,
                signed_url: data?.signedUrl || null,
              };
            })
          );
          return { ...lodge, photos: photosWithUrls };
        }
        return lodge;
      })
    );

    return NextResponse.json({ lodges: lodgesWithPhotoUrls });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
