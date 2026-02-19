import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

function parseCookieHeader(cookieHeader: string | null): { name: string; value: string }[] {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf("=");
      if (i === -1) return { name: kv, value: "" };
      return { name: kv.slice(0, i), value: decodeURIComponent(kv.slice(i + 1)) };
    });
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const incomingCookies = parseCookieHeader(req.headers.get("cookie"));
    const cookieStore = await cookies();
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

    // Create Supabase client that collects cookies
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return incomingCookies;
        },
        setAll(newCookies) {
          // Collect all cookies that Supabase wants to set
          newCookies.forEach((c) => cookiesToSet.push(c));
        },
      },
    });

    const form = await req.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password are required" }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    // Get session to trigger cookie setting
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData?.session) {
      return NextResponse.json({ ok: false, error: "Failed to create session" }, { status: 500 });
    }

    // Create response early so we can set cookies
    let redirectTo = "/dashboard";
    let selectedMembership: any = null;
    const ROLE_COOKIE = "hc_role";

    // Check if user is a client first (clients take priority)
    const { data: clientRecord, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("email", data.user.email)
      .single();

    if (clientErr && clientErr.code !== "PGRST116") {
      console.error("Login: client lookup failed", clientErr);
      return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
    }

    if (clientRecord) {
      // User is a client - redirect to client portal
      redirectTo = "/client";
    } else {

      // Check if user has active memberships (admin/guide/cook)
      const { data: memberships } = await supabase
        .from("outfitter_memberships")
        .select("outfitter_id, role, status")
        .eq("user_id", data.user.id)
        .eq("status", "active");

      const active = (memberships ?? []) as any[];
      
      // CRITICAL: Prioritize admin/owner memberships over guide/cook memberships
      // If user has both admin and guide/cook memberships, select admin one
      const adminMemberships = active.filter((m) => m.role === "owner" || m.role === "admin");
      const guideMemberships = active.filter((m) => m.role === "guide");
      const cookMemberships = active.filter((m) => m.role === "cook");
      
      // Prefer admin memberships, but fall back to guide/cook if that's all they have
      const membershipsToUse = adminMemberships.length > 0 ? adminMemberships : active;
      
      redirectTo = "/select-outfitter";

      // If only one membership (or one admin membership), auto-select it
      if (membershipsToUse.length === 1) {
        selectedMembership = membershipsToUse[0];
        if (adminMemberships.length > 0) {
          redirectTo = "/dashboard";
        } else if (guideMemberships.length > 0) {
          redirectTo = "/guide";
        } else if (cookMemberships.length > 0) {
          redirectTo = "/cook";
        }
      } else if (membershipsToUse.length > 1) {
        // Multiple memberships - prefer admin, or check if one is already selected
        const existing = cookieStore.get(OUTFITTER_COOKIE)?.value;
        const existingMembership = membershipsToUse.find((m) => m.outfitter_id === existing);
        if (existingMembership) {
          selectedMembership = existingMembership;
          if (existingMembership.role === "owner" || existingMembership.role === "admin") {
            redirectTo = "/dashboard";
          } else if (existingMembership.role === "guide") {
            redirectTo = "/guide";
          } else if (existingMembership.role === "cook") {
            redirectTo = "/cook";
          }
        } else if (adminMemberships.length > 0) {
          // Pick first admin membership
          selectedMembership = adminMemberships[0];
          redirectTo = "/dashboard";
        } else if (guideMemberships.length > 0) {
          // Pick first guide membership
          selectedMembership = guideMemberships[0];
          redirectTo = "/guide";
        } else if (cookMemberships.length > 0) {
          // Pick first cook membership
          selectedMembership = cookMemberships[0];
          redirectTo = "/cook";
        }
      }
    }

    // Create response and set ALL cookies (Supabase auth cookies + outfitter cookie + role cookie)
    const response = NextResponse.json({ ok: true, redirect: redirectTo }, { status: 200 });
    
    // Set all Supabase auth cookies - these are critical for session persistence
    for (const c of cookiesToSet) {
      response.cookies.set(c.name, c.value, {
        path: c.options?.path ?? "/",
        httpOnly: c.options?.httpOnly ?? true,
        sameSite: (c.options?.sameSite as "lax" | "strict" | "none") ?? "lax",
        secure: c.options?.secure ?? process.env.NODE_ENV === "production",
        maxAge: c.options?.maxAge ?? 60 * 60 * 24 * 365,
      });
    }

    // Add outfitter cookie and role cookie if auto-selected
    if (selectedMembership) {
      response.cookies.set(OUTFITTER_COOKIE, selectedMembership.outfitter_id, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      
      response.cookies.set(ROLE_COOKIE, selectedMembership.role, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 6, // 6 hours
      });
    }
    
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e ?? "Unknown server error") },
      { status: 500 }
    );
  }
}
