"use client";

import { useState, useEffect, useRef } from "react";

interface GuideDocument {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  content_type: string;
  uploaded_at: string;
  storage_path: string;
}

export default function GuideDocumentsPage() {
  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"guideCard" | "cpr" | "leaveNoTrace" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);
      const res = await fetch("/api/guide/documents");
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e: any) {
      console.error("Error loading documents:", e);
    } finally {
      setLoading(false);
    }
  }

  function getDocumentTitle(type: "guideCard" | "cpr" | "leaveNoTrace"): string {
    switch (type) {
      case "guideCard":
        return "[GUIDE CARD]";
      case "cpr":
        return "[CPR]";
      case "leaveNoTrace":
        return "[LEAVE NO TRACE]";
    }
  }

  function hasDocumentType(type: string): boolean {
    return documents.some((doc) => doc.title.includes(type));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${getDocumentTitle(uploadType)} ${file.name}`);

      const res = await fetch("/api/guide/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload document");
      }

      await loadDocuments();
      setUploadType(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(`/api/guide/documents/${docId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete document");
      }

      await loadDocuments();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  }

  async function handleView(docId: string) {
    try {
      const res = await fetch(`/api/guide/documents/${docId}/view`);
      if (!res.ok) throw new Error("Failed to get document URL");
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Documents</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>Upload and manage your required certifications</p>
      </div>

      {/* Upload Section */}
      <div style={{ padding: 24, background: "white", border: "1px solid #ddd", borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600 }}>Required Certifications</h2>
        <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#666" }}>
          Upload photos or PDFs of your certifications. These are required for permitting.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Guide Card */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => {
                setUploadType("guideCard");
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: hasDocumentType("GUIDE CARD") ? "#d1fae5" : "#059669",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: uploading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {hasDocumentType("GUIDE CARD") ? "✓ Guide Card Uploaded" : "Upload Guide Card"}
            </button>
            {hasDocumentType("GUIDE CARD") && (
              <span style={{ fontSize: 20 }}>✅</span>
            )}
          </div>

          {/* CPR Card */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => {
                setUploadType("cpr");
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: hasDocumentType("CPR") ? "#d1fae5" : "#059669",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: uploading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {hasDocumentType("CPR") ? "✓ CPR Card Uploaded" : "Upload CPR Card"}
            </button>
            {hasDocumentType("CPR") && (
              <span style={{ fontSize: 20 }}>✅</span>
            )}
          </div>

          {/* Leave No Trace */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => {
                setUploadType("leaveNoTrace");
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: hasDocumentType("LEAVE NO TRACE") ? "#d1fae5" : "#059669",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: uploading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {hasDocumentType("LEAVE NO TRACE") ? "✓ Leave No Trace Uploaded" : "Upload Leave No Trace"}
            </button>
            {hasDocumentType("LEAVE NO TRACE") && (
              <span style={{ fontSize: 20 }}>✅</span>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {uploading && (
          <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "#666" }}>Uploading...</p>
        )}
      </div>

      {/* Documents List */}
      {loading ? (
        <p>Loading documents...</p>
      ) : documents.length === 0 ? (
        <div style={{ padding: 48, background: "white", border: "1px solid #ddd", borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>No documents uploaded yet</p>
        </div>
      ) : (
        <div>
          <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600 }}>Uploaded Documents</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  padding: 16,
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.title}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {doc.file_name} • {(doc.file_size / 1024).toFixed(1)} KB •{" "}
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleView(doc.id)}
                    style={{
                      padding: "6px 12px",
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    style={{
                      padding: "6px 12px",
                      background: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
