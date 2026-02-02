import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: List camps for iOS app
 * Returns camps with basic info for mobile display
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

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const guideId = searchParams.get("guide_id"); // Filter by guide assignment
    const clientEmail = searchParams.get("client_email"); // Filter by client assignment

    // Build base query
    let query = supabase
      .from("camps")
      .select(`
        id,
        name,
        state,
        unit,
        hunt_code,
        start_date,
        end_date,
        camp_type,
        onx_share_link,
        gps_latitude,
        gps_longitude,
        location_label,
        lodge:lodges(
          id,
          name,
          address,
          gps_latitude,
          gps_longitude,
          onx_share_link
        )
      `)
      .eq("outfitter_id", outfitterId);

    // Filter by year if provided
    if (year) {
      const yearInt = parseInt(year, 10);
      query = query.or(`start_date.gte.${yearInt}-01-01,end_date.lte.${yearInt}-12-31`);
    }

    // Filter by guide assignment
    if (guideId) {
      const { data: guideAssignments } = await supabase
        .from("camp_guide_assignments")
        .select("camp_id")
        .eq("guide_id", guideId);
      
      if (guideAssignments && guideAssignments.length > 0) {
        const campIds = guideAssignments.map((a: any) => a.camp_id);
        query = query.in("id", campIds);
      } else {
        // No assignments, return empty result
        return NextResponse.json({ camps: [] });
      }
    }

    // Filter by client assignment
    if (clientEmail) {
      // First find client ID by email
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("email", clientEmail)
        .eq("outfitter_id", outfitterId)
        .single();
      
      if (client?.id) {
        const { data: clientAssignments } = await supabase
          .from("camp_client_assignments")
          .select("camp_id")
          .eq("client_id", client.id);
        
        if (clientAssignments && clientAssignments.length > 0) {
          const campIds = clientAssignments.map((a: any) => a.camp_id);
          query = query.in("id", campIds);
        } else {
          // No assignments, return empty result
          return NextResponse.json({ camps: [] });
        }
      } else {
        // Client not found, return empty result
        return NextResponse.json({ camps: [] });
      }
    }

    const { data: camps, error } = await query.order("start_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get assignment counts for each camp
    const campsWithDetails = await Promise.all(
      (camps || []).map(async (camp) => {
        const [clientsRes, guidesRes] = await Promise.all([
          supabase
            .from("camp_client_assignments")
            .select(`
              client:clients(
                id,
                first_name,
                last_name,
                email
              )
            `)
            .eq("camp_id", camp.id),
          supabase
            .from("camp_guide_assignments")
            .select(`
              guide:guides(
                id,
                name,
                username,
                email
              )
            `)
            .eq("camp_id", camp.id),
        ]);

        return {
          ...camp,
          clients: (clientsRes.data || []).map((a: any) => a.client).filter(Boolean),
          guides: (guidesRes.data || []).map((a: any) => a.guide).filter(Boolean),
        };
      })
    );

    return NextResponse.json({ camps: campsWithDetails });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
