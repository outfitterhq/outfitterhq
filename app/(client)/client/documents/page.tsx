"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface HuntContractItem {
  id: string;
  status: string;
  client_signed_at?: string | null;
  admin_signed_at?: string | null;
  hunt_title?: string | null;
  species?: string | null;
  unit?: string | null;
  hunt_code?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

interface DocumentStatus {
  questionnaire: { status: string; submitted_at?: string };
  predraw: { status: string; docusign_status?: string; submitted_at?: string };
  waiver: { status: string; signed_at?: string };
  huntContract: { status: string; eligible: boolean; signed_at?: string };
  huntContracts?: HuntContractItem[];
}

export default function ClientDocumentsPage() {
  const [docStatus, setDocStatus] = useState<DocumentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  // Refetch when client returns to this tab so approved/sent contracts show up
  useEffect(() => {
    const onFocus = () => { loadDocuments(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function loadDocuments() {
    try {
      const res = await fetch(`/api/client/documents?_=${Date.now()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load documents");
      }
      const data = await res.json();
      setDocStatus(data);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="pro-loading">
        <div className="pro-spinner"></div>
        <span>Loading your documents...</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>My Documents</h1>
          <p style={{ color: "#666" }}>
            Complete the required forms below. Documents with a green checkmark are complete.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDocuments()}
          className="pro-button pro-button-secondary"
          style={{ fontSize: 14, padding: "8px 16px" }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="pro-alert pro-alert-error">
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Questionnaire */}
        <DocumentCard
          title="Pre-Hunt Questionnaire"
          description="Health info, emergency contacts, dietary preferences, accommodations needs, and other important details for your hunt."
          icon="📋"
          href="/client/documents/questionnaire"
          status={docStatus?.questionnaire.status || "not_started"}
          completedAt={docStatus?.questionnaire.submitted_at}
          required
        />

        {/* Pre-Draw Contract */}
        <DocumentCard
          title="Pre-Draw Contract"
          description="Species preferences and draw application authorization. Complete before the draw deadline."
          icon="🎯"
          href="/client/documents/pre-draw"
          status={docStatus?.predraw.status || "not_started"}
          completedAt={docStatus?.predraw.submitted_at}
          docusignStatus={docStatus?.predraw.docusign_status}
          required
        />

        {/* Waiver */}
        <DocumentCard
          title="Waiver of Liability"
          description="Required liability waiver. Must be signed before your hunt."
          icon="📝"
          href="/client/documents/waiver"
          status={docStatus?.waiver.status || "not_started"}
          completedAt={docStatus?.waiver.signed_at}
          required
        />

        {/* Hunt Contracts: one per hunt (per-hunt workflow) */}
        {docStatus?.huntContracts && docStatus.huntContracts.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Hunt Contracts</h3>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 12 }}>
              Each hunt has its own contract. Sign each when your outfitter sends it.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {docStatus.huntContracts.map((contract) => (
                <HuntContractCard key={contract.id} contract={contract} />
              ))}
            </div>
          </div>
        ) : docStatus?.huntContract.eligible ? (
          <DocumentCard
            title="Hunt Contract"
            description="Your hunt contract will appear here after your outfitter generates it (following tag purchase or draw success)."
            icon="📄"
            href="/client/documents/hunt-contract"
            status="not_started"
            disabledReason="Waiting for outfitter to generate your hunt contract"
          />
        ) : (
          <DocumentCard
            title="Hunt Contract"
            description="Final hunt contract with dates, pricing, and terms. Available after tag confirmation."
            icon="📄"
            href="/client/documents/hunt-contract"
            status={docStatus?.huntContract.status || "not_available"}
            completedAt={docStatus?.huntContract.signed_at}
            disabled={!docStatus?.huntContract.eligible}
            disabledReason="Available after your tag is confirmed (private land purchase or draw success)"
          />
        )}
      </div>

      {/* Info Section */}
      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#f0f7f4",
          borderRadius: 8,
          border: "1px solid #c8e6c9",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8, color: "var(--client-accent, #1a472a)" }}>Document Process</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#555", lineHeight: 1.8 }}>
          <li><strong>Questionnaire:</strong> Fill out once and update as needed</li>
          <li><strong>Pre-Draw Contract:</strong> Complete before the draw deadline for your species choices</li>
          <li><strong>Waiver:</strong> Must be signed via DocuSign before your hunt</li>
          <li><strong>Hunt Contract:</strong> Generated after you receive your tag (draw success or private land)</li>
        </ul>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #c8e6c9" }}>
          <h4 style={{ fontWeight: 600, marginBottom: 6, color: "var(--client-accent, #1a472a)", fontSize: 14 }}>Draw hunts</h4>
          <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.6 }}>
            Complete your <strong>Pre-Draw Contract</strong> first. After the draw, your outfitter will enter results. If you were drawn, a <strong>Hunt Contract</strong> will appear above—complete and sign it. Each hunt has its own contract.
          </p>
        </div>
      </div>
    </div>
  );
}

function huntContractStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Being prepared",
    pending_client_completion: "Pending your completion",
    pending_admin_review: "Pending outfitter review",
    ready_for_signature: "Ready to send for signature",
    sent_to_docusign: "Pending your signature",
    client_signed: "Pending outfitter signature",
    fully_executed: "Complete",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

function HuntContractCard({ contract }: { contract: HuntContractItem }) {
  const label =
    [contract.species, contract.unit && `Unit ${contract.unit}`, contract.hunt_code].filter(Boolean).join(" – ") ||
    contract.hunt_title ||
    "Hunt contract";
  const isComplete =
    contract.status === "fully_executed" || contract.status === "client_signed";
  const statusConfig = getStatusConfig(contract.status);

  return (
    <Link
      href={`/client/documents/hunt-contract?contract=${contract.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          background: "white",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          display: "flex",
          gap: 16,
          alignItems: "center",
          cursor: "pointer",
          transition: "box-shadow 0.15s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: isComplete ? "#e8f5e9" : "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          {isComplete ? "✅" : "📄"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 500,
                background: statusConfig.bg,
                color: statusConfig.color,
              }}
            >
              {huntContractStatusLabel(contract.status)}
            </span>
            {(contract.admin_signed_at || contract.client_signed_at) && (
              <span style={{ fontSize: 12, color: "#999" }}>
                {formatDate((contract.admin_signed_at || contract.client_signed_at)!)}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 20, color: "#999" }}>→</span>
      </div>
    </Link>
  );
}

interface DocumentCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  status: string;
  completedAt?: string;
  docusignStatus?: string;
  required?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

function DocumentCard({
  title,
  description,
  icon,
  href,
  status,
  completedAt,
  docusignStatus,
  required,
  disabled,
  disabledReason,
}: DocumentCardProps) {
  const statusConfig = getStatusConfig(status, docusignStatus);
  const isComplete = status === "completed" || status === "signed" || status === "fully_executed";

  const content = (
    <div
      style={{
        background: "white",
        border: `1px solid ${disabled ? "#eee" : "#ddd"}`,
        borderRadius: 8,
        padding: 24,
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "box-shadow 0.15s ease",
      }}
      onMouseOver={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          fontSize: 32,
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isComplete ? "#e8f5e9" : "#f5f5f5",
          borderRadius: 12,
        }}
      >
        {isComplete ? "✅" : icon}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h3 style={{ fontWeight: 600, fontSize: 18, margin: 0 }}>{title}</h3>
          {required && !isComplete && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#c62828",
                background: "#ffebee",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              REQUIRED
            </span>
          )}
        </div>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
          {disabled ? disabledReason : description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              padding: "6px 12px",
              borderRadius: 16,
              fontSize: 13,
              fontWeight: 500,
              background: statusConfig.bg,
              color: statusConfig.color,
            }}
          >
            {statusConfig.label}
          </span>
          {completedAt && (
            <span style={{ fontSize: 13, color: "#999" }}>
              {formatDate(completedAt)}
            </span>
          )}
        </div>
      </div>

      {!disabled && (
        <div style={{ alignSelf: "center" }}>
          <span style={{ fontSize: 24, color: "#999" }}>→</span>
        </div>
      )}
    </div>
  );

  if (disabled) {
    return content;
  }

  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {content}
    </Link>
  );
}

function getStatusConfig(status: string, docusignStatus?: string): { label: string; bg: string; color: string } {
  // Check DocuSign status first
  if (docusignStatus) {
    switch (docusignStatus) {
      case "completed":
      case "signed":
        return { label: "Signed", bg: "#e8f5e9", color: "#2e7d32" };
      case "sent":
        return { label: "Awaiting Signature", bg: "#e3f2fd", color: "#1565c0" };
      case "declined":
        return { label: "Declined", bg: "#ffebee", color: "#c62828" };
    }
  }

  switch (status) {
    case "completed":
    case "signed":
    case "fully_executed":
      return { label: "Completed", bg: "#e8f5e9", color: "#2e7d32" };
    case "in_progress":
    case "submitted":
    case "client_signed":
      return { label: "In Progress", bg: "#e3f2fd", color: "#1565c0" };
    case "admin_signed":
      return { label: "Awaiting Your Signature", bg: "#fff3e0", color: "#e65100" };
    case "not_started":
    case "not_submitted":
      return { label: "Not Started", bg: "#fff3e0", color: "#e65100" };
    case "not_available":
      return { label: "Not Available Yet", bg: "#f5f5f5", color: "#999" };
    default:
      return { label: status, bg: "#f5f5f5", color: "#666" };
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
