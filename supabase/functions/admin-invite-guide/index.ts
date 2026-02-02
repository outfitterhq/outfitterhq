/// <reference types="https://deno.land/x/types/index.d.ts" />

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function lower(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = (data?.users ?? []).find((u: any) => (u.email || "").toLowerCase() === target);
    if (found?.id) return found.id;
    if (!data?.users?.length) break;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    // ✅ Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase env vars" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing Authorization bearer token" });
    }

    const body = await req.json().catch(() => ({} as any));

    const outfitter_id = String(body.outfitter_id ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const app_confirm_url = String(body.app_confirm_url ?? "").trim();

    if (!outfitter_id) return json(400, { error: "outfitter_id is required" });
    if (!email) return json(400, { error: "email is required" });
    if (!isValidEmail(email)) return json(400, { error: "Invalid email address", email });

    // Get production URL from environment variable (set in Supabase Edge Function secrets)
    // NEVER use app_confirm_url from client - it may contain localhost
    const webAppUrl = Deno.env.get("WEB_APP_URL") || Deno.env.get("NEXT_PUBLIC_WEB_APP_URL");
    
    if (!webAppUrl) {
      return json(400, { 
        error: "Production URL not configured. Set WEB_APP_URL in Supabase Edge Function secrets.",
        hint: "Go to Supabase Dashboard → Edge Functions → admin-invite-guide → Settings → Secrets",
        received_app_confirm_url: app_confirm_url
      });
    }

    // If webAppUrl contains localhost, reject it
    if (webAppUrl.includes("localhost") || webAppUrl.includes("127.0.0.1")) {
      return json(400, {
        error: "Invalid production URL (contains localhost). Set WEB_APP_URL in Supabase Edge Function secrets to your production URL.",
        received: webAppUrl
      });
    }

    // ALWAYS use the production URL from env var, never trust client-provided URL
    const baseUrl = webAppUrl.replace(/\/$/, ""); // Remove trailing slash
    const app_confirm_url_final = `${baseUrl}/guide/accept-invite`;

    // Caller-scoped client (uses JWT)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client (service role)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Identify caller
    const { data: callerData, error: callerErr } = await supabase.auth.getUser();
    if (callerErr || !callerData?.user) {
      return json(401, { error: "Unauthorized", details: callerErr?.message ?? null });
    }
    const caller = callerData.user;

    // Authorization: caller must be active owner/admin for this outfitter
    const { data: membership, error: memErr } = await admin
      .from("outfitter_memberships")
      .select("role,status")
      .eq("outfitter_id", outfitter_id)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (memErr) return json(500, { error: "Membership lookup failed", details: memErr.message });

    const role = lower(membership?.role);
    const status = lower(membership?.status);
    const isOwnerOrAdmin = role === "owner" || role === "admin";
    const isActive = status === "active";

    if (!membership || !isActive || !isOwnerOrAdmin) {
      return json(403, {
        error: "Not authorized (owner/admin required)",
        debug: { caller_id: caller.id, role, status, outfitter_id },
      });
    }

    // Redirect target: use app_confirm_url_final and ensure outfitter_id is included
    const hasOutfitterInUrl = app_confirm_url_final.includes("outfitter_id=");
    const sep = app_confirm_url_final.includes("?") ? "&" : "?";
    const emailRedirectTo = hasOutfitterInUrl 
      ? app_confirm_url_final 
      : app_confirm_url_final + sep + "outfitter_id=" + encodeURIComponent(outfitter_id);

    // Try invite first; if already exists, use recovery
    let linkData: any = null;
    let linkErr: any = null;

    const inviteRes = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: emailRedirectTo,
        data: {
          name: name || null,
          invited_by: caller.id,
          invited_outfitter_id: outfitter_id,
          role: "guide",
        },
      },
    });

    linkData = inviteRes.data;
    linkErr = inviteRes.error;

    if (linkErr) {
      const msg = String(linkErr.message ?? "").toLowerCase();
      const alreadyExists = msg.includes("already") && (msg.includes("registered") || msg.includes("exists"));
      if (alreadyExists) {
        const recRes = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: emailRedirectTo,
            data: {
              name: name || null,
              invited_by: caller.id,
              invited_outfitter_id: outfitter_id,
              role: "guide",
            },
          },
        });
        linkData = recRes.data;
        linkErr = recRes.error;
      }
    }

    if (linkErr) return json(500, { error: "Failed to generate link", details: linkErr.message });

    const invite_link = linkData?.properties?.action_link ?? null;
    if (!invite_link) return json(500, { error: "Invite link missing from Supabase response" });

    // Resolve target user id
    let targetUserId: string | null = linkData?.user?.id ?? null;
    if (!targetUserId) {
      targetUserId = await findUserIdByEmail(admin, email);
    }
    if (!targetUserId) return json(500, { error: "User lookup returned null" });

    // ALWAYS upsert membership row
    const nowIso = new Date().toISOString();
    const { error: upsertErr } = await admin
      .from("outfitter_memberships")
      .upsert(
        {
          user_id: targetUserId,
          outfitter_id,
          role: "guide",
          status: "invited",
          invited_at: nowIso,
          invited_by: caller.id,
        },
        { onConflict: "user_id,outfitter_id" }
      );

    if (upsertErr) return json(500, { error: "Failed to upsert membership", details: upsertErr.message });

    return json(200, { ok: true, invite_link, outfitter_id, invited_user_id: targetUserId });
  } catch (err) {
    return json(500, { error: "Unhandled error", details: String(err) });
  }
});
