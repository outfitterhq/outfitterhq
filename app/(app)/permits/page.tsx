"use client";

import { useState, useEffect } from "react";

interface Permit {
  id: string;
  outfitter_id: string;
  permit_type: string;
  agency?: string | null;
  area?: string | null;
  identifier?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  attachment_document_id?: string | null;
  metadata?: any;
  created_at?: string;
}

export default function PermitsPage() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);

  useEffect(() => {
    loadPermits();
  }, []);

  async function loadPermits() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/permits");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load permits");
      }
      const data = await res.json();
      setPermits(data.permits || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deletePermit(id: string) {
    if (!confirm("Delete this permit?")) return;
    try {
      const res = await fetch(`/api/permits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await loadPermits();
    } catch (e: any) {
      alert("Error: " + String(e));
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Permits</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Manage hunting permits and licenses</p>
        </div>
        <button
          onClick={() => {
            setEditingPermit(null);
            setShowEditor(true);
          }}
          style={{
            padding: "10px 20px",
            background: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + New Permit
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {showEditor && (
        <PermitEditor
          permit={editingPermit}
          onClose={() => {
            setShowEditor(false);
            setEditingPermit(null);
          }}
          onSave={async () => {
            await loadPermits();
            setShowEditor(false);
            setEditingPermit(null);
          }}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Type</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Agency</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Area</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Identifier</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Effective</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Expiry</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd", width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {permits.map((permit) => (
                <tr key={permit.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{permit.permit_type}</td>
                  <td style={{ padding: "12px 16px" }}>{permit.agency || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{permit.area || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <code style={{ fontSize: 12 }}>{permit.identifier || "—"}</code>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {permit.effective_date ? new Date(permit.effective_date).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {permit.expiry_date ? new Date(permit.expiry_date).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          setEditingPermit(permit);
                          setShowEditor(true);
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "#f0f0f0",
                          border: "1px solid #ddd",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePermit(permit.id)}
                        style={{
                          padding: "6px 12px",
                          background: "#fee",
                          border: "1px solid #fcc",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
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
          {permits.length === 0 && (
            <p style={{ textAlign: "center", opacity: 0.6, padding: 40 }}>No permits yet. Create one to get started.</p>
          )}
        </div>
      )}
    </main>
  );
}

function PermitEditor({
  permit,
  onClose,
  onSave,
}: {
  permit: Permit | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [permitType, setPermitType] = useState(permit?.permit_type || "");
  const [agency, setAgency] = useState(permit?.agency || "");
  const [area, setArea] = useState(permit?.area || "");
  const [identifier, setIdentifier] = useState(permit?.identifier || "");
  const [effectiveDate, setEffectiveDate] = useState(
    permit?.effective_date ? permit.effective_date.split("T")[0] : ""
  );
  const [expiryDate, setExpiryDate] = useState(permit?.expiry_date ? permit.expiry_date.split("T")[0] : "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!permitType.trim()) {
      alert("Permit type is required");
      return;
    }

    setLoading(true);
    try {
      const body = {
        permit_type: permitType.trim(),
        agency: agency.trim() || null,
        area: area.trim() || null,
        identifier: identifier.trim() || null,
        effective_date: effectiveDate || null,
        expiry_date: expiryDate || null,
        metadata: {},
      };

      const url = permit ? `/api/permits/${permit.id}` : "/api/permits";
      const method = permit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      onSave();
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 600,
          width: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{permit ? "Edit Permit" : "New Permit"}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Permit Type *</label>
            <input
              type="text"
              value={permitType}
              onChange={(e) => setPermitType(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="e.g. Hunting License, Special Use Permit"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Agency</label>
              <input
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Area</label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Identifier</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Permit number or ID"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Effective Date</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !permitType.trim()}
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading || !permitType.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
