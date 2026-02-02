"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface GuideDetail {
  id: string;
  user_id: string;
  outfitter_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  username: string | null;
  is_active: boolean;
  notes: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  has_guide_license: boolean;
  has_cpr_card: boolean;
  has_leave_no_trace: boolean;
  created_at: string;
  updated_at: string;
}

interface GuideDocument {
  id: string;
  guide_id: string;
  title: string;
  storage_path: string;
  uploaded_at: string;
}

export default function GuideDetailPage() {
  const params = useParams();
  const guideId = params.id as string;
  const [guide, setGuide] = useState<GuideDetail | null>(null);
  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guideId) {
      loadGuide();
      loadDocuments();
    }
  }, [guideId]);

  async function loadGuide() {
    try {
      const res = await fetch(`/api/guides/${guideId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load guide");
      }
      const data = await res.json();
      setGuide(data.guide);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments() {
    try {
      const res = await fetch(`/api/guides/${guideId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (e) {
      // Non-blocking
      console.error("Failed to load documents:", e);
    }
  }

  async function viewDocument(doc: GuideDocument) {
    try {
      const res = await fetch(`/api/guides/${guideId}/documents/${doc.id}/view`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, "_blank");
        }
      } else {
        alert("Failed to generate document URL");
      }
    } catch (e) {
      alert("Error viewing document");
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1000, margin: "32px auto", padding: 16 }}>
        <p>Loading guide details...</p>
      </main>
    );
  }

  if (error || !guide) {
    return (
      <main style={{ maxWidth: 1000, margin: "32px auto", padding: 16 }}>
        <div style={{ background: "#fee", padding: 12, borderRadius: 8 }}>
          {error || "Guide not found"}
        </div>
        <Link href="/guides" style={{ display: "inline-block", marginTop: 16, color: "#0070f3" }}>
          ← Back to Guides
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "32px auto", padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/guides"
          style={{
            display: "inline-block",
            marginBottom: 16,
            color: "#0070f3",
            textDecoration: "none",
          }}
        >
          ← Back to Guides
        </Link>
        <h1 style={{ margin: 0 }}>{guide.name || guide.email || "Guide Details"}</h1>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        {/* Profile Information */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Profile Information</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <strong>Name:</strong> {guide.name || "—"}
            </div>
            <div>
              <strong>Email:</strong> {guide.email || "—"}
            </div>
            <div>
              <strong>Phone:</strong> {guide.phone || "—"}
            </div>
            <div>
              <strong>Username:</strong> {guide.username || "—"}
            </div>
            <div>
              <strong>Status:</strong>{" "}
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  backgroundColor: guide.is_active ? "#d4edda" : "#fff3cd",
                  color: guide.is_active ? "#155724" : "#856404",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {guide.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            {guide.notes && (
              <div>
                <strong>Notes:</strong> {guide.notes}
              </div>
            )}
          </div>
        </section>

        {/* Vehicle Information */}
        {(guide.vehicle_year || guide.vehicle_make || guide.vehicle_model) && (
          <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Vehicle Information</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {guide.vehicle_year && guide.vehicle_make && guide.vehicle_model && (
                <div>
                  <strong>Vehicle:</strong> {guide.vehicle_year} {guide.vehicle_make} {guide.vehicle_model}
                </div>
              )}
              {guide.vehicle_color && (
                <div>
                  <strong>Color:</strong> {guide.vehicle_color}
                </div>
              )}
              {guide.vehicle_plate && (
                <div>
                  <strong>License Plate:</strong> {guide.vehicle_plate}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Required Certifications */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Required Certifications</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Guide Card:</span>
              {guide.has_guide_license ? (
                <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ Complete</span>
              ) : (
                <span style={{ color: "#ef4444", fontWeight: 600 }}>✗ Missing</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>CPR Card:</span>
              {guide.has_cpr_card ? (
                <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ Complete</span>
              ) : (
                <span style={{ color: "#ef4444", fontWeight: 600 }}>✗ Missing</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Leave No Trace:</span>
              {guide.has_leave_no_trace ? (
                <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ Complete</span>
              ) : (
                <span style={{ color: "#ef4444", fontWeight: 600 }}>✗ Missing</span>
              )}
            </div>
          </div>
        </section>

        {/* Uploaded Documents */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Uploaded Documents</h2>
          {documents.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No documents uploaded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    background: "#f9f9f9",
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{doc.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => viewDocument(doc)}
                    style={{
                      padding: "8px 16px",
                      background: "#0070f3",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
