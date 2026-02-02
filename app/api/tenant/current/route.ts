import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/** GET /api/tenant/current - Returns current outfitter ID from server-side cookie.
 * Used by client components that can't read httpOnly cookies.
 */
export async function GET() {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;

    if (!outfitterId) {
      // Try to auto-set if only one membership
      const { data: memberships } = await supabase
        .from("outfitter_memberships")
        .select("outfitter_id, role, status")
        .eq("user_id", userRes.user.id)
        .eq("status", "active");

      const active = (memberships ?? []) as any[];
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
          maxAge: 60 * 60 * 24 * 30,
        });
        return response;
      }

      return NextResponse.json({ outfitter_id: null, needs_selection: true }, { status: 200 });
    }

    return NextResponse.json({ outfitter_id: outfitterId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
