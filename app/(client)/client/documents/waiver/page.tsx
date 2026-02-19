"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InAppSigningFlow from "@/app/(client)/components/InAppSigningFlow";

interface WaiverStatus {
  status: string;
  docusign_envelope_id?: string;
  signed_at?: string;
  content?: string;
  waiver_pdf_url?: string | null;
  client_email?: string;
}

export default function WaiverPage() {
  const router = useRouter();
  const [waiverStatus, setWaiverStatus] = useState<WaiverStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWaiverStatus();
  }, []);

  async function loadWaiverStatus() {
    try {
      const res = await fetch("/api/client/waiver");
      if (res.ok) {
        const data = await res.json();
        setWaiverStatus(data);
      }
    } catch (e) {
      console.error("Failed to load waiver status:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignInApp({ typedName }: { typedName: string }) {
    const res = await fetch("/api/client/waiver/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typed_name: typedName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to sign");
    await loadWaiverStatus();
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading...</p>
      </div>
    );
  }

  const isComplete = waiverStatus?.status === "signed" || waiverStatus?.status === "fully_executed";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/documents"
          style={{ color: "var(--client-accent, #1a472a)", textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Documents
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Waiver of Liability
        </h1>
        <p style={{ color: "#666" }}>
          This waiver is required before participating in any hunting activities.
          Please review and sign using the steps below.
        </p>
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 32,
        }}
      >
        {isComplete ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#2e7d32" }}>
              Waiver Signed
            </h2>
            <p style={{ color: "#666", marginBottom: 16 }}>
              Thank you! Your waiver was signed on{" "}
              {waiverStatus?.signed_at
                ? new Date(waiverStatus.signed_at).toLocaleDateString()
                : "record"}.
            </p>
            <Link
              href="/client/documents"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                background: "var(--client-accent, #1a472a)",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Back to Documents
            </Link>
          </div>
        ) : (
          <InAppSigningFlow
            documentTitle="Waiver of Liability"
            documentContent={
              waiverStatus?.waiver_pdf_url
                ? null
                : (waiverStatus?.content
                    ? String(waiverStatus.content).replace(/<[^>]+>/g, "\n")
                    : null)
            }
            documentPdfUrl={waiverStatus?.waiver_pdf_url ?? null}
            clientEmail={waiverStatus?.client_email ?? ""}
            onSign={handleSignInApp}
            backHref="/client/documents"
            backLabel="← Back to Documents"
          />
        )}
      </div>
    </div>
  );
}
