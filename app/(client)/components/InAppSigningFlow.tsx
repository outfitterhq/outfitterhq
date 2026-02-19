"use client";

import { useState, useRef, useEffect } from "react";

/** Shared consent text (matches migration 080 econsent_versions v1.0) */
export const ELECTRONIC_CONSENT_TEXT = `ELECTRONIC SIGNATURES AND RECORDS DISCLOSURE

You agree to use electronic signatures and electronic records. You may withdraw consent by contacting your outfitter. You can download a copy of this document for your records at any time.

By clicking "I consent" below, you acknowledge that you have read and agree to the foregoing.`;

export interface InAppSigningFlowProps {
  documentTitle: string;
  documentContent?: string | null;
  documentPdfUrl?: string | null;
  clientEmail: string;
  defaultTypedName?: string;
  onSign: (params: { typedName: string }) => Promise<void>;
  onCancel?: () => void;
  backHref?: string;
  backLabel?: string;
}

type Step = "consent" | "review" | "sign";

export default function InAppSigningFlow({
  documentTitle,
  documentContent,
  documentPdfUrl,
  clientEmail,
  defaultTypedName = "",
  onSign,
  onCancel,
  backHref,
  backLabel = "Back to Documents",
}: InAppSigningFlowProps) {
  const [step, setStep] = useState<Step>("consent");
  const [consentScrolled, setConsentScrolled] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [typedName, setTypedName] = useState(defaultTypedName);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consentEndRef = useRef<HTMLDivElement>(null);

  const handleConsentScroll = () => {
    if (consentEndRef.current) {
      const rect = consentEndRef.current.getBoundingClientRect();
      if (rect.top <= window.innerHeight - 20) setConsentScrolled(true);
    }
  };

  const canProceedConsent = consentScrolled && consentChecked;
  const canProceedReview = reviewChecked;
  const canSign = typedName.trim().length > 0 && !signing;

  const stepIndex = step === "consent" ? 0 : step === "review" ? 1 : 2;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Progress */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              background: i <= stepIndex ? "var(--client-accent, #1a472a)" : "#e0e0e0",
              borderRadius: 2,
            }}
          />
        ))}
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

      {/* Step 1: Consent */}
      {step === "consent" && (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 32,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "var(--client-accent, #1a472a)" }}>
            1. Electronic Consent
          </h2>
          <div
            onScroll={handleConsentScroll}
            style={{
              maxHeight: 220,
              overflowY: "auto",
              padding: 16,
              background: "#f9f9f9",
              borderRadius: 8,
              marginBottom: 20,
              border: "1px solid #eee",
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
              }}
            >
              {ELECTRONIC_CONSENT_TEXT}
            </pre>
            <div ref={consentEndRef} style={{ height: 1 }} />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              marginBottom: 24,
            }}
          >
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              disabled={!consentScrolled}
              style={{ width: 20, height: 20, marginTop: 2 }}
            />
            <span style={{ fontSize: 15 }}>
              I consent to electronic records and signatures. I have read the disclosure above.
              {!consentScrolled && (
                <span style={{ color: "#666", fontSize: 13 }}> (Scroll to bottom to enable)</span>
              )}
            </span>
          </label>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            {backHref && (
              <a
                href={backHref}
                style={{
                  padding: "12px 24px",
                  color: "#666",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                {backLabel}
              </a>
            )}
            <button
              onClick={() => setStep("review")}
              disabled={!canProceedConsent}
              style={{
                padding: "12px 28px",
                background: canProceedConsent ? "var(--client-accent, #1a472a)" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: canProceedConsent ? "pointer" : "not-allowed",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review document */}
      {step === "review" && (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 32,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "var(--client-accent, #1a472a)" }}>
            2. Review {documentTitle}
          </h2>
          {documentPdfUrl ? (
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                overflow: "hidden",
                minHeight: 400,
                background: "#f5f5f5",
                marginBottom: 20,
              }}
            >
              <iframe
                src={documentPdfUrl}
                title={documentTitle}
                style={{ width: "100%", height: 480, border: "none" }}
              />
            </div>
          ) : (
            <div
              style={{
                maxHeight: 360,
                overflowY: "auto",
                padding: 20,
                background: "#f9f9f9",
                borderRadius: 8,
                marginBottom: 20,
                border: "1px solid #eee",
                fontSize: 14,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {documentContent || "No document content to display."}
            </div>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              marginBottom: 24,
            }}
          >
            <input
              type="checkbox"
              checked={reviewChecked}
              onChange={(e) => setReviewChecked(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2 }}
            />
            <span style={{ fontSize: 15 }}>I have reviewed this document and understand its contents.</span>
          </label>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button
              onClick={() => setStep("consent")}
              style={{
                padding: "12px 24px",
                background: "white",
                color: "#666",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep("sign")}
              disabled={!canProceedReview}
              style={{
                padding: "12px 28px",
                background: canProceedReview ? "var(--client-accent, #1a472a)" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: canProceedReview ? "pointer" : "not-allowed",
              }}
            >
              Continue to Sign
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Sign */}
      {step === "sign" && (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 32,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "var(--client-accent, #1a472a)" }}>
            3. Sign {documentTitle}
          </h2>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
              Full legal name
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your full legal name as it appears on your license"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 16,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            />
          </div>
          <div
            style={{
              padding: 12,
              background: "#f5f5f5",
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 14,
              color: "#666",
            }}
          >
            <strong>Email:</strong> {clientEmail}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button
              onClick={() => setStep("review")}
              style={{
                padding: "12px 24px",
                background: "white",
                color: "#666",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <button
              onClick={async () => {
                setError(null);
                setSigning(true);
                try {
                  await onSign({ typedName: typedName.trim() });
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed to sign");
                } finally {
                  setSigning(false);
                }
              }}
              disabled={!canSign}
              style={{
                padding: "12px 28px",
                background: canSign ? "var(--client-accent, #1a472a)" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: canSign ? "pointer" : "not-allowed",
              }}
            >
              {signing ? "Signing..." : "Sign Document"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
