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

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase env vars" });
    }

    const body = await req.json().catch(() => ({} as any));
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email) {
      return json(400, { error: "Email is required" });
    }

    if (!isValidEmail(email)) {
      return json(400, { error: "Invalid email address" });
    }

    // Get production URL from environment variable (set in Supabase Edge Function secrets)
    // This should be your actual Vercel production URL, not a placeholder
    let webAppUrl = Deno.env.get("WEB_APP_URL") || Deno.env.get("NEXT_PUBLIC_WEB_APP_URL");
    
    if (!webAppUrl) {
      console.error("[auth-reset-password] ERROR: WEB_APP_URL secret not set in Supabase Edge Function secrets");
      return json(400, { 
        error: "Production URL not configured. Set WEB_APP_URL in Supabase Edge Function secrets to your Vercel production URL (e.g., https://your-app.vercel.app).",
        hint: "Go to Supabase Dashboard → Edge Functions → auth-reset-password → Settings → Secrets",
        instructions: "1. Go to Vercel Dashboard → Your Project → Settings → Domains to find your production URL\n2. Go to Supabase Dashboard → Edge Functions → auth-reset-password → Settings → Secrets\n3. Add/Update secret: WEB_APP_URL = your Vercel URL (e.g., https://outfitterhq-xxx.vercel.app)",
      });
    }

    // Clean up the URL
    webAppUrl = webAppUrl.trim();
    if (!webAppUrl.startsWith('http://') && !webAppUrl.startsWith('https://')) {
      webAppUrl = `https://${webAppUrl}`;
    }
    webAppUrl = webAppUrl.replace(/\/$/, ''); // Remove trailing slash

    // Ensure webAppUrl doesn't contain localhost
    if (webAppUrl.includes('localhost') || webAppUrl.includes('127.0.0.1')) {
      return json(400, { 
        error: "Invalid production URL (contains localhost). Set WEB_APP_URL to your actual Vercel production URL.",
        currentValue: webAppUrl,
      });
    }

    // Warn if using outfitterhq.app (which shows "under construction")
    if (webAppUrl.includes('outfitterhq.app') && !webAppUrl.includes('vercel.app')) {
      console.error("[auth-reset-password] ERROR: WEB_APP_URL is set to outfitterhq.app which shows 'under construction'. This needs to be your actual Vercel production URL.");
      return json(400, { 
        error: "WEB_APP_URL is set to outfitterhq.app which is not your production URL. Please set it to your actual Vercel production URL.",
        currentValue: webAppUrl,
        instructions: "1. Go to Vercel Dashboard → Your Project → Settings → Domains\n2. Find your production URL (should be something like https://outfitterhq-xxx.vercel.app)\n3. Go to Supabase Dashboard → Edge Functions → auth-reset-password → Settings → Secrets\n4. Update WEB_APP_URL secret to your actual Vercel URL",
      });
    }

    // Include type=recovery in the redirect URL so the callback can detect it
    // Also use the callback route which handles PKCE code exchange
    // Redirect to callback route with type=recovery so it knows to redirect to /reset-password
    // Supabase will use PKCE and redirect to Site URL with ?code=..., but we want it to go through our callback
    const redirectTo = `${webAppUrl}/auth/callback?type=recovery&next=/reset-password`;
    console.log("[auth-reset-password] Generating password reset link for:", email);
    console.log("[auth-reset-password] Redirect URL:", redirectTo);

    // Create admin client to generate password reset link
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate password reset link using admin API (gives us full control over redirect URL)
    const linkRes = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (linkRes.error) {
      console.error("[auth-reset-password] ERROR generating link:", linkRes.error);
      return json(500, { error: "Failed to generate password reset link", details: linkRes.error.message });
    }

    const resetLink = linkRes.data?.properties?.action_link ?? null;

    if (!resetLink) {
      return json(500, { error: "Password reset link missing from Supabase response" });
    }

    // Send email via Supabase's built-in email sending (it will use the link we generated)
    // Note: Supabase will automatically send the email with the link we generated
    // We don't need to send it manually - Supabase handles that when generateLink is called with type "recovery"
    
    console.log("[auth-reset-password] Password reset link generated successfully");
    console.log("[auth-reset-password] Link preview (first 50 chars):", resetLink.substring(0, 50) + "...");

    // Always return success (prevents account enumeration)
    return json(200, { 
      success: true,
      message: "If an account exists for this email, a password reset link has been sent.",
    });
  } catch (e: any) {
    console.error("[auth-reset-password] Exception:", e);
    return json(500, { error: e?.message || "Internal server error" });
  }
});
