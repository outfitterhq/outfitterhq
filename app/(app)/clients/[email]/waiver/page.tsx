"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Waiver {
  id: string;
  status: string;
  client_signed_at: string | null;
  admin_signed_at: string | null;
  created_at: string | null;
}

export default function WaiverDetailPage() {
  const params = useParams();
  const email = decodeURIComponent(params.email as string);
  
  const [waiver, setWaiver] = useState<Waiver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function loadData() {
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/waiver`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load waiver");
        return;
      }
      const data = await res.json();
      setWaiver(data.waiver);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [email]);

  async function adminSign() {
    if (!waiver || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/waiver/admin-sign`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to admin sign");
        return;
      }
      await loadData();
    } catch (e) {
      alert(String(e));
    } finally {
      setUpdating(false);
    }
  }

  async function markFullyExecuted() {
    if (!waiver || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/waiver/fully-executed`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to mark as fully executed");
        return;
      }
      await loadData();
    } catch (e) {
      alert(String(e));
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <p>Loading waiver...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
          ← Back to Client
        </Link>
        <h1 style={{ marginTop: 16 }}>Waiver of Liability</h1>
        <p style={{ background: "#fee", padding: 12, borderRadius: 8 }}>{error}</p>
      </main>
    );
  }

  if (!waiver) {
    return (
      <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
          ← Back to Client
        </Link>
        <h1 style={{ marginTop: 16 }}>Waiver of Liability</h1>
        <p>No waiver submitted yet.</p>
      </main>
    );
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    not_submitted: { bg: "#fff3e0", text: "#e65100" },
    submitted: { bg: "#fff3e0", text: "#e65100" },
    client_signed: { bg: "#e3f2fd", text: "#1565c0" },
    admin_signed: { bg: "#e8f5e9", text: "#2e7d32" },
    fully_executed: { bg: "#e8f5e9", text: "#1b5e20" },
  };

  const statusLabels: Record<string, string> = {
    not_submitted: "Not Submitted",
    submitted: "Submitted",
    client_signed: "Client Signed",
    admin_signed: "Admin Signed",
    fully_executed: "Fully Executed",
  };

  const colors = statusColors[waiver.status] || statusColors.not_submitted;

  return (
    <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
      <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
        ← Back to Client
      </Link>
      
      <h1 style={{ marginTop: 16, marginBottom: 24 }}>Waiver of Liability</h1>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Status</h2>
        
        <div style={{ marginBottom: 16 }}>
          <span style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: colors.bg,
            color: colors.text,
            fontWeight: 600,
            fontSize: 16,
          }}>
            {statusLabels[waiver.status] || waiver.status}
          </span>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong>Client:</strong> {email}
          </div>
          {waiver.client_signed_at && (
            <div>
              <strong>Client Signed:</strong> {new Date(waiver.client_signed_at).toLocaleString()}
            </div>
          )}
          {waiver.admin_signed_at && (
            <div>
              <strong>Admin Signed:</strong> {new Date(waiver.admin_signed_at).toLocaleString()}
            </div>
          )}
          {waiver.created_at && (
            <div style={{ color: "#666", fontSize: 14 }}>
              Created: {new Date(waiver.created_at).toLocaleString()}
            </div>
          )}
        </div>
      </section>

      <section style={{ background: "#e8f5e9", padding: 20, borderRadius: 12, marginBottom: 20, border: "1px solid #c8e6c9" }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #a5d6a7", paddingBottom: 8 }}>Admin Actions</h2>
        
        {waiver.status === "fully_executed" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2e7d32" }}>
            <span style={{ fontSize: 24 }}>✓</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>Document is fully executed</span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {waiver.status === "client_signed" && (
              <button
                onClick={adminSign}
                disabled={updating}
                style={{
                  padding: "12px 24px",
                  background: updating ? "#9e9e9e" : "#1976d2",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: updating ? "not-allowed" : "pointer",
                }}
              >
                {updating ? "Signing..." : "Mark as Admin Signed (DocuSign Complete)"}
              </button>
            )}

            {(waiver.status === "client_signed" || waiver.status === "admin_signed") && (
              <button
                onClick={markFullyExecuted}
                disabled={updating}
                style={{
                  padding: "12px 24px",
                  background: updating ? "#9e9e9e" : "#2e7d32",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: updating ? "not-allowed" : "pointer",
                }}
              >
                {updating ? "Processing..." : "Mark as Fully Executed"}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
