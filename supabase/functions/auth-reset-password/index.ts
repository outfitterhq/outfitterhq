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

    console.log("[auth-reset-password] Password reset link generated successfully");
    console.log("[auth-reset-password] Link preview (first 50 chars):", resetLink.substring(0, 50) + "...");

    // Send email via Resend API directly (same as other invite functions)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    console.log("[auth-reset-password] RESEND_API_KEY:", resendApiKey ? "SET" : "NOT SET");

    if (resendApiKey) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1a472a;">Reset Your Password</h1>
              <p>You requested to reset your password for your Outfitter HQ account.</p>
              <p>Click the button below to reset your password:</p>
              <p style="margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #1a472a; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 14px;">${resetLink}</p>
              <p style="margin-top: 30px; color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            </body>
          </html>
        `;

        const emailBody = {
          from: "OutfitterHQ <noreply@outfitterhq.app>",
          to: [email], // Resend expects array
          subject: "Reset Your Password - Outfitter HQ",
          html: emailHtml,
        };

        console.log("[auth-reset-password] Sending email via Resend to:", email);
        console.log("[auth-reset-password] Email body:", JSON.stringify({ ...emailBody, html: "[HTML content]" }, null, 2));

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailBody),
        });

        const resendData = await resendRes.json();

        if (!resendRes.ok) {
          console.error("[auth-reset-password] ERROR sending email via Resend:", {
            status: resendRes.status,
            statusText: resendRes.statusText,
            response: resendData,
          });

          const isDomainError = resendData.message?.includes("verify a domain") || 
                                resendData.message?.includes("testing emails");

          if (isDomainError) {
            console.warn("[auth-reset-password] Resend domain not verified - link generated but email not sent");
            return json(200, {
              success: true,
              message: "Password reset link generated. Email not sent: Resend domain not verified. Verify your domain at resend.com/domains or send the link manually.",
              warning: "To send emails automatically, verify a domain in Resend",
            });
          }

          return json(500, {
            error: "Failed to send email via Resend",
            details: resendData.message || "Unknown error",
          });
        }

        console.log("[auth-reset-password] ✅ Email sent via Resend to:", email);
        console.log("[auth-reset-password] Resend email ID:", resendData.id);
      } catch (emailErr) {
        console.error("[auth-reset-password] ERROR calling Resend API:", emailErr);
        return json(500, {
          error: "Failed to send email",
          details: String(emailErr),
        });
      }
    } else {
      console.warn("[auth-reset-password] RESEND_API_KEY not set, cannot send email");
      return json(200, {
        success: true,
        message: "Password reset link generated but email not sent. Set RESEND_API_KEY in Edge Function secrets.",
        warning: "Set RESEND_API_KEY secret in Supabase Dashboard → Edge Functions → auth-reset-password → Settings → Secrets",
      });
    }

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
