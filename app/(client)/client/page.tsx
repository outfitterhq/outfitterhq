"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

// Dynamically import slideshow with no SSR to prevent hydration errors
const MarketingSlideshow = dynamic(
  () => import("./components/MarketingSlideshow"),
  { ssr: false }
);

interface DashboardData {
  client: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
  upcomingHunts: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    species?: string;
    unit?: string;
    status?: string;
    guide_username?: string;
  }>;
  documentStatus: {
    questionnaire: string;
    predraw: string;
    waiver: string;
    contract: string;
  };
  outfitterName: string;
  paymentDue: {
    balanceDueCents: number;
    balanceDueFormatted: string;
    itemCount: number;
    firstPayItemId: string | null;
    breakdown?: Array<{
      payment_item_id: string;
      description: string;
      subtotal_cents: number;
      platform_fee_cents: number;
      total_cents: number;
      balance_due_cents: number;
    }>;
  } | null;
  totalOwedFromContracts?: number;
  totalOwedFromContractsFormatted?: string;
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
    huntShowcases: Array<{ title: string; imageUrl?: string; href: string }>;
    testimonials: Array<{ name: string; location: string; text: string; imageUrl?: string }>;
    specialSections: Array<{ title: string; description: string; imageUrl?: string; href?: string; buttonText?: string }>;
    partnerLogos: Array<{ name: string; logoUrl: string; href?: string }>;
    contactEnabled: boolean;
    contactEmail?: string;
  };
}

export default function ClientDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", message: "" });
  const [submittingContact, setSubmittingContact] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [outfitterId, setOutfitterId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark as client-side to prevent hydration errors
    setIsClient(true);
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      // Always load dashboard data first
      const res = await fetch("/api/client/dashboard");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load dashboard");
      }
      const json = await res.json();
      setData(json);
      
      // After dashboard loads, check if we should show slideshow
      // Only check localStorage on client side to avoid hydration errors
      let skipSlideshow = false;
      if (typeof window !== "undefined") {
        try {
          skipSlideshow = localStorage.getItem("skipMarketingSlideshow") === "true";
        } catch (e) {
          // localStorage might not be available
          console.warn("Could not access localStorage:", e);
        }
      }
      
      if (!skipSlideshow && json.client?.id) {
        // Get outfitter ID from client link
        try {
          const linkRes = await fetch("/api/client/outfitter-link");
          if (linkRes.ok) {
            const linkData = await linkRes.json();
            if (linkData.outfitter_id && json.client?.email) {
              setOutfitterId(linkData.outfitter_id);
              setClientEmail(json.client.email);
              setShowSlideshow(true);
              // Keep loading false so dashboard is ready when slideshow closes
            }
          }
        } catch (e) {
          // If we can't get outfitter ID, just show dashboard
          console.error("Failed to get outfitter ID:", e);
        }
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  
  function handleSkipSlideshow() {
    if (typeof window !== "undefined") {
      localStorage.setItem("skipMarketingSlideshow", "true");
    }
    setShowSlideshow(false);
  }
  
  function handleContinueFromSlideshow() {
    setShowSlideshow(false);
    // Dashboard is already loaded, so it will show immediately
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.dashboardCustomization.contactEmail) return;
    
    setSubmittingContact(true);
    try {
      // In a real implementation, you'd send this to an API endpoint
      // For now, we'll use mailto as a fallback
      const mailtoLink = `mailto:${data.dashboardCustomization.contactEmail}?subject=Contact from Client Portal&body=${encodeURIComponent(
        `Name: ${contactForm.firstName} ${contactForm.lastName}\nEmail: ${contactForm.email}\n\nMessage:\n${contactForm.message}`
      )}`;
      window.location.href = mailtoLink;
      setContactForm({ firstName: "", lastName: "", email: "", message: "" });
    } catch (e) {
      alert("Failed to send message. Please try again.");
    } finally {
      setSubmittingContact(false);
    }
  }

  // Show slideshow if enabled and we have the required data
  // Check this BEFORE loading/error checks so it shows immediately
  // Only render on client to avoid hydration errors
  if (isClient && showSlideshow && outfitterId && clientEmail) {
    return (
      <MarketingSlideshow
        outfitterId={outfitterId}
        clientEmail={clientEmail}
        onSkip={handleSkipSlideshow}
        onContinue={handleContinueFromSlideshow}
      />
    );
  }

  if (loading) {
    return (
      <div className="pro-loading">
        <div className="pro-spinner"></div>
        <span>Loading your dashboard...</span>
      </div>
    );
  }

  if (error) {
    const isSessionError = error.includes("session") || error.includes("log in");
    const isNotLinked = error.includes("not linked") || error.includes("outfitter code");
    const isNoProfile = error.includes("client profile");
    
    return (
      <div style={{ 
        maxWidth: 600, 
        margin: "48px auto", 
        padding: 32, 
        background: "white", 
        borderRadius: 12, 
        border: "1px solid #e0e0e0",
        textAlign: "center"
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {isSessionError ? "🔐" : isNotLinked ? "🔗" : isNoProfile ? "👤" : "⚠️"}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#1a472a" }}>
          {isSessionError ? "Session Expired" : 
           isNotLinked ? "Not Connected" :
           isNoProfile ? "Profile Not Found" : 
           "Unable to Load Dashboard"}
        </h2>
        <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.6 }}>{error}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {isSessionError && (
            <Link
              href="/login"
              style={{
                padding: "12px 24px",
                background: "#1a472a",
                color: "white",
                textDecoration: "none",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Log In Again
            </Link>
          )}
          {isNotLinked && (
            <Link
              href="/client/enter-code"
              style={{
                padding: "12px 24px",
                background: "#1a472a",
                color: "white",
                textDecoration: "none",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Enter Outfitter Code
            </Link>
          )}
          <button
            onClick={() => loadDashboard()}
            style={{
              padding: "12px 24px",
              background: "#f0f0f0",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const customization = data?.dashboardCustomization || {
    heroTitle: "Welcome to Your Client Portal",
    heroSubtitle: "Manage your hunts, documents, and more",
    welcomeText: undefined,
    featureCards: [],
    huntShowcases: [],
    testimonials: [],
    specialSections: [],
    partnerLogos: [],
    contactEnabled: false,
  };

  return (
    <div>
      {/* Hero Section */}
      <section
        style={{
          position: "relative",
          padding: "80px 24px",
          textAlign: "center",
          background: customization.heroImageUrl
            ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${customization.heroImageUrl})`
            : "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 12,
          marginBottom: 48,
          color: "white",
        }}
      >
        <h1 style={{ fontSize: 48, fontWeight: 900, marginBottom: 16, textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
          {customization.heroTitle}
        </h1>
        <p style={{ fontSize: 20, opacity: 0.95, marginBottom: 32, maxWidth: 800, margin: "0 auto 32px" }}>
          {customization.heroSubtitle}
        </p>
        {(customization.ctaPrimaryText || customization.ctaSecondaryText) && (
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {customization.ctaPrimaryText && (
              <a
                href={customization.ctaPrimaryUrl || "#"}
                style={{
                  padding: "14px 32px",
                  background: "#059669",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  display: "inline-block",
                  transition: "background 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#047857";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#059669";
                }}
              >
                {customization.ctaPrimaryText}
              </a>
            )}
            {customization.ctaSecondaryText && (
              <a
                href={customization.ctaSecondaryUrl || "#"}
                style={{
                  padding: "14px 32px",
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  display: "inline-block",
                  border: "2px solid white",
                  transition: "background 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.3)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                }}
              >
                {customization.ctaSecondaryText}
              </a>
            )}
          </div>
        )}
      </section>

      {/* Total Owed from Contracts */}
      {data?.totalOwedFromContracts && data.totalOwedFromContracts > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: "24px 28px",
              background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
              borderRadius: 12,
              border: "2px solid #0f3320",
              color: "white",
              boxShadow: "0 4px 20px rgba(26, 71, 42, 0.35)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 48 }}>💵</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    Total Owed on All Contracts
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: 28, fontWeight: 800 }}>
                    {data.totalOwedFromContractsFormatted || `$${data.totalOwedFromContracts.toFixed(2)}`}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href="/client/my-contracts"
                  style={{
                    display: "inline-block",
                    padding: "14px 28px",
                    background: "white",
                    color: "#1a472a",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 16,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  View Contracts & Pay →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Payment due — prominent so client sees it right away; include breakdown so amount matches iOS */}
      {data?.paymentDue && data.paymentDue.balanceDueCents > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: "24px 28px",
              background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
              borderRadius: 12,
              border: "2px solid #0f3320",
              color: "white",
              boxShadow: "0 4px 20px rgba(26, 71, 42, 0.35)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: data.paymentDue.breakdown?.length ? 20 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 48 }}>💵</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    Payment due
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: 28, fontWeight: 800 }}>
                    {data.paymentDue.balanceDueFormatted}
                  </p>
                  <p style={{ margin: "6px 0 0 0", fontSize: 14, opacity: 0.9 }}>
                    {data.paymentDue.itemCount === 1
                      ? "1 item due"
                      : `${data.paymentDue.itemCount} payments due`}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href={
                    data.paymentDue.firstPayItemId
                      ? `/client/pay?item_id=${encodeURIComponent(data.paymentDue.firstPayItemId)}`
                      : "/client/documents/hunt-contract"
                  }
                  style={{
                    display: "inline-block",
                    padding: "14px 28px",
                    background: "white",
                    color: "#1a472a",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 16,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  Pay now
                </Link>
                <Link
                  href="/client/documents/hunt-contract"
                  style={{
                    display: "inline-block",
                    padding: "14px 24px",
                    background: "rgba(255,255,255,0.2)",
                    color: "white",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 15,
                    border: "2px solid rgba(255,255,255,0.8)",
                  }}
                >
                  View contract & payment
                </Link>
              </div>
            </div>
            {data.paymentDue.breakdown && data.paymentDue.breakdown.length > 0 && (
              <div
                style={{
                  padding: "16px 20px",
                  background: "rgba(0,0,0,0.15)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, opacity: 0.95 }}>What you&apos;re paying for</h3>
                {data.paymentDue.breakdown.map((row) => (
                  <div key={row.payment_item_id} style={{ fontSize: 14, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{row.description}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ opacity: 0.9 }}>Subtotal (guide fee + add-ons)</span>
                        <span>${(row.subtotal_cents / 100).toLocaleString()}</span>
                      </div>
                      {row.platform_fee_cents > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ opacity: 0.9 }}>Platform fee</span>
                          <span>${(row.platform_fee_cents / 100).toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginTop: 4 }}>
                        <span>Total</span>
                        <span>${(row.total_cents / 100).toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginTop: 2 }}>
                        <span>Balance due</span>
                        <span>${(row.balance_due_cents / 100).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Welcome Text (below hero) */}
      {customization.welcomeText && (
        <section style={{ marginBottom: 48, textAlign: "center" }}>
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: "32px 24px",
              background: "white",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <p style={{ fontSize: 18, lineHeight: 1.8, color: "#374151", margin: 0 }}>
              {customization.welcomeText}
            </p>
          </div>
        </section>
      )}

      {/* Feature Cards */}
      {customization.featureCards && customization.featureCards.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 24,
            }}
          >
            {customization.featureCards.map((card, idx) => (
              <Link
                key={idx}
                href={card.href}
                style={{
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 32,
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  textAlign: "center",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {card.icon && <div style={{ fontSize: 48, marginBottom: 16 }}>{card.icon}</div>}
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#1a472a" }}>
                  {card.title}
                </h3>
                <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>{card.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hunt Showcases */}
      {customization.huntShowcases && customization.huntShowcases.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
            Our Hunts
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            {customization.huntShowcases.map((showcase, idx) => (
              <Link
                key={idx}
                href={showcase.href}
                style={{
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {showcase.imageUrl && (
                  <div
                    style={{
                      width: "100%",
                      height: 200,
                      backgroundImage: `url(${showcase.imageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1a472a" }}>{showcase.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Required Documents Section */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Required Documents</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <DocumentCard
            title="Pre-Hunt Questionnaire"
            description="Health, emergency contact, and preferences"
            status={data?.documentStatus?.questionnaire || "not_started"}
            href="/client/documents/questionnaire"
          />
          <DocumentCard
            title="Pre-Draw Contract"
            description="Species selections and draw authorization"
            status={data?.documentStatus?.predraw || "not_started"}
            href="/client/documents/pre-draw"
          />
          <DocumentCard
            title="Waiver of Liability"
            description="Required liability waiver"
            status={data?.documentStatus?.waiver || "not_started"}
            href="/client/documents/waiver"
          />
          <DocumentCard
            title="Hunt Contract"
            description="Available after tag confirmation"
            status={data?.documentStatus?.contract || "not_available"}
            href="/client/documents/hunt-contract"
          />
        </div>
      </section>

      {/* Upcoming Hunts */}
      {data?.upcomingHunts && data.upcomingHunts.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Upcoming Hunts</h2>
          <div
            style={{
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {data.upcomingHunts.map((hunt, idx) => (
              <div
                key={hunt.id}
                style={{
                  padding: 20,
                  borderBottom: idx < data.upcomingHunts.length - 1 ? "1px solid #eee" : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ fontWeight: 600, marginBottom: 4, fontSize: 18 }}>{hunt.title}</h3>
                  <p style={{ color: "#666", fontSize: 14 }}>
                    {formatDateRange(hunt.start_time, hunt.end_time)}
                    {hunt.species && ` • ${hunt.species}`}
                    {hunt.unit && ` • Unit ${hunt.unit}`}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {hunt.guide_username && (
                    <span style={{ fontSize: 14, color: "#666" }}>Guide: {hunt.guide_username}</span>
                  )}
                  <span
                    style={{
                      padding: "6px 16px",
                      background: getStatusColor(hunt.status),
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {hunt.status || "Inquiry"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/client/calendar"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: "#1a472a",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            View Full Calendar →
          </Link>
        </section>
      )}

      {/* Testimonials */}
      {customization.testimonials && customization.testimonials.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: "center" }}>
            Client Testimonials
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}
          >
            {customization.testimonials.map((testimonial, idx) => (
              <div
                key={idx}
                style={{
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <p style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 16, fontStyle: "italic", color: "#333" }}>
                  "{testimonial.text}"
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {testimonial.imageUrl && (
                    <img
                      src={testimonial.imageUrl}
                      alt={testimonial.name}
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{testimonial.name}</div>
                    <div style={{ fontSize: 14, color: "#666" }}>{testimonial.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Special Sections */}
      {customization.specialSections && customization.specialSections.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          {customization.specialSections.map((section, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 32,
                alignItems: "center",
                marginBottom: 48,
                background: "white",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid #ddd",
                flexDirection: idx % 2 === 0 ? "row" : "row-reverse",
              }}
            >
              {section.imageUrl && (
                <div
                  style={{
                    flex: "0 0 40%",
                    height: 300,
                    backgroundImage: `url(${section.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              )}
              <div style={{ flex: 1, padding: 40 }}>
                <h3 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16, color: "#1a472a" }}>
                  {section.title}
                </h3>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#666", marginBottom: 24 }}>
                  {section.description}
                </p>
                {section.buttonText && section.href && (
                  <a
                    href={section.href}
                    style={{
                      display: "inline-block",
                      padding: "12px 24px",
                      background: "#059669",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                    }}
                  >
                    {section.buttonText}
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Contact Form */}
      {customization.contactEnabled && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
            Contact Us
          </h2>
          <form
            onSubmit={handleContactSubmit}
            style={{
              maxWidth: 600,
              margin: "0 auto",
              background: "white",
              padding: 32,
              borderRadius: 12,
              border: "1px solid #ddd",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="First name"
                value={contactForm.firstName}
                onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                required
                style={{
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
              <input
                type="text"
                placeholder="Last name"
                value={contactForm.lastName}
                onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                required
                style={{
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            <input
              type="email"
              placeholder="Email*"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              required
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 16,
              }}
            />
            <textarea
              placeholder="Message*"
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              required
              rows={6}
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 16,
                resize: "vertical",
              }}
            />
            <button
              type="submit"
              disabled={submittingContact}
              style={{
                width: "100%",
                padding: 14,
                background: "#059669",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                cursor: submittingContact ? "not-allowed" : "pointer",
              }}
            >
              {submittingContact ? "Submitting..." : "Submit"}
            </button>
          </form>
        </section>
      )}

      {/* Partner Logos */}
      {customization.partnerLogos && customization.partnerLogos.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: "center" }}>
            Proud Partners
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 32,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {customization.partnerLogos.map((partner, idx) => (
              <a
                key={idx}
                href={partner.href || "#"}
                target={partner.href ? "_blank" : undefined}
                rel={partner.href ? "noopener noreferrer" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.7,
                  transition: "opacity 0.2s ease",
                  textDecoration: "none",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = "0.7";
                }}
              >
                <img
                  src={partner.logoUrl}
                  alt={partner.name}
                  style={{
                    maxHeight: 60,
                    maxWidth: 150,
                    objectFit: "contain",
                  }}
                />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DocumentCard({
  title,
  description,
  status,
  href,
}: {
  title: string;
  description: string;
  status: string;
  href: string;
}) {
  const statusConfig = getDocumentStatusConfig(status);

  return (
    <Link
      href={href}
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 24,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontWeight: 600, marginBottom: 8, fontSize: 18 }}>{title}</h3>
          <p style={{ color: "#666", fontSize: 14 }}>{description}</p>
        </div>
        <span
          style={{
            padding: "6px 14px",
            background: statusConfig.bg,
            color: statusConfig.color,
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {statusConfig.label}
        </span>
      </div>
    </Link>
  );
}

function formatDateRange(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", { ...options, year: "numeric" })}`;
  } catch {
    return `${start} - ${end}`;
  }
}

function getStatusColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case "booked":
      return "#e8f5e9";
    case "pending":
      return "#fff3e0";
    case "completed":
      return "#e3f2fd";
    case "cancelled":
      return "#ffebee";
    default:
      return "#f5f5f5";
  }
}

function getDocumentStatusConfig(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case "completed":
    case "signed":
    case "fully_executed":
      return { label: "Completed", bg: "#e8f5e9", color: "#2e7d32" };
    case "in_progress":
    case "submitted":
    case "client_signed":
      return { label: "In Progress", bg: "#e3f2fd", color: "#1565c0" };
    case "not_started":
    case "not_submitted":
      return { label: "Not Started", bg: "#fff3e0", color: "#e65100" };
    case "not_available":
      return { label: "Not Available", bg: "#f5f5f5", color: "#666" };
    default:
      return { label: status, bg: "#f5f5f5", color: "#666" };
  }
}
