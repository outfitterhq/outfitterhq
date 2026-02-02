import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

async function getAdminOutfitterId(
  supabase: Awaited<ReturnType<typeof supabaseRoute>>,
  req: NextRequest
): Promise<string | null> {
  const store = await cookies();
  const fromCookie = store.get(OUTFITTER_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  const { searchParams } = new URL(req.url);
  const fromQuery = searchParams.get("outfitter_id");
  if (fromQuery) return fromQuery;
  return null;
}

/**
 * GET: Get contracts ready to send for signature (approved, not yet sent to DocuSign)
 * Returns all contracts with status 'ready_for_signature' for the current outfitter.
 * Auth: session cookie (web) or Authorization: Bearer + ?outfitter_id= (iOS).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseRoute();
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    let userId: string | null = session?.user?.id ?? null;
    if (!userId) {
      const auth = req.headers.get("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: { user }, error: userErr } = await supabase.auth.getUser(auth.slice(7));
        if (!userErr && user) userId = user.id;
      }
    }
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const outfitterId = await getAdminOutfitterId(supabase, req);
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: contracts, error } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        status,
        client_email,
        client_name,
        admin_reviewed_at,
        created_at,
        hunt_id,
        hunt:calendar_events(
          id,
          title,
          species,
          unit,
          start_time,
          end_time,
          hunt_code,
          guide_username,
          camp_name
        )
      `)
      .eq("outfitter_id", outfitterId)
      .eq("status", "ready_for_signature")
      .order("admin_reviewed_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contracts: contracts || [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
