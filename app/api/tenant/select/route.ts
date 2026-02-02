import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

const ROLE_COOKIE = "hc_role";

export async function GET(req: Request) {
  // Handle GET requests (from layout redirect)
  const url = new URL(req.url);
  const outfitter_id = url.searchParams.get("outfitter_id");
  
  if (!outfitter_id) {
    return NextResponse.redirect(new URL("/select-outfitter?e=invalid", url.origin));
  }

  const supabase = await supabaseRoute();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const { data: membership, error: memErr } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id, status, role")
    .eq("user_id", user.id)
    .eq("outfitter_id", outfitter_id)
    .eq("status", "active")
    .maybeSingle();

  if (memErr || !membership) {
    return NextResponse.redirect(new URL("/select-outfitter?e=forbidden", url.origin));
  }

  const role = String(membership.role ?? "");
  const redirectUrl = new URL("/dashboard", url.origin);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(OUTFITTER_COOKIE, outfitter_id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });

  response.cookies.set(ROLE_COOKIE, role, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 6,
  });

  return response;
}

export async function POST(req: Request) {
  // Handle both JSON and form data
  let outfitter_id: string | null = null;
  const contentType = req.headers.get("content-type");
  
  if (contentType?.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    outfitter_id = body.outfitter_id;
  } else {
    const formData = await req.formData().catch(() => null);
    if (formData) {
      outfitter_id = formData.get("outfitter_id") as string;
    }
  }

  if (!outfitter_id || typeof outfitter_id !== "string") {
    const url = new URL(req.url);
    return NextResponse.redirect(new URL("/select-outfitter?e=invalid", url.origin));
  }

  const supabase = await supabaseRoute();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) {
    const url = new URL(req.url);
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Safety: ensure the user actually has an ACTIVE membership for this outfitter (RLS enforced)
  const { data: membership, error: memErr } = await supabase
    .from("outfitter_memberships")
    .select("outfitter_id, status, role")
    .eq("user_id", user.id)
    .eq("outfitter_id", outfitter_id)
    .eq("status", "active")
    .maybeSingle();

  if (memErr || !membership) {
    const url = new URL(req.url);
    return NextResponse.redirect(new URL("/select-outfitter?e=forbidden", url.origin));
  }

  const role = String(membership.role ?? "");

  // Return JSON response with cookies set (client will redirect)
  const response = NextResponse.json({ ok: true, outfitter_id, role }, { status: 200 });

  // Set cookies on the response
  response.cookies.set(OUTFITTER_COOKIE, outfitter_id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  response.cookies.set(ROLE_COOKIE, role, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 6, // 6 hours
  });

  return response;
}
