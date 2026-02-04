/// <reference types="https://deno.land/x/types/index.d.ts" />

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function lower(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function s(v: unknown) {
  const out = String(v ?? "").trim();
  return out.length ? out : null;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) {
      return json(500, { error: "Missing Supabase env vars" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing Authorization bearer token" });
    }

    const body = await req.json().catch(() => ({} as any));

    const outfitter_id = String(body.outfitter_id ?? "").trim();
    const full_name = String(body.full_name ?? "").trim();

    if (!outfitter_id) return json(400, { error: "outfitter_id is required" });
    if (!full_name) return json(400, { error: "full_name is required" });

    // Optional fields
    const phone = s(body.phone);

    // Caller client (JWT scoped)
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return json(401, { error: "Unauthorized", details: callerErr?.message ?? null });
    }
    const caller = callerData.user;

    // Admin client (service role)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check if membership exists (invited or active)
    const { data: mem, error: memErr } = await admin
      .from("outfitter_memberships")
      .select("role,status")
      .eq("outfitter_id", outfitter_id)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (memErr) {
      console.error("Membership lookup error:", memErr);
      return json(500, { error: "Membership lookup failed", details: memErr.message });
    }

    const role = lower(mem?.role);
    const status = lower(mem?.status);

    const isCook = role === "cook";
    const canComplete = status === "invited" || status === "active";

    // If no membership exists, create it (this can happen if invite didn't create it)
    if (!mem) {
      console.log("No membership found, creating cook membership for user:", caller.id);
      const { error: createErr } = await admin
        .from("outfitter_memberships")
        .insert({
          user_id: caller.id,
          outfitter_id: outfitter_id,
          role: "cook",
          status: "active",
          accepted_at: new Date().toISOString(),
        });

      if (createErr) {
        console.error("Failed to create membership:", createErr);
        return json(500, { error: "Failed to create membership", details: createErr.message });
      }
      console.log("✅ Cook membership created");
    } else if (!isCook || !canComplete) {
      return json(403, {
        error: "Not allowed to complete onboarding",
        debug: { role, status, caller_id: caller.id, outfitter_id },
      });
    } else {
      // Update existing membership to active
      const { error: updateErr } = await admin
        .from("outfitter_memberships")
        .update({
          status: "active",
          accepted_at: new Date().toISOString(),
        })
        .eq("outfitter_id", outfitter_id)
        .eq("user_id", caller.id);

      if (updateErr) {
        return json(500, { error: "Failed to activate membership", details: updateErr.message });
      }
      console.log("✅ Cook membership activated");
    }

    // 1) Upsert profile
    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: caller.id,
          full_name,
          phone,
        },
        { onConflict: "id" }
      );

    if (profErr) {
      console.warn("Profile update error (non-fatal):", profErr);
    }

    // 2) Update cook profile
    const emailLower = (caller.email || "").toLowerCase();
    const { error: cookProfileErr } = await admin
      .from("cook_profiles")
      .update({
        name: full_name,
        contact_phone: phone || null,
        contact_email: emailLower,
      })
      .eq("outfitter_id", outfitter_id)
      .eq("contact_email", emailLower);

    if (cookProfileErr) {
      console.warn("Cook profile update error (non-fatal):", cookProfileErr);
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("Cook onboarding error:", err);
    return json(500, { error: "Unhandled error", details: String(err) });
  }
});
