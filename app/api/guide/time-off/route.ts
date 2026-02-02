import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get time off requests for current guide
 */
export async function GET() {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get guide record
    const { data: guide, error: guideError } = await supabase
      .from("guides")
      .select("username, email, outfitter_id")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .single();

    if (guideError || !guide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // Get time off requests for this guide (match by username or email)
    const { data: requests, error } = await supabase
      .from("guide_time_off")
      .select("*")
      .eq("outfitter_id", guide.outfitter_id)
      .or(`guide_username.eq.${guide.username},guide_username.eq.${guide.email}`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
