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
        hint: "Go to Supabase Dashboard → Edge Functions → admin-invite-cook → Settings → Secrets",
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
    const app_confirm_url_final = `${baseUrl}/cook/accept-invite`;

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
          role: "cook",
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
              role: "cook",
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

    // ALWAYS upsert membership row (onConflict must match DB unique constraint order)
    const nowIso = new Date().toISOString();
    const { error: upsertErr } = await admin
      .from("outfitter_memberships")
      .upsert(
        {
          user_id: targetUserId,
          outfitter_id,
          role: "cook",
          status: "invited",
          invited_at: nowIso,
          invited_by: caller.id,
        },
        { onConflict: "user_id,outfitter_id" }
      );

    if (upsertErr) return json(500, { error: "Failed to upsert membership", details: upsertErr.message });

    // Also create/update cook_profile (link by email since we don't have user_id yet)
    // We'll update it with user_id later when the cook accepts the invite
    const { error: profileErr } = await admin
      .from("cook_profiles")
      .upsert(
        {
          outfitter_id,
          name: name || email,
          contact_email: email,
          updated_at: nowIso,
        },
        { 
          onConflict: "outfitter_id,contact_email",
          ignoreDuplicates: false
        }
      );

    // Profile error is non-fatal, just log it
    if (profileErr) {
      console.error("Failed to upsert cook profile:", profileErr);
    }

    // Send email via Resend API directly
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    console.log("[admin-invite-cook] RESEND_API_KEY:", resendApiKey ? "SET" : "NOT SET");
    
    let inviteSent = false;
    
    if (resendApiKey) {
      try {
        const emailSubject = `You've been invited as a Cook - ${name || "Join OutfitterHQ"}`;
        
        const emailBody = {
          from: "OutfitterHQ <noreply@outfitterhq.app>",
          to: [email],
          subject: emailSubject,
          html: `
            <h2>You've been invited as a Cook</h2>
            <p>Hello${name ? ` ${name}` : ""},</p>
            <p>You've been invited to join OutfitterHQ as a cook. Click the link below to accept your invitation:</p>
            <p><a href="${invite_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Accept Invitation</a></p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${invite_link}</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          `,
          text: `You've been invited as a Cook. Click this link to accept: ${invite_link}`,
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
          console.error("[admin-invite-cook] ERROR sending email via Resend:", {
            status: resendRes.status,
            statusText: resendRes.statusText,
            response: resendData,
            email: email,
            from: emailBody.from
          });
          
          // If it's a domain verification error, return the link anyway with helpful message
          const isDomainError = resendData.message?.includes("verify a domain") || 
                                resendData.message?.includes("testing emails");
          
          if (isDomainError) {
            console.warn("[admin-invite-cook] Resend domain not verified - returning link for manual sending");
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
        console.log("[admin-invite-cook] ✅ Email sent via Resend to:", email);
        console.log("[admin-invite-cook] Resend email ID:", resendData.id);
        console.log("[admin-invite-cook] Resend response:", JSON.stringify(resendData, null, 2));
      } catch (emailErr) {
        console.error("[admin-invite-cook] ERROR calling Resend API:", emailErr);
        return json(200, { 
          ok: true,
          invite_link,
          email_sent: false,
          error: "Failed to send email", 
          details: String(emailErr),
          message: "Invite link generated but email not sent. You can send the link manually.",
          outfitter_id,
          invited_user_id: targetUserId
        });
      }
    } else {
      console.warn("[admin-invite-cook] RESEND_API_KEY not set, cannot send email");
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

    return json(200, { 
      ok: true, 
      invite_link,
      email_sent: inviteSent,
      outfitter_id, 
      invited_user_id: targetUserId,
      message: inviteSent 
        ? "Email sent successfully" 
        : "Invite link generated but email not sent"
    });
  } catch (err) {
    return json(500, { error: "Unhandled error", details: String(err) });
  }
});
