import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabasePage } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

const ROLE_COOKIE = "hc_role";

export async function POST() {
  const store = await cookies();
  const outfitterId = store.get(OUTFITTER_COOKIE)?.value ?? null;

  // IMPORTANT: Use cookie-bound Supabase server client (session-aware)
  const sb = await supabasePage();
  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;

  let role = "";

  if (user && outfitterId) {
    const { data: m } = await sb
      .from("outfitter_memberships")
      .select("role,status")
      .eq("outfitter_id", outfitterId)
      .eq("user_id", user.id)
      .maybeSingle();

    const status = String(m?.status ?? "");
    const r = String(m?.role ?? "");

    // Set role for active OR invited (invite link flips you to guide session)
    if ((status === "active" || status === "invited") && r) role = r;
  }

  store.set(ROLE_COOKIE, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 6,
  });

  return NextResponse.json({ ok: true, role });
}
