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
    // Redirect directly to accept-invite page - Supabase will put tokens in hash fragment
    // The accept-invite page will handle token verification directly from the hash
    console.log("[admin-invite-guide] Using production URL:", baseUrl);

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

    // Redirect directly to accept-invite page - it will handle auth tokens from the invite link
    const emailRedirectTo = `${baseUrl}/guide/accept-invite?outfitter_id=${encodeURIComponent(outfitter_id)}`;

    // Generate invite/recovery link and send email via Resend directly
    // This gives us full control and doesn't rely on Supabase's email sending
    let targetUserId: string | null = null;
    const existingUser = await findUserIdByEmail(admin, email);
    
    let inviteSent = false;
    let invite_link: string | null = null;

    // Generate the appropriate link (invite for new users, recovery for existing)
    const linkType = existingUser ? "recovery" : "invite";
    console.log(`[admin-invite-guide] User ${existingUser ? "exists" : "doesn't exist"}, generating ${linkType} link for:`, email);
    
    const linkRes = await admin.auth.admin.generateLink({
      type: linkType,
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

    if (linkRes.error) {
      console.error("[admin-invite-guide] ERROR generating link:", linkRes.error);
      return json(500, { error: "Failed to generate invite link", details: linkRes.error.message });
    }

    invite_link = linkRes.data?.properties?.action_link ?? null;
    targetUserId = linkRes.data?.user?.id ?? existingUser;

    if (!invite_link) {
      return json(500, { error: "Invite link missing from Supabase response" });
    }

    if (!targetUserId) {
      targetUserId = await findUserIdByEmail(admin, email);
      if (!targetUserId) {
        return json(500, { error: "User lookup returned null" });
      }
    }

    // Send email via Resend API directly
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      try {
        const emailSubject = existingUser 
          ? `Guide Invitation - ${name || "Join OutfitterHQ"}`
          : `You've been invited as a Guide - ${name || "Join OutfitterHQ"}`;
        
        const emailBody = {
          from: "OutfitterHQ <noreply@outfitterhq.app>",
          to: [email],
          subject: emailSubject,
          html: `
            <h2>You've been invited as a Guide</h2>
            <p>Hello${name ? ` ${name}` : ""},</p>
            <p>You've been invited to join OutfitterHQ as a guide. Click the link below to accept your invitation:</p>
            <p><a href="${invite_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Accept Invitation</a></p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${invite_link}</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          `,
          text: `You've been invited as a Guide. Click this link to accept: ${invite_link}`,
        };

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
          console.error("[admin-invite-guide] ERROR sending email via Resend:", resendData);
          
          // If it's a domain verification error, return the link anyway with helpful message
          const isDomainError = resendData.message?.includes("verify a domain") || 
                                resendData.message?.includes("testing emails");
          
          if (isDomainError) {
            console.warn("[admin-invite-guide] Resend domain not verified - returning link for manual sending");
            return json(200, {
              ok: true,
              invite_link,
              email_sent: false,
              message: "Email not sent: Resend domain not verified. The invite link has been generated - you can send it manually or verify your domain at resend.com/domains",
              warning: "To send emails automatically, verify a domain in Resend and update the 'from' address in the Edge Function code",
              outfitter_id,
              invited_user_id: targetUserId
            });
          }
          
          // Other Resend errors - still return the link
          return json(200, { 
            ok: true,
            invite_link,
            email_sent: false,
            error: "Failed to send email via Resend", 
            details: resendData.message || "Unknown error",
            message: "Invite link generated but email not sent. You can send the link manually.",
            outfitter_id,
            invited_user_id: targetUserId
          });
        }

        inviteSent = true;
        console.log("[admin-invite-guide] ✅ Email sent via Resend to:", email);
        console.log("[admin-invite-guide] Resend email ID:", resendData.id);
      } catch (emailErr) {
        console.error("[admin-invite-guide] ERROR calling Resend API:", emailErr);
        return json(500, { 
          error: "Failed to send email", 
          details: String(emailErr),
          invite_link: invite_link // Still return the link
        });
      }
    } else {
      console.warn("[admin-invite-guide] RESEND_API_KEY not set, cannot send email");
      // Still return success with the link - user can send it manually
      return json(200, {
        ok: true,
        invite_link,
        email_sent: false,
        message: "Invite link generated but email not sent. Set RESEND_API_KEY in Edge Function secrets.",
        outfitter_id,
        invited_user_id: targetUserId
      });
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
        ? "Email sent successfully" 
        : (existingUser ? "Recovery link generated. Email may not have been sent - check RESEND_API_KEY in Edge Function secrets." : "Invite email sent successfully")
    });
  } catch (err) {
    return json(500, { error: "Unhandled error", details: String(err) });
  }
});
