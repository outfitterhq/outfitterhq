"use client";

import { useState, useEffect } from "react";

interface Guide {
  user_id: string;
  username?: string;
  name?: string;
  email?: string;
}

export default function GuidePortalAccessPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuides();
  }, []);

  async function loadGuides() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guides");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load guides");
      }
      const data = await res.json();
      setGuides(data.guides || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function generateAccessLink(guideId: string) {
    try {
      // In a real implementation, this would generate a secure invite link
      // For now, we'll show a placeholder
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/guide/accept-invite?token=${guideId}`;
      navigator.clipboard.writeText(link);
      alert("Access link copied to clipboard!");
    } catch (e: any) {
      alert("Error: " + String(e));
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Guide Portal Access</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>Manage guide access to the portal</p>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Guide</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Username</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>User ID</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd", width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {guides.map((guide) => (
                <tr key={guide.user_id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                    {guide.name || guide.email || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{guide.username || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <code style={{ fontSize: 12 }}>{guide.user_id.slice(0, 8)}…</code>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => generateAccessLink(guide.user_id)}
                      style={{
                        padding: "6px 12px",
                        background: "#0070f3",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Copy Access Link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {guides.length === 0 && (
            <p style={{ textAlign: "center", opacity: 0.6, padding: 40 }}>
              No guides found. Invite guides from the Guides page.
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: "#f9f9f9", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>About Guide Portal Access</h3>
        <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
          Guides can access the portal using invite links. When you invite a guide from the Guides page, they receive
          an email with an access link. You can also generate access links here for existing guides.
        </p>
      </div>
    </main>
  );
}
