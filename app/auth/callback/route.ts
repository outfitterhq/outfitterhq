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

  // Check if user has session (even without code, Supabase might have set cookies)
  const { data: userRes } = await supabase.auth.getUser();
  
  // If we have a next parameter, use it (especially for accept-invite pages)
  if (next) {
    const nextUrl = new URL(next, url.origin);
    // Preserve outfitter_id from current URL if present
    const outfitterId = url.searchParams.get("outfitter_id");
    if (outfitterId) {
      nextUrl.searchParams.set("outfitter_id", outfitterId);
    }
    
    // If next is an accept-invite page, redirect directly
    // The accept-invite page will handle session verification and token processing
    if (next.includes("accept-invite")) {
      return NextResponse.redirect(nextUrl);
    }
    
    // For other pages, redirect if user has session
    if (userRes?.user) {
      return NextResponse.redirect(nextUrl);
    }
  }

  // If no code and no next, check if user has invited status membership
  // If so, redirect to appropriate accept-invite page (don't send to select-outfitter)
  if (userRes?.user) {
    const { data: memberships } = await supabase
      .from("outfitter_memberships")
      .select("role, outfitter_id, status")
      .eq("user_id", userRes.user.id)
      .in("status", ["active", "invited"]);
    const list = (memberships ?? []) as { role?: string; outfitter_id?: string; status?: string }[];
    
    // Prioritize invited memberships - they need to complete onboarding
    const invitedCookMem = list.find((m) => m.role === "cook" && m.status === "invited");
    const invitedGuideMem = list.find((m) => m.role === "guide" && m.status === "invited");
    
    if (invitedCookMem) {
      const to = new URL("/cook/accept-invite", url.origin);
      if (invitedCookMem.outfitter_id) to.searchParams.set("outfitter_id", invitedCookMem.outfitter_id);
      return NextResponse.redirect(to);
    }
    if (invitedGuideMem) {
      const to = new URL("/guide/accept-invite", url.origin);
      if (invitedGuideMem.outfitter_id) to.searchParams.set("outfitter_id", invitedGuideMem.outfitter_id);
      return NextResponse.redirect(to);
    }
    
    // If no invited memberships, check for active ones (existing users)
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

  // If no code and no next, still redirect—Supabase might have already set cookies in some flows
  return NextResponse.redirect(new URL("/select-outfitter", url.origin));
}
