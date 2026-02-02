"use client";

import { useState, useEffect } from "react";

interface Document {
  id: string;
  outfitter_id: string;
  linked_type?: string | null;
  linked_id?: string | null;
  storage_path?: string | null;
  created_at?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load documents");
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Documents</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Manage documents and files</p>
        </div>
        <button
          onClick={() => alert("Document upload coming soon")}
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
          + Upload Document
        </button>
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
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Storage Path</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Linked To</th>
                <th style={{ padding: "12px 16px", borderBottom: "2px solid #ddd" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <code style={{ fontSize: 13 }}>{doc.storage_path || "—"}</code>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {doc.linked_type && doc.linked_id ? (
                      <span>
                        {doc.linked_type}: <code>{doc.linked_id.slice(0, 8)}…</code>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", opacity: 0.7 }}>
                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documents.length === 0 && (
            <p style={{ textAlign: "center", opacity: 0.6, padding: 40 }}>No documents yet.</p>
          )}
        </div>
      )}
    </main>
  );
}
