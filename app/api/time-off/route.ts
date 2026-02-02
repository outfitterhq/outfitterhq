import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: List time off requests for the current outfitter
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    
    console.log("🔍 Time off API - Initial check:", {
      userId: userRes.user.id,
      userEmail: userRes.user.email,
      outfitterIdFromCookie: outfitterId,
      cookieName: OUTFITTER_COOKIE,
    });
    
    if (!outfitterId) {
      console.error("❌ No outfitter cookie found");
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // optional filter: pending, approved, denied
    const guideUsername = searchParams.get("guide_username"); // optional filter

    // First, verify the user is an admin and get their membership
    const { data: membershipData, error: membershipError } = await supabase
      .from("outfitter_memberships")
      .select("role, status, outfitter_id")
      .eq("outfitter_id", outfitterId)
      .eq("user_id", userRes.user.id)
      .eq("status", "active")
      .maybeSingle();

    const isAdmin = membershipData?.role === "owner" || membershipData?.role === "admin";

    // Also check all memberships to see what the user has
    const { data: allMemberships } = await supabase
      .from("outfitter_memberships")
      .select("role, status, outfitter_id")
      .eq("user_id", userRes.user.id)
      .eq("status", "active");

    // Check if time off requests exist for this outfitter (before filtering)
    // Use a service role or bypass RLS temporarily to check if data exists
    const { data: allTimeOffForOutfitter, error: countError } = await supabase
      .from("guide_time_off")
      .select("id, outfitter_id")
      .eq("outfitter_id", outfitterId);

    // Build query - RLS should allow admins to see all for the selected outfitter
    // If admin has access to multiple outfitters, we only query the selected one
    let query = supabase
      .from("guide_time_off")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (guideUsername) {
      query = query.eq("guide_username", guideUsername);
    }

    const { data, error } = await query;
    
    // If admin but no data, check if requests exist in other outfitters they have access to
    if (isAdmin && (!data || data.length === 0) && allMemberships) {
      const adminOutfitterIds = allMemberships
        .filter(m => m.role === "owner" || m.role === "admin")
        .map(m => m.outfitter_id);
      
      if (adminOutfitterIds.length > 0) {
        // Try to see requests across all outfitters where user is admin
        const { data: crossOutfitterData, error: crossError } = await supabase
          .from("guide_time_off")
          .select("outfitter_id, id, guide_username, status")
          .in("outfitter_id", adminOutfitterIds);
        
        console.log("Time off requests in outfitters you're admin for:", {
          currentOutfitter: outfitterId,
          adminOutfitters: adminOutfitterIds,
          requestsFound: crossOutfitterData?.length || 0,
          requestsInOtherOutfitters: crossOutfitterData?.map(r => ({
            outfitter_id: r.outfitter_id,
            id: r.id,
            guide_username: r.guide_username,
            status: r.status,
          })),
          crossError: crossError?.message,
        });
      }
    }
    
    // Debug logging for web admin (server-side, will appear in terminal/Next.js logs)
    console.log("Time off API debug:", {
      userId: userRes.user.id,
      userEmail: userRes.user.email,
      outfitterId,
      isAdmin,
      membershipRole: membershipData?.role,
      membershipStatus: membershipData?.status,
      membershipError: membershipError?.message,
      allMemberships: allMemberships?.map(m => ({ role: m.role, outfitter_id: m.outfitter_id })),
      queryError: error?.message,
      queryErrorCode: error?.code,
      queryErrorDetails: error?.details,
      queryErrorHint: error?.hint,
      dataCount: data?.length || 0,
      sampleRequest: data?.[0] ? {
        id: data[0].id,
        guide_username: data[0].guide_username,
        status: data[0].status,
        outfitter_id: data[0].outfitter_id,
      } : null,
    });

    if (error) {
      console.error("Time off API error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ 
        error: error.message,
        debug: {
          userId: userRes.user.id,
          outfitterId,
          isAdmin,
          membershipRole: membershipData?.role,
          errorCode: error.code,
          errorDetails: error.details,
        }
      }, { status: 500 });
    }

    // If admin but no data, check if requests exist for this outfitter
    if (isAdmin && (!data || data.length === 0)) {
      if (allTimeOffForOutfitter && allTimeOffForOutfitter.length > 0) {
        console.warn("⚠️ CRITICAL: Admin user but RLS blocked access to time off requests.");
        console.warn("   Requests exist in database but RLS policy is blocking access.");
        console.warn("   This suggests the RLS policy admin check is not working correctly.");
        console.warn("   Membership data:", membershipData);
        console.warn("   Outfitter ID:", outfitterId);
      } else {
        console.warn("⚠️ Admin user but no time off requests found for this outfitter.");
        console.warn("   Outfitter ID:", outfitterId);
        console.warn("   Check if requests exist for a different outfitter_id.");
      }
    }

    const response = NextResponse.json({ 
      requests: data ?? [],
      debug: {
        count: data?.length || 0,
        isAdmin,
        membershipRole: membershipData?.role,
        outfitterId,
        totalTimeOffForOutfitter: allTimeOffForOutfitter?.length || 0,
        allMemberships: allMemberships?.map(m => ({ 
          outfitter_id: m.outfitter_id, 
          role: m.role 
        })),
      }
    }, { status: 200 });
    
    // Prevent caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Create a new time off request
export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { guide_username, start_date, end_date, reason } = body;

    if (!guide_username || !start_date || !end_date) {
      return NextResponse.json(
        { error: "guide_username, start_date, and end_date are required" },
        { status: 400 }
      );
    }

    // Get outfitter_id - try cookie first, then get from guide record
    const store = await cookies();
    let outfitterId = store.get(OUTFITTER_COOKIE)?.value;

    // If no cookie, get from guide record
    if (!outfitterId) {
      const { data: guide } = await supabase
        .from("guides")
        .select("outfitter_id")
        .eq("user_id", userRes.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!guide) {
        return NextResponse.json({ error: "Guide record not found" }, { status: 404 });
      }
      outfitterId = guide.outfitter_id;
    }

    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter found" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("guide_time_off")
      .insert({
        outfitter_id: outfitterId,
        guide_username,
        start_date,
        end_date,
        reason: reason || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
