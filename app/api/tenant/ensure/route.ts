import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: Ensure outfitter cookie is set if user has only one active membership
// This helps fix the "missing outfitter cookie" error in invite flows
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const existing = store.get(OUTFITTER_COOKIE)?.value;

    // If already set, return it
    if (existing) {
      return NextResponse.json({ outfitter_id: existing, auto_set: false }, { status: 200 });
    }

    // Check memberships
    const { data: memberships } = await supabase
      .from("outfitter_memberships")
      .select("outfitter_id, role, status")
      .eq("user_id", userRes.user.id)
      .eq("status", "active");

    const active = (memberships ?? []) as any[];

    // If only one, auto-set it
    if (active.length === 1) {
      const response = NextResponse.json(
        { outfitter_id: active[0].outfitter_id, auto_set: true },
        { status: 200 }
      );

      response.cookies.set(OUTFITTER_COOKIE, active[0].outfitter_id, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    }

    // Multiple or none - user needs to select
    return NextResponse.json(
      { outfitter_id: null, auto_set: false, needs_selection: true },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
