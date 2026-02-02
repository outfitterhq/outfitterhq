"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

function isAdminRole(role: string) {
  return role === "owner" || role === "admin";
}

export default function InviteCookCard() {
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
              tip: "You likely opened a cook invite link in this browser and your session flipped to cook. Use incognito for cook links, or log back in as owner/admin.",
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

      const fnUrl = `${base}/functions/v1/admin-invite-cook`;

      // Get production web app URL from environment variable, fallback to current origin
      // This ensures invite links always point to production, not localhost or preview URLs
      const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || window.location.origin;

      // Redirect URL includes outfitter_id so the cook lands with the correct outfitter (the one who sent the invite)
      const payload = {
        outfitter_id,
        email: e,
        name: n || null,
        app_confirm_url: `${webAppUrl}/cook/accept-invite?outfitter_id=${encodeURIComponent(outfitter_id)}`,
      };

      const r = await fetch(fnUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await r.json();

      if (!r.ok) {
        const detail = result.details ? ` — ${result.details}` : "";
        setMsg(`Invite failed: ${result.error || "Unknown error"}${detail}`);
        return;
      }

      setInviteLink(result.invite_link || null);
      setEmail("");
      setName("");
      setMsg("✅ Cook invite sent! Check the email for the invite link.");
    } catch (err: any) {
      setMsg(`Error: ${err.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, backgroundColor: "#f9f9f9" }}>
      <h3 style={{ marginTop: 0 }}>Invite Cook</h3>
      <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
        Send an invite to create a cook account. The cook will receive an email with a link to set up their account.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
            Email <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cook@example.com"
            disabled={busy}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 500 }}>Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cook Name"
            disabled={busy}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: 14,
            }}
          />
        </div>

        <button
          onClick={invite}
          disabled={busy || !email.trim()}
          style={{
            padding: "10px 16px",
            backgroundColor: busy ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: busy || !email.trim() ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {busy ? "Sending..." : "Send Invite"}
        </button>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            backgroundColor: msg.includes("✅") ? "#d4edda" : "#f8d7da",
            border: `1px solid ${msg.includes("✅") ? "#c3e6cb" : "#f5c6cb"}`,
            borderRadius: 4,
            fontSize: 14,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </div>
      )}

      {inviteLink && (
        <div style={{ marginTop: 12, padding: 12, backgroundColor: "#e7f3ff", border: "1px solid #b3d9ff", borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Invite Link (copy to share):</p>
          <code
            style={{
              display: "block",
              padding: 8,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: 12,
              wordBreak: "break-all",
            }}
          >
            {inviteLink}
          </code>
        </div>
      )}
    </div>
  );
}
