"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "pricing">("overview");

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #f8f9fa, #ffffff)" }}>
      {/* Header */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #e0e0e0",
          padding: "16px 0",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <Image
              src="/outfitterhq-logo.png"
              alt="Outfitter HQ"
              width={180}
              height={60}
              style={{ height: "auto", maxHeight: "50px", width: "auto" }}
              priority
            />
          </Link>
          <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <button
              onClick={() => setActiveTab("overview")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: activeTab === "overview" ? "#1a472a" : "#666",
                fontWeight: activeTab === "overview" ? 600 : 400,
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("features")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: activeTab === "features" ? "#1a472a" : "#666",
                fontWeight: activeTab === "features" ? 600 : 400,
              }}
            >
              Features
            </button>
            <button
              onClick={() => setActiveTab("pricing")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: activeTab === "pricing" ? "#1a472a" : "#666",
                fontWeight: activeTab === "pricing" ? 600 : 400,
              }}
            >
              Pricing
            </button>
            <Link
              href="/login"
              style={{
                padding: "8px 20px",
                background: "#1a472a",
                color: "white",
                textDecoration: "none",
                borderRadius: 6,
                fontWeight: 500,
              }}
            >
              Log In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: "80px 24px", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, display: "flex", justifyContent: "center" }}>
          <Image
            src="/outfitterhq-logo.png"
            alt="Outfitter HQ"
            width={300}
            height={100}
            style={{ height: "auto", maxHeight: "120px", width: "auto" }}
            priority
          />
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16, color: "#1a472a" }}>
          Complete Hunt Management Platform
        </h1>
        <p style={{ fontSize: 20, color: "#666", marginBottom: 32, lineHeight: 1.6 }}>
          Streamline your outfitting business with client management, scheduling, contracts, payments, and more.
          Built for outfitters, guides, and clients.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/signup-client"
            style={{
              padding: "16px 32px",
              background: "#1a472a",
              color: "white",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Sign Up as Client
          </Link>
          <Link
            href="/signup-outfitter"
            style={{
              padding: "16px 32px",
              background: "white",
              color: "#1a472a",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
              border: "2px solid #1a472a",
            }}
          >
            Sign Up as Outfitter
          </Link>
        </div>
      </section>

      {/* Tab Content */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "features" && <FeaturesTab />}
        {activeTab === "pricing" && <PricingTab />}
      </section>

      {/* Footer */}
      <footer style={{ background: "#1a472a", color: "white", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, opacity: 0.9 }}>© 2025 Outfitter HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}

function OverviewTab() {
  return (
    <div>
      <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>How It Works</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
        <FeatureCard
          icon="👥"
          title="For Outfitters"
          description="Manage your entire operation from one platform. Schedule hunts, track clients, generate contracts, process payments, and coordinate with guides."
        />
        <FeatureCard
          icon="🎯"
          title="For Guides"
          description="Access your schedule, view client questionnaires, track time off, and manage your hunts all from your mobile device or web browser."
        />
        <FeatureCard
          icon="🏹"
          title="For Clients"
          description="Complete questionnaires, submit pre-draw applications, sign contracts, make payments, and stay organized for your hunt—all in one place."
        />
      </div>

      <div style={{ marginTop: 64, background: "white", padding: 40, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <h3 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Key Benefits</h3>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
          <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <strong>Streamlined Workflow:</strong> From client inquiry to hunt completion, manage everything in one system.
            </div>
          </li>
          <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <strong>Automated Contracts:</strong> Generate hunt contracts automatically when tags are confirmed.
            </div>
          </li>
          <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <strong>Payment Processing:</strong> Integrated Stripe payments with automatic fee calculation and transfers.
            </div>
          </li>
          <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <strong>Mobile & Web:</strong> Access from anywhere—iOS app for guides and clients, web portal for admins.
            </div>
          </li>
          <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <strong>Document Management:</strong> Digital questionnaires, contracts, waivers, and pre-draw submissions.
            </div>
          </li>
          <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <strong>Year-End Record Keeping:</strong> All documents and records organized by year with export and archive functionality for easy closeout and compliance.
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

function FeaturesTab() {
  return (
    <div>
      <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: "center" }}>Platform Features</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        <FeatureBox
          title="Calendar & Scheduling"
          description="Visual calendar for all hunts, guide assignments, and time-off requests. Drag-and-drop scheduling with conflict detection."
        />
        <FeatureBox
          title="Client Management"
          description="Complete client profiles, contact information, hunt history, and document tracking. Link clients to outfitters via codes."
        />
        <FeatureBox
          title="Pre-Hunt Questionnaires"
          description="Digital questionnaires for health, emergency contacts, food preferences, and accommodations. Guides can view assigned clients."
        />
        <FeatureBox
          title="Pre-Draw Submissions"
          description="Streamlined pre-draw application process with species selections, NMDGF integration, and DocuSign support."
        />
        <FeatureBox
          title="Hunt Contracts"
          description="Auto-generated contracts from templates when tags are confirmed. Client completion, DocuSign integration, and digital signatures."
        />
        <FeatureBox
          title="Payment Processing"
          description="Stripe Connect integration for direct payments to outfitters. Automatic platform fee calculation, deposits, and payment tracking."
        />
        <FeatureBox
          title="Guide Portal"
          description="Mobile-friendly guide dashboard with schedule, client questionnaires, time-off requests, and document uploads."
        />
        <FeatureBox
          title="Draw Results Management"
          description="Track draw applications, results, and tag confirmations. Automatic contract generation on success."
        />
        <FeatureBox
          title="Tags for Sale"
          description="Manage tags for sale (Private Land or Unit Wide), pricing, and client purchases. Track tag inventory and sales."
        />
        <FeatureBox
          title="Record Keeping & Year-End Closeout"
          description="Complete record management system that organizes all documents, contracts, payments, and hunt data by year. Year-end closeout tools let you export and archive annual records, keeping everything organized for tax season and compliance."
        />
      </div>
    </div>
  );
}

function PricingTab() {
  return (
    <div>
      <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>Pricing for Outfitters</h2>
      <p style={{ textAlign: "center", color: "#666", marginBottom: 48, fontSize: 18 }}>
        Simple, transparent pricing. Pay only when you get paid.
      </p>

      <div style={{ maxWidth: 600, margin: "0 auto", background: "white", padding: 48, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#1a472a", marginBottom: 8 }}>5%</div>
          <div style={{ fontSize: 20, color: "#666" }}>Platform Fee</div>
          <div style={{ fontSize: 14, color: "#999", marginTop: 8 }}>Charged only on successful transactions</div>
        </div>

        <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 32 }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>What's Included</h3>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Unlimited clients, hunts, and guides</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Full calendar and scheduling system</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Contract generation and DocuSign integration</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Payment processing via Stripe Connect</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Client and guide mobile apps</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Document management and storage</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Pre-draw submission tools</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <span style={{ color: "#1a472a", fontSize: 18 }}>✓</span>
              <span>Email support</span>
            </li>
          </ul>
        </div>

        <div style={{ marginTop: 32, padding: 24, background: "#f0f7f4", borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#666", lineHeight: 1.6 }}>
            <strong>Example:</strong> If a client pays $5,000 for a hunt, you receive $4,750 (95%) and we take $250 (5%) as the platform fee.
            Stripe processing fees (~2.9% + $0.30) are separate and deducted by Stripe.
          </p>
        </div>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link
            href="/signup-outfitter"
            style={{
              display: "inline-block",
              padding: "16px 32px",
              background: "#1a472a",
              color: "white",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Get Started Free
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 48, textAlign: "center", color: "#666" }}>
        <p>No setup fees. No monthly subscriptions. No hidden costs.</p>
        <p style={{ marginTop: 8 }}>Questions? Contact us at support@outfitterhq.com</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{ background: "white", padding: 32, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "#666", lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

function FeatureBox({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ background: "white", padding: 24, borderRadius: 8, border: "1px solid #e0e0e0" }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "#666", fontSize: 14, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}
