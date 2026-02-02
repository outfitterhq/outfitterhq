"use client";

import { useState, useEffect } from "react";
import type { ContractTemplate, ContractTemplateType } from "@/lib/types/hunt-contracts";
import { DEFAULT_CONTRACT_TEMPLATE, CONTRACT_PLACEHOLDERS } from "@/lib/types/hunt-contracts";

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contract-templates");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load templates");
      }
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/contract-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await loadTemplates();
    } catch (e: any) {
      alert("Error: " + String(e));
    }
  }

  const templateTypeLabels: Record<ContractTemplateType, string> = {
    hunt_contract: "Hunt Contract",
    waiver: "Waiver",
    pre_draw_agreement: "Pre-Draw Agreement",
  };

  return (
    <main style={{ maxWidth: 1000, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Contract Templates</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Manage templates used for auto-generating hunt contracts
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null);
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
          + New Template
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {!loading && templates.length === 0 && (
        <div style={{ 
          background: "#fff3cd", 
          border: "1px solid #ffc107", 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 16 
        }}>
          <strong>No templates found!</strong>
          <p style={{ margin: "8px 0 0 0" }}>
            Create a hunt contract template to enable automatic contract generation when tags are confirmed.
            Click "New Template" to get started with a default template.
          </p>
        </div>
      )}

      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => {
            setShowEditor(false);
            setEditingTemplate(null);
          }}
          onSave={async () => {
            await loadTemplates();
            setShowEditor(false);
            setEditingTemplate(null);
          }}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {templates.map((template) => (
            <div
              key={template.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                background: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{template.name}</h3>
                    {template.is_active && (
                      <span style={{
                        padding: "2px 8px",
                        background: "#4caf50",
                        color: "white",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0 0", opacity: 0.7, fontSize: 14 }}>
                    Type: {templateTypeLabels[template.template_type]}
                  </p>
                  {template.description && (
                    <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>{template.description}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowEditor(true);
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#f5f5f5",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    style={{
                      padding: "6px 12px",
                      background: "#fee",
                      border: "1px solid #fcc",
                      borderRadius: 4,
                      cursor: "pointer",
                      color: "#c00",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 13, opacity: 0.7 }}>
                    Preview content
                  </summary>
                  <pre style={{
                    marginTop: 8,
                    padding: 12,
                    background: "#f5f5f5",
                    borderRadius: 6,
                    fontSize: 12,
                    overflow: "auto",
                    maxHeight: 300,
                    whiteSpace: "pre-wrap",
                  }}>
                    {template.content}
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSave,
}: {
  template: ContractTemplate | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(template?.name || "Hunt Contract");
  const [description, setDescription] = useState(template?.description || "");
  const [content, setContent] = useState(template?.content || DEFAULT_CONTRACT_TEMPLATE);
  const [templateType, setTemplateType] = useState<ContractTemplateType>(
    template?.template_type || "hunt_contract"
  );
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!name.trim() || !content.trim()) {
      alert("Name and content are required");
      return;
    }

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        content: content,
        template_type: templateType,
        is_active: isActive,
      };

      const url = template ? `/api/contract-templates/${template.id}` : "/api/contract-templates";
      const method = template ? "PUT" : "POST";

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
          maxWidth: 900,
          width: "95%",
          maxHeight: "95vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{template ? "Edit Template" : "New Template"}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Type</label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as ContractTemplateType)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              >
                <option value="hunt_contract">Hunt Contract</option>
                <option value="waiver">Waiver</option>
                <option value="pre_draw_agreement">Pre-Draw Agreement</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Active (use this template for new contracts)</span>
            </label>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Content (Markdown) *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                minHeight: 400,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ background: "#f5f5f5", padding: 12, borderRadius: 6 }}>
            <strong style={{ fontSize: 13 }}>Available Placeholders:</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {Object.entries(CONTRACT_PLACEHOLDERS).map(([placeholder, description]) => (
                <span
                  key={placeholder}
                  style={{
                    padding: "4px 8px",
                    background: "#e3f2fd",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setContent((prev) => prev + placeholder);
                  }}
                  title={description}
                >
                  {placeholder}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 11, margin: "8px 0 0 0", opacity: 0.7 }}>
              Click a placeholder to insert it. Placeholders are replaced with actual values when contracts are generated.
            </p>
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
            disabled={loading || !name.trim() || !content.trim()}
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading || !name.trim() || !content.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
