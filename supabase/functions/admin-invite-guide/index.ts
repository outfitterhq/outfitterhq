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
    
    // Log for debugging
    console.log("[admin-invite-guide] WEB_APP_URL from env:", webAppUrl ? "SET" : "NOT SET");
    console.log("[admin-invite-guide] Received app_confirm_url from client:", app_confirm_url);
    
    if (!webAppUrl) {
      console.error("[admin-invite-guide] ERROR: WEB_APP_URL secret not set in Supabase Edge Function secrets");
      return json(400, { 
        error: "Production URL not configured. Set WEB_APP_URL in Supabase Edge Function secrets.",
        hint: "Go to Supabase Dashboard → Edge Functions → admin-invite-guide → Settings → Secrets",
        received_app_confirm_url: app_confirm_url,
        debug: "WEB_APP_URL environment variable is not set"
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
    
    console.log("[admin-invite-guide] Using production URL:", app_confirm_url_final);

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

    // Try to invite user - this will send an email automatically if email is configured
    // First check if user already exists
    let targetUserId: string | null = null;
    const existingUser = await findUserIdByEmail(admin, email);
    
    let inviteSent = false;
    let invite_link: string | null = null;

    if (!existingUser) {
      // User doesn't exist - send invite email
      console.log("[admin-invite-guide] User doesn't exist, sending invite email to:", email);
      console.log("[admin-invite-guide] Redirect URL:", emailRedirectTo);
      
      const inviteRes = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: emailRedirectTo,
        data: {
          name: name || null,
          invited_by: caller.id,
          invited_outfitter_id: outfitter_id,
          role: "guide",
        },
      });

      console.log("[admin-invite-guide] inviteUserByEmail response:", {
        hasError: !!inviteRes.error,
        error: inviteRes.error?.message,
        hasUser: !!inviteRes.data?.user,
        userId: inviteRes.data?.user?.id,
        userEmail: inviteRes.data?.user?.email,
      });

      if (inviteRes.error) {
        console.error("[admin-invite-guide] ERROR sending invite email:", inviteRes.error);
        return json(500, { error: "Failed to send invite email", details: inviteRes.error.message });
      }

      inviteSent = true;
      invite_link = inviteRes.data?.user?.email ? "Email sent successfully" : null;
      targetUserId = inviteRes.data?.user?.id ?? null;
      
      console.log("[admin-invite-guide] ✅ Invite email sent successfully to:", email);
      console.log("[admin-invite-guide] Created user ID:", targetUserId);
    } else {
      // User already exists - generate recovery link instead
      targetUserId = existingUser;
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

      if (recRes.error) {
        return json(500, { error: "Failed to generate recovery link", details: recRes.error.message });
      }

      invite_link = recRes.data?.properties?.action_link ?? null;
      console.log("[admin-invite-guide] Recovery link generated for existing user:", email);
    }

    if (!targetUserId) {
      // Fallback: try to find user ID after invite
      targetUserId = await findUserIdByEmail(admin, email);
      if (!targetUserId) {
        return json(500, { error: "User lookup returned null after invite" });
      }
    }

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

    return json(200, { 
      ok: true, 
      invite_link: invite_link || (inviteSent ? "Email sent successfully" : null),
      email_sent: inviteSent,
      outfitter_id, 
      invited_user_id: targetUserId,
      message: inviteSent 
        ? "Invite email sent successfully" 
        : "Recovery link generated for existing user"
    });
  } catch (err) {
    return json(500, { error: "Unhandled error", details: String(err) });
  }
});
