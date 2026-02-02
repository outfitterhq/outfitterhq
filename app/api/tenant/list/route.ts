import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;

    console.log("🔵 /api/tenant/list - User:", user?.id, user?.email);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from("outfitter_memberships")
      .select("outfitter_id, role, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    console.log("🔵 /api/tenant/list - Memberships found:", rows?.length ?? 0, "Error:", error?.message);
    
    if (rows && rows.length === 0) {
      // Debug: check if there are ANY memberships for this user (including non-active)
      const { data: allRows } = await supabase
        .from("outfitter_memberships")
        .select("outfitter_id, role, status")
        .eq("user_id", user.id);
      console.log("🔵 /api/tenant/list - All memberships (any status):", allRows);
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ memberships: rows ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
