import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

const Body = z.object({ outfitter_id: z.string().uuid() });

export async function POST(req: Request) {
  const form = Object.fromEntries((await req.formData()).entries());
  const parsed = Body.safeParse(form);
  if (!parsed.success) return NextResponse.redirect(new URL("/select-outfitter?e=invalid", req.url));

  const supabase = await supabaseRoute();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: mem } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id,status")
    .eq("outfitter_id", parsed.data.outfitter_id)
    .eq("user_id", userRes.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!mem) return NextResponse.redirect(new URL("/select-outfitter?e=forbidden", req.url));

  (await cookies()).set(OUTFITTER_COOKIE, mem.outfitter_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
