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

    // Optional fields (profiles)
    const phone = s(body.phone);
    const address_line1 = s(body.address_line1);
    const address_line2 = s(body.address_line2);
    const city = s(body.city);
    const state = s(body.state);
    const zip = s(body.zip);

    // Optional guide fields
    const notes = s(body.notes);

    const vehicle_year = s(body.vehicle_year);
    const vehicle_make = s(body.vehicle_make);
    const vehicle_model = s(body.vehicle_model);
    const vehicle_color = s(body.vehicle_color);
    const vehicle_plate = s(body.vehicle_plate);

    const has_guide_license = Boolean(body.has_guide_license ?? false);
    const has_cpr_card = Boolean(body.has_cpr_card ?? false);
    const has_leave_no_trace = Boolean(body.has_leave_no_trace ?? false);

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

    // Membership must be guide invited/active
    const { data: mem, error: memErr } = await admin
      .from("outfitter_memberships")
      .select("role,status")
      .eq("outfitter_id", outfitter_id)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (memErr) return json(500, { error: "Membership lookup failed", details: memErr.message });

    const role = lower(mem?.role);
    const status = lower(mem?.status);

    const isGuide = role === "guide";
    const canComplete = status === "invited" || status === "active";

    if (!mem || !isGuide || !canComplete) {
      return json(403, {
        error: "Not allowed to complete onboarding",
        debug: { role, status, caller_id: caller.id, outfitter_id },
      });
    }

    // 1) Upsert profile
    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: caller.id,
          full_name,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip,
        },
        { onConflict: "id" }
      );

    if (profErr) return json(500, { error: "Failed to upsert profile", details: profErr.message });

    // 2) Upsert guide row
    const guidePayload: any = {
      outfitter_id,
      user_id: caller.id,
      email: (caller.email || "").toLowerCase(),
      name: full_name,
      is_active: true,
      notes,

      vehicle_year,
      vehicle_make,
      vehicle_model,
      vehicle_color,
      vehicle_plate,

      has_guide_license,
      has_cpr_card,
      has_leave_no_trace,

      updated_at: new Date().toISOString(),
    };

    // NOTE: this assumes you either have a unique constraint on guides.user_id OR you want multiple guides per user.
    // If you don't have a unique on user_id, this becomes an insert and you should update by user_id instead.
    const { error: guideErr } = await admin
      .from("guides")
      .upsert(guidePayload, { onConflict: "user_id" });

    if (guideErr) return json(500, { error: "Failed to upsert guide", details: guideErr.message });

    // 3) Accept membership
    const { error: accErr } = await admin
      .from("outfitter_memberships")
      .update({ status: "active", accepted_at: new Date().toISOString() })
      .eq("outfitter_id", outfitter_id)
      .eq("user_id", caller.id);

    if (accErr) return json(500, { error: "Failed to accept membership", details: accErr.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: "Unhandled error", details: String(err) });
  }
});
