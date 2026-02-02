"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface WaiverStatus {
  status: string;
  docusign_envelope_id?: string;
  signed_at?: string;
  content?: string;
  waiver_pdf_url?: string | null;
}

export default function WaiverPage() {
  const router = useRouter();
  const [waiverStatus, setWaiverStatus] = useState<WaiverStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingLoading, setSigningLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

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

  async function handleStartSigning() {
    setSigningLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/client/waiver/sign", {
        method: "POST",
      });
      const data = await res.json();

      if (res.status === 503 && (data.needsConfiguration || /not configured/i.test(data.error || ""))) {
        setError("DocuSign isn't set up yet. Your outfitter can enable it in settings. You can still review the waiver below.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to start signing process");
      }

      if (data.signingUrl) {
        window.open(data.signingUrl, "_blank");
        setSigningUrl(data.signingUrl);
      } else {
        throw new Error("No signing URL returned");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSigningLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading...</p>
      </div>
    );
  }

  const isComplete = waiverStatus?.status === "signed" || waiverStatus?.status === "fully_executed";
  const isPending = waiverStatus?.status === "sent" || waiverStatus?.docusign_envelope_id;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/documents"
          style={{ color: "#1a472a", textDecoration: "none", fontSize: 14 }}
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
          Please review and sign via DocuSign.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

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
                background: "#1a472a",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Back to Documents
            </Link>
          </div>
        ) : isPending ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📝</div>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#1565c0" }}>
              Signature Pending
            </h2>
            <p style={{ color: "#666", marginBottom: 24 }}>
              A DocuSign envelope has been sent. Please check your email to complete signing,
              or click below to continue.
            </p>
            {signingUrl && (
              <a
                href={signingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "14px 28px",
                  background: "#1a472a",
                  color: "white",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                Open DocuSign
              </a>
            )}
            <button
              onClick={handleStartSigning}
              disabled={signingLoading}
              style={{
                display: "block",
                width: "100%",
                padding: "14px 28px",
                background: signingLoading ? "#ccc" : "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: signingLoading ? "not-allowed" : "pointer",
              }}
            >
              {signingLoading ? "Loading..." : "Get New Signing Link"}
            </button>
          </div>
        ) : (
          <>
            {/* Waiver: PDF from outfitter or text template */}
            {waiverStatus?.waiver_pdf_url ? (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontWeight: 600, marginBottom: 12 }}>
                  Your outfitter&apos;s Waiver of Liability
                </h3>
                <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
                  Review the document below, then sign via DocuSign when ready.
                </p>
                <div
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    overflow: "hidden",
                    minHeight: 480,
                    background: "#f5f5f5",
                  }}
                >
                  <iframe
                    src={waiverStatus.waiver_pdf_url}
                    title="Waiver of Liability"
                    style={{ width: "100%", height: 520, border: "none" }}
                  />
                </div>
                <p style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
                  Can&apos;t view the PDF?{" "}
                  <a href={waiverStatus.waiver_pdf_url} target="_blank" rel="noopener noreferrer" style={{ color: "#1a472a" }}>
                    Open in new tab
                  </a>
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: "#f9f9f9",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 24,
                  marginBottom: 24,
                  maxHeight: 400,
                  overflowY: "auto",
                }}
              >
                <h3 style={{ fontWeight: 600, marginBottom: 16 }}>
                  WAIVER OF LIABILITY AND ASSUMPTION OF RISK
                </h3>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.8,
                    color: "#333",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {waiverStatus?.content ? (
                    <div dangerouslySetInnerHTML={{ __html: waiverStatus.content.replace(/\n/g, "<br />") }} />
                  ) : (
                    <div>
                      <p>
                        I, the undersigned participant, in consideration of being allowed to participate
                        in hunting and outdoor activities with the Outfitter, hereby agree as follows:
                      </p>
                      <p style={{ marginTop: 16 }}>
                        <strong>1. ASSUMPTION OF RISK:</strong> I understand that hunting and outdoor
                        activities involve inherent risks including but not limited to: adverse weather
                        conditions, rough terrain, wildlife encounters, firearm use, vehicle accidents,
                        and other hazards. I voluntarily assume all such risks.
                      </p>
                      <p style={{ marginTop: 16 }}>
                        <strong>2. RELEASE OF LIABILITY:</strong> I hereby release, waive, and discharge
                        The Outfitter, its owners, employees, guides, and agents from any and all
                        liability, claims, demands, or causes of action arising out of my participation
                        in these activities.
                      </p>
                      <p style={{ marginTop: 16 }}>
                        <strong>3. INDEMNIFICATION:</strong> I agree to indemnify and hold harmless the Outfitter
                        from any claims made by third parties arising from my participation.
                      </p>
                      <p style={{ marginTop: 16 }}>
                        <strong>4. MEDICAL AUTHORIZATION:</strong> I authorize the Outfitter to obtain
                        emergency medical treatment for me if necessary.
                      </p>
                      <p style={{ marginTop: 16 }}>
                        <strong>5. ACKNOWLEDGMENT:</strong> I have read this waiver, understand its
                        contents, and sign it voluntarily.
                      </p>
                      <p style={{ marginTop: 16, fontStyle: "italic", color: "#666" }}>
                        Your outfitter can upload their own waiver PDF in Settings → Waiver. Until then, this template is shown.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sign Button */}
            <button
              onClick={handleStartSigning}
              disabled={signingLoading}
              style={{
                width: "100%",
                padding: "16px 28px",
                background: signingLoading ? "#ccc" : "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 600,
                cursor: signingLoading ? "not-allowed" : "pointer",
              }}
            >
              {signingLoading ? "Preparing DocuSign..." : "Sign via DocuSign"}
            </button>

            <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#666" }}>
              You will be redirected to DocuSign to complete signing.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
