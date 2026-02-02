"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function isAdminRole(role: string) {
  return role === "owner" || role === "admin";
}

export default function InviteGuideCard() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function invite() {
    setMsg(null);
    setInviteLink(null);

    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!e) return setMsg("Email is required.");

    // Get outfitter ID from server (can't read httpOnly cookie from client)
    let outfitter_id: string | null = null;
    try {
      const res = await fetch("/api/tenant/current");
      if (res.ok) {
        const data = await res.json();
        outfitter_id = data.outfitter_id;
        // If auto-set, reload to pick up the cookie
        if (data.auto_set) {
          window.location.reload();
          return;
        }
        if (data.needs_selection) {
          return setMsg("Please select an outfitter first. Go to Settings or select from the menu.");
        }
      }
    } catch (err) {
      console.error("Failed to get outfitter:", err);
      return setMsg("Failed to get outfitter. Please refresh the page.");
    }

    if (!outfitter_id) {
      return setMsg("No outfitter selected. Please select an outfitter first.");
    }

    setBusy(true);

    try {
      // ✅ TRUTH SOURCE: browser session (same token Edge Function will see)
      const { data: sessData } = await supabase.auth.getSession();
      const session = sessData?.session;

      if (!session) {
        setMsg("Not logged in in this browser session. Log in again, then retry.");
        return;
      }

      const userId = session.user.id;

      // ✅ TRUTH SOURCE: membership via RLS under current token
      const { data: m, error: memErr } = await supabase
        .from("outfitter_memberships")
        .select("role,status")
        .eq("outfitter_id", outfitter_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (memErr) {
        setMsg(`Membership check failed: ${memErr.message}`);
        return;
      }

      const role = String(m?.role ?? "");
      const status = String(m?.status ?? "");

      if (!(status === "active" || status === "invited") || !isAdminRole(role)) {
        setMsg(
          JSON.stringify(
            {
              error: "Invite blocked: not owner/admin session",
              role,
              status,
              tip: "You likely opened a guide invite link in this browser and your session flipped to guide. Use incognito for guide links, or log back in as owner/admin.",
            },
            null,
            2
          )
        );
        return;
      }

      // ✅ Now safe to call admin Edge Function with the same session token
      const token = session.access_token;

      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!base) return setMsg("Missing NEXT_PUBLIC_SUPABASE_URL");

      const fnUrl = `${base}/functions/v1/admin-invite-guide`;

      // Get production web app URL from environment variable
      // In production, this MUST be set to avoid localhost links
      const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || window.location.origin;
      
      // Warn if using localhost in what appears to be production
      if (webAppUrl.includes('localhost') || webAppUrl.includes('127.0.0.1')) {
        console.warn('⚠️ Invite link will use localhost. Set NEXT_PUBLIC_WEB_APP_URL in Vercel environment variables.');
      }
      
      // Redirect URL includes outfitter_id so the guide lands with the correct outfitter (the one who sent the invite)
      const payload = {
        outfitter_id,
        email: e,
        name: n || null,
        app_confirm_url: `${webAppUrl}/guide/accept-invite?outfitter_id=${encodeURIComponent(outfitter_id)}`,
      };

      const r = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const raw = await r.text();
      let body: any = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = { raw };
      }

      if (!r.ok) {
        setMsg(JSON.stringify({ http_status: r.status, ...body }, null, 2));
        return;
      }

      const link = body?.invite_link ?? null;
      if (!link) {
        setMsg(JSON.stringify({ error: "No invite_link returned", body }, null, 2));
        return;
      }

      setInviteLink(link);
      setMsg("Invite created. Open the invite link below.");
      setEmail("");
      setName("");
    } catch (err: any) {
      setMsg(`Invite failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
      <h2 style={{ marginTop: 0 }}>Invite guide</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
        <input
          placeholder="Guide name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          placeholder="Guide email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <button
          type="button"
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            invite();
          }}
          disabled={busy}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          {busy ? "Sending…" : "Invite"}
        </button>
      </div>

      {msg && (
        <pre
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background: "#111",
            color: "#eee",
            overflowX: "auto",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </pre>
      )}

      {inviteLink && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Invite link:</div>
          <a href={inviteLink} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>
            {inviteLink}
          </a>
        </div>
      )}

      <p style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        Membership + role is checked using the CURRENT browser session token (authoritative).
      </p>
    </section>
  );
}
