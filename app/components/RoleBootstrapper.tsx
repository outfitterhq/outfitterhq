"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function isAdminRole(role: string) {
  return role === "owner" || role === "admin";
}

function isAdminArea(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/guides") ||
    pathname.startsWith("/documents") ||
    pathname.startsWith("/permits") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/private-land-tags") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/guide-portal-access") ||
    pathname.startsWith("/select-outfitter")
  );
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Admin-shell ejector (client-truth) with GRACE PERIOD:
 * - Don't redirect to /login immediately if session isn't ready yet.
 */
export default function RoleBootstrapper() {
  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    let noSessionCount = 0; // grace counter

    async function tick() {
      try {
        if (!isAdminArea(window.location.pathname)) return;

        // Try to refresh session first
        const { data: sessData, error: sessError } = await supabase.auth.getSession();
        
        // If no session, try to refresh from storage
        if (!sessData?.session) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session) {
            // Session refreshed, continue
            noSessionCount = 0;
            return;
          }
        }

        const session = sessData?.session;

        if (!session) {
          // Grace: wait more ticks before redirecting (give time for refresh)
          noSessionCount += 1;
          // Only redirect after 6 checks (30 seconds total with 5s interval)
          if (noSessionCount >= 6) {
            console.log("No session found after 30 seconds, redirecting to login");
            window.location.replace("/login");
          }
          return;
        }

        // session is present => reset grace counter
        noSessionCount = 0;

        const outfitterId = readCookie("hc_outfitter");
        if (!outfitterId) {
          if (!window.location.pathname.startsWith("/select-outfitter")) {
            window.location.replace("/select-outfitter");
          }
          return;
        }

        const userId = session.user.id;

        const { data: m, error } = await supabase
          .from("outfitter_memberships")
          .select("role,status")
          .eq("outfitter_id", outfitterId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error || !m) {
          window.location.replace("/select-outfitter");
          return;
        }

        const role = String(m.role ?? "");
        const status = String(m.status ?? "");

        const okStatus = status === "active" || status === "invited";
        if (!okStatus) {
          window.location.replace("/select-outfitter");
          return;
        }

        if (!isAdminRole(role)) {
          window.location.replace("/guide");
          return;
        }
      } catch {
        // ignore
      }
    }

    tick();

    // Check less frequently to avoid race conditions
    const id = setInterval(() => {
      if (!alive) return;
      tick();
    }, 5000); // Changed from 2000ms to 5000ms (5 seconds)

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return null;
}
