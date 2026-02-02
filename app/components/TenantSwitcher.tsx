"use client";

import { useState } from "react";

type Membership = {
  outfitter_id: string;
  outfitter_name: string;
  role: string;
  status: string;
};

export default function TenantSwitcher({ memberships }: { memberships: Membership[] }) {
  const [busy, setBusy] = useState(false);

  async function onChange(outfitter_id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitter_id }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to select outfitter");
        return;
      }

      // Reload so server components read the new cookie
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 14, opacity: 0.9 }}>Outfitter:</span>
      <select
        disabled={busy || memberships.length <= 1}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.3)",
          background: "rgba(255,255,255,0.1)",
          color: "white",
          fontSize: 14,
          cursor: busy || memberships.length <= 1 ? "not-allowed" : "pointer",
        }}
        defaultValue={memberships[0]?.outfitter_id}
      >
        {memberships.map((m) => (
          <option key={m.outfitter_id} value={m.outfitter_id} style={{ color: "#000" }}>
            {m.outfitter_name} ({m.role})
          </option>
        ))}
      </select>
      {busy && <span style={{ fontSize: 12, opacity: 0.7, color: "white" }}>Saving…</span>}
    </label>
  );
}
