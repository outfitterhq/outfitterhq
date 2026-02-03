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
    const phone = String(body.phone ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const password = String(body.password ?? "").trim();
    const username = String(body.username ?? email).trim().toLowerCase();

    if (!outfitter_id) return json(400, { error: "outfitter_id is required" });
    if (!email) return json(400, { error: "email is required" });
    if (!isValidEmail(email)) return json(400, { error: "Invalid email address", email });
    if (!password || password.length < 8) return json(400, { error: "Password is required and must be at least 8 characters" });
    if (!name || name.length < 2) return json(400, { error: "Name is required and must be at least 2 characters" });

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

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => (u.email || "").toLowerCase() === email);

    if (existingUser) {
      return json(400, { 
        error: "User with this email already exists",
        hint: "Use admin-invite-guide to send an invite to existing users"
      });
    }

    // 1) Create Auth user (source of truth)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { 
        full_name: name,
        username: username,
      },
    });

    if (createErr || !created?.user) {
      return json(500, { 
        error: "Auth createUser failed", 
        details: createErr?.message ?? "unknown" 
      });
    }

    const userId = created.user.id;

    // 2) Insert guide row (must reference auth.users.id)
    const { data: inserted, error: insErr } = await admin
      .from("guides")
      .insert({
        user_id: userId,
        outfitter_id: outfitter_id,
        email,
        name,
        phone,
        notes: notes || null,
        username: username || email,
        is_active: true,
      })
      .select("*")
      .single();

    if (insErr) {
      // Rollback: delete auth user if guide insert fails
      await admin.auth.admin.deleteUser(userId, { shouldSoftDelete: false });
      
      return json(500, { 
        error: "Guide insert failed; auth rolled back", 
        details: insErr.message 
      });
    }

    // 3) Create membership row
    const nowIso = new Date().toISOString();
    const { error: memInsErr } = await admin
      .from("outfitter_memberships")
      .insert({
        user_id: userId,
        outfitter_id: outfitter_id,
        role: "guide",
        status: "active",
        invited_at: nowIso,
        invited_by: caller.id,
      });

    if (memInsErr) {
      console.warn("Failed to create membership (non-fatal):", memInsErr.message);
      // Don't fail - membership can be created later
    }

    return json(200, { 
      ok: true,
      guide: {
        id: inserted.id,
        user_id: inserted.user_id,
        outfitter_id: inserted.outfitter_id,
        name: inserted.name,
        email: inserted.email,
        phone: inserted.phone,
        username: inserted.username,
        is_active: inserted.is_active,
        notes: inserted.notes,
      }
    });
  } catch (err) {
    return json(500, { error: "Unhandled error", details: String(err) });
  }
});
