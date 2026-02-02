"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Hunt {
  id: string;
  title: string;
  start_time?: string;
  end_time?: string;
  species?: string;
  unit?: string;
  client_email?: string;
}

export default function GuidePacketsPage() {
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/guide/hunts");
        if (res.ok) {
          const data = await res.json();
          setHunts(data.hunts || []);
        }
      } catch {
        setHunts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function formatDate(s: string | undefined) {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleDateString();
    } catch {
      return s;
    }
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 28, fontWeight: 700 }}>Hunt Packets</h1>
      <p style={{ margin: 0, color: "#666" }}>
        Download a packet for each hunt: hunt contract, client questionnaire, and your guide documents.
      </p>

      {loading ? (
        <p style={{ marginTop: 24 }}>Loading hunts…</p>
      ) : hunts.length === 0 ? (
        <div style={{ marginTop: 24, padding: 32, background: "white", border: "1px solid #ddd", borderRadius: 12, textAlign: "center", color: "#666" }}>
          No hunts assigned yet. Packets will appear here when you have hunts.
        </div>
      ) : (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          {hunts.map((hunt) => (
            <div
              key={hunt.id}
              style={{
                padding: 20,
                background: "white",
                border: "1px solid #ddd",
                borderRadius: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 600 }}>{hunt.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
                  {formatDate(hunt.start_time)} – {formatDate(hunt.end_time)}
                  {hunt.species && ` · ${hunt.species}`}
                  {hunt.unit && ` · Unit ${hunt.unit}`}
                </p>
                {hunt.client_email && (
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#888" }}>Client: {hunt.client_email}</p>
                )}
              </div>
              <Link
                href={`/guide/packet/${hunt.id}`}
                style={{
                  padding: "10px 20px",
                  background: "#059669",
                  color: "white",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                📦 Open Packet
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
