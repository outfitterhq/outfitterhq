"use client";

import { useState, useEffect } from "react";

interface GuideRow {
  user_id: string;
  outfitter_id: string;
  role: string;
  status: string;
  created_at: string | null;
  name: string;
  email: string;
}

export default function GuidesList() {
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outfitterId, setOutfitterId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guides/list");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load guides");
      }
      setGuides(data.guides ?? []);
      setOutfitterId(data.outfitter_id ?? null);
    } catch (e: any) {
      setError(String(e.message ?? e));
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    const needsOutfitter = /no outfitter|outfitter selected/i.test(error);
    return (
      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Current guides</h2>
        <div style={{ padding: 12, background: "#fee", borderRadius: 8 }}>
          {error}
        </div>
        {needsOutfitter && (
          <p style={{ marginTop: 12, fontSize: 14 }}>
            <a href="/select-outfitter" style={{ color: "#0070f3", fontWeight: 500 }}>
              Select an outfitter first →
            </a>
          </p>
        )}
      </section>
    );
  }

  if (loading) {
    return (
      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Current guides</h2>
        <p style={{ opacity: 0.75 }}>Loading…</p>
      </section>
    );
  }

  return (
    <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Current guides</h2>
        <button
          type="button"
          onClick={load}
          style={{ padding: "6px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>
      {guides.length === 0 ? (
        <p style={{ opacity: 0.75 }}>No guides yet. Use “Invite guide” above.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>User</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Role</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Status</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Created</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {guides.map((g) => (
                <tr key={String(g.user_id) + "-" + String(g.outfitter_id)}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    <div>
                      <a
                        href={`/guides/${g.user_id}`}
                        style={{
                          fontWeight: 500,
                          color: "#0070f3",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {g.name || g.email || "Guide"}
                      </a>
                      {g.email && (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{g.email}</div>
                      )}
                      <code style={{ fontSize: 11, opacity: 0.5 }}>
                        {String(g.user_id).slice(0, 8)}…
                      </code>
                    </div>
                  </td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>{g.role}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        backgroundColor: g.status === "active" ? "#d4edda" : "#fff3cd",
                        color: g.status === "active" ? "#155724" : "#856404",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    {g.created_at ? new Date(g.created_at).toLocaleString() : ""}
                  </td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href={`/guides/${g.user_id}/hunts`}
                        style={{
                          padding: "6px 12px",
                          fontSize: 13,
                          borderRadius: 6,
                          border: "1px solid #0070f3",
                          background: "#0070f3",
                          color: "white",
                          cursor: "pointer",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#0051cc";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#0070f3";
                        }}
                      >
                        View Hunts
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete guide ${g.name || g.email}? This will deactivate them but preserve history.`)) {
                            return;
                          }
                          try {
                            const res = await fetch(`/api/guides/${g.user_id}`, { method: "DELETE" });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              throw new Error(data.error || "Failed to delete guide");
                            }
                            await load(); // Refresh the list
                          } catch (e: any) {
                            alert("Error: " + String(e));
                          }
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 13,
                          borderRadius: 6,
                          border: "1px solid #dc3545",
                          background: "#dc3545",
                          color: "white",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#c82333";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#dc3545";
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {outfitterId && (
        <p style={{ marginTop: 12, fontSize: 11, opacity: 0.5 }}>
          Outfitter: <code>{outfitterId.slice(0, 8)}…</code>
        </p>
      )}
    </section>
  );
}
