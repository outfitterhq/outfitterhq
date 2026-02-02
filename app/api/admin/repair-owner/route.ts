import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export async function POST() {
  try {
    const supabase = await supabaseRoute();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;

    if (!outfitterId) {
      return NextResponse.json({ error: "Missing outfitter cookie" }, { status: 400 });
    }

    const { error: upsertErr } = await supabase
      .from("outfitter_memberships")
      .upsert(
        {
          outfitter_id: outfitterId,
          user_id: user.id,
          role: "owner",
          status: "active",
        },
        { onConflict: "outfitter_id,user_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, outfitter_id: outfitterId, user_id: user.id, role: "owner" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
