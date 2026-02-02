import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Get all clients who authorized outfitter to submit their draw applications
 * Query params: ?year=2026 (optional), ?status=pending|completed|all, ?outfitter_id=UUID (for iOS/native apps)
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const { searchParams } = new URL(req.url);
    // Web uses cookie; iOS/native sends outfitter_id in query
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value ?? searchParams.get("outfitter_id") ?? null;
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

    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const status = searchParams.get("status") || "pending"; // pending, completed, or all

    // Build query
    let query = supabase
      .from("client_predraw_submissions")
      .select(`
        *,
        client:clients(
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq("outfitter_id", outfitterId)
      .eq("year", year)
      .eq("submit_choice", "authorize_g3");

    // Filter by status if not "all"
    if (status !== "all") {
      if (status === "pending") {
        // Pending = status is null or 'pending'
        query = query.or("submission_status.is.null,submission_status.eq.pending");
      } else {
        query = query.eq("submission_status", status);
      }
    }

    const { data: submissions, error } = await query.order("submitted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get species selections for each submission
    const submissionsWithSelections = await Promise.all(
      (submissions || []).map(async (submission) => {
        const { data: selections } = await supabase
          .from("predraw_species_selections")
          .select("*")
          .eq("submission_id", submission.id)
          .order("choice_index", { ascending: true });

        return {
          ...submission,
          selections: selections || [],
        };
      })
    );

    return NextResponse.json({
      applications: submissionsWithSelections,
      year,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
