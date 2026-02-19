"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ClientShell from "@/app/(client)/components/ClientShell";

interface PreviewData {
  branding: {
    logoUrl?: string;
    backgroundType: string;
    backgroundColor: string;
    backgroundImageUrl?: string;
    backgroundImageUrls: string[];
    perPageBackgrounds: Record<string, { type: "color" | "image"; value: string }>;
    headerColor: string;
    accentColor: string;
  };
  outfitterName: string;
  dashboardCustomization: {
    heroTitle: string;
    heroSubtitle: string;
    heroImageUrl?: string;
    welcomeText?: string;
    ctaPrimaryText?: string;
    ctaPrimaryUrl?: string;
    ctaSecondaryText?: string;
    ctaSecondaryUrl?: string;
    featureCards: Array<{ title: string; description: string; icon?: string; href: string }>;
    specialSections: Array<{ title: string; description: string; imageUrl?: string; href?: string; buttonText?: string }>;
    partnerLogos: Array<{ name: string; logoUrl: string; href?: string }>;
    contactEnabled: boolean;
    contactEmail?: string;
  };
  documentStatus: { questionnaire: string; predraw: string; waiver: string; contract: string };
}

function DocCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  const statusLabel = status === "not_started" ? "Not started" : status === "completed" ? "Done" : status === "not_available" ? "N/A" : "In progress";
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 12 }}>{description}</p>
      <span
        style={{
          padding: "4px 12px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          background: status === "completed" ? "#e8f5e9" : "#f5f5f5",
          color: status === "completed" ? "#2e7d32" : "#666",
        }}
      >
        {statusLabel}
      </span>
    </div>
  );
}

export default function PreviewClientPage() {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/preview-client")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load preview");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p>Loading preview...</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ color: "#c62828" }}>{error || "Failed to load preview"}</p>
        <Link href="/settings" style={{ color: "var(--client-accent, #1a472a)", fontWeight: 600 }}>
          Back to Settings
        </Link>
      </div>
    );
  }

  const { branding, outfitterName, dashboardCustomization, documentStatus } = data;
  const cust = dashboardCustomization;

  return (
    <div style={{ position: "relative" }}>
      {/* Preview banner */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#1565c0",
          color: "white",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <strong>Preview — this is how your client portal looks to clients.</strong>
        <Link
          href="/settings"
          style={{
            padding: "8px 16px",
            background: "rgba(255,255,255,0.2)",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Back to Settings
        </Link>
      </div>

      <ClientShell
        userEmail="preview@example.com"
        userName="Preview User"
        outfitterId=""
        outfitterName={outfitterName}
        linkedOutfitters={[]}
        logoUrl={branding.logoUrl}
        backgroundType={branding.backgroundType as "color" | "image" | "per-page"}
        backgroundColor={branding.backgroundColor}
        backgroundImageUrl={branding.backgroundImageUrl}
        backgroundImageUrls={branding.backgroundImageUrls}
        perPageBackgrounds={branding.perPageBackgrounds}
        headerColor={branding.headerColor}
        accentColor={branding.accentColor}
      >
        <div style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto" }}>
          {/* Hero */}
          <section
            style={{
              padding: "60px 24px",
              textAlign: "center",
              background: cust.heroImageUrl
                ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${cust.heroImageUrl})`
                : "linear-gradient(135deg, var(--client-accent, #1a472a) 0%, #2d5a3d 100%)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              borderRadius: 12,
              marginBottom: 32,
              color: "white",
            }}
          >
            <h1 style={{ fontSize: 40, fontWeight: 900, marginBottom: 12, textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
              {cust.heroTitle}
            </h1>
            <p style={{ fontSize: 18, opacity: 0.95, maxWidth: 700, margin: "0 auto 24px" }}>
              {cust.heroSubtitle}
            </p>
            {(cust.ctaPrimaryText || cust.ctaSecondaryText) && (
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {cust.ctaPrimaryText && (
                  <span
                    style={{
                      padding: "12px 24px",
                      background: "#059669",
                      color: "white",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {cust.ctaPrimaryText}
                  </span>
                )}
                {cust.ctaSecondaryText && (
                  <span
                    style={{
                      padding: "12px 24px",
                      background: "rgba(255,255,255,0.2)",
                      color: "white",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      border: "2px solid white",
                    }}
                  >
                    {cust.ctaSecondaryText}
                  </span>
                )}
              </div>
            )}
          </section>

          {cust.welcomeText && (
            <section style={{ marginBottom: 32, textAlign: "center" }}>
              <div
                style={{
                  maxWidth: 900,
                  margin: "0 auto",
                  padding: 24,
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                }}
              >
                <p style={{ fontSize: 16, lineHeight: 1.7, color: "#374151", margin: 0 }}>
                  {cust.welcomeText}
                </p>
              </div>
            </section>
          )}

          {/* Feature cards */}
          {cust.featureCards && cust.featureCards.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: 20,
                }}
              >
                {cust.featureCards.map((card, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "white",
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: 24,
                      textAlign: "center",
                    }}
                  >
                    {card.icon && <div style={{ fontSize: 40, marginBottom: 12 }}>{card.icon}</div>}
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--client-accent, #1a472a)" }}>
                      {card.title}
                    </h3>
                    <p style={{ color: "#666", fontSize: 14, lineHeight: 1.5 }}>{card.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Required documents */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>Required Documents</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <DocCard
                title="Pre-Hunt Questionnaire"
                description="Health, emergency contact, and preferences"
                status={documentStatus.questionnaire}
              />
              <DocCard
                title="Pre-Draw Contract"
                description="Species selections and draw authorization"
                status={documentStatus.predraw}
              />
              <DocCard
                title="Waiver of Liability"
                description="Required liability waiver"
                status={documentStatus.waiver}
              />
              <DocCard
                title="Hunt Contract"
                description="Available after tag confirmation"
                status={documentStatus.contract}
              />
            </div>
          </section>
        </div>
      </ClientShell>
    </div>
  );
}
