import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/** GET /api/guides/list - Same logic as /api/guides (Guide Portal Access).
 * Uses guides table first, then outfitter_memberships fallback.
 * Returns guides with name, email, status for "Current guides" UI.
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
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    // 1) Same as /api/guides: try guides table first
    const { data: guideRows, error: guideError } = await supabase
      .from("guides")
      .select("user_id, email, name, is_active")
      .eq("outfitter_id", outfitterId)
      .eq("is_active", true);

    let guides: Array<{ user_id: string; outfitter_id: string; role: string; status: string; created_at: string | null; name: string; email: string }> = [];

    if (!guideError && guideRows && guideRows.length > 0) {
      // Build from guides table (same source as Guide Portal Access)
      guides = guideRows.map((g: any) => ({
        user_id: g.user_id,
        outfitter_id: outfitterId,
        role: "guide",
        status: "active",
        created_at: null,
        name: g.name ?? g.email ?? `User ${String(g.user_id).slice(0, 8)}`,
        email: g.email ?? "",
      }));
    } else {
      // 2) Fallback: outfitter_memberships (like /api/guides)
      const { data: rows, error: memErr } = await supabase
        .from("outfitter_memberships")
        .select("user_id, outfitter_id, role, status")
        .eq("outfitter_id", outfitterId)
        .eq("role", "guide");

      if (memErr) {
        return NextResponse.json({ error: memErr.message }, { status: 500 });
      }

      const memberships = rows ?? [];
      if (memberships.length === 0) {
        return NextResponse.json({ guides: [], outfitter_id: outfitterId }, { status: 200 });
      }

      const userIds = memberships.map((r: any) => r.user_id);

      // Profiles for names
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const profiles: Record<string, string> = {};
      for (const p of profileRows ?? []) {
        const row = p as { id: string; full_name?: string | null };
        if (row.full_name) profiles[row.id] = row.full_name;
      }

      // Guides table for email/name (may have partial rows)
      const { data: gRows } = await supabase
        .from("guides")
        .select("user_id, email, name")
        .in("user_id", userIds)
        .eq("outfitter_id", outfitterId);
      const byUser: Record<string, { email: string; name: string | null }> = {};
      for (const g of gRows ?? []) {
        const row = g as { user_id: string; email?: string; name?: string | null };
        byUser[row.user_id] = { email: row.email ?? "", name: row.name ?? null };
      }

      guides = memberships.map((m: any) => {
        const p = profiles[m.user_id];
        const g = byUser[m.user_id];
        const name = p || g?.name || `User ${String(m.user_id).slice(0, 8)}`;
        const email = g?.email ?? "";
        return {
          user_id: m.user_id,
          outfitter_id: m.outfitter_id,
          role: m.role,
          status: m.status,
          created_at: (m as any).created_at ?? null,
          name,
          email,
        };
      });
    }

    return NextResponse.json({ guides, outfitter_id: outfitterId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
