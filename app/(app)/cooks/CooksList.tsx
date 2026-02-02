"use client";

import { useEffect, useState } from "react";

interface Cook {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

export default function CooksList() {
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCooks();
  }, []);

  async function loadCooks() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/cooks");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load cooks");
      }
      const data = await res.json();
      setCooks(data.cooks || []);
    } catch (e: any) {
      setError(e.message || "Failed to load cooks");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center" }}>
        <p>Loading cooks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, backgroundColor: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: 8 }}>
        <p style={{ margin: 0, color: "#721c24" }}>Error: {error}</p>
      </div>
    );
  }

  if (cooks.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", opacity: 0.75 }}>
        <p>No cooks have been added yet. Invite a cook to get started.</p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: 16, backgroundColor: "#f9f9f9", borderBottom: "1px solid #ddd" }}>
        <h3 style={{ margin: 0 }}>Cooks ({cooks.length})</h3>
      </div>
      <div>
        {cooks.map((cook) => (
          <div
            key={cook.id}
            style={{
              padding: 16,
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>{cook.name}</p>
              {cook.contact_email && (
                <p style={{ margin: "4px 0 0 0", fontSize: 14, opacity: 0.75 }}>{cook.contact_email}</p>
              )}
              {cook.contact_phone && (
                <p style={{ margin: "4px 0 0 0", fontSize: 14, opacity: 0.75 }}>{cook.contact_phone}</p>
              )}
              {cook.notes && (
                <p style={{ margin: "4px 0 0 0", fontSize: 14, opacity: 0.6, fontStyle: "italic" }}>{cook.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
