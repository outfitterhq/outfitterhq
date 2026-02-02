import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Supabase may send ?code=... (PKCE) or redirect here when invite link doesn't match allowed URLs
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next"); // optional: /cook/accept-invite or /guide/accept-invite

  const supabase = await supabaseRoute();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const redirectUrl = new URL("/login", url.origin);
      redirectUrl.searchParams.set("e", error.message);
      return NextResponse.redirect(redirectUrl);
    }
    // If user has cook or guide invite, send to the right accept-invite page
    if (data?.user?.id) {
      const { data: memberships } = await supabase
        .from("outfitter_memberships")
        .select("role, outfitter_id")
        .eq("user_id", data.user.id)
        .in("status", ["active", "invited"]);
      const list = (memberships ?? []) as { role?: string; outfitter_id?: string }[];
      const cookMem = list.find((m) => m.role === "cook");
      const guideMem = list.find((m) => m.role === "guide");
      if (cookMem) {
        const to = new URL("/cook/accept-invite", url.origin);
        if (cookMem.outfitter_id) to.searchParams.set("outfitter_id", cookMem.outfitter_id);
        return NextResponse.redirect(to);
      }
      if (guideMem) {
        const to = new URL("/guide/accept-invite", url.origin);
        if (guideMem.outfitter_id) to.searchParams.set("outfitter_id", guideMem.outfitter_id);
        return NextResponse.redirect(to);
      }
    }
    if (next) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // If no code, still redirect—Supabase might have already set cookies in some flows
  return NextResponse.redirect(new URL("/select-outfitter", url.origin));
}
