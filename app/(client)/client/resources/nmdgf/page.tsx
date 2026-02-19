"use client";

import Link from "next/link";

export default function NMDGFPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/resources"
          style={{ color: "var(--client-accent, #1a472a)", textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Resources
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>NMDGF Account Setup</h1>
        <p style={{ color: "#666" }}>
          Guide to setting up your New Mexico Department of Game & Fish online account.
        </p>
      </div>

      <StepSection
        number={1}
        title="Create Your Account"
        content={
          <>
            <p>Visit the NMDGF website to create your account:</p>
            <a
              href="https://onlinesales.wildlife.state.nm.us/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                background: "var(--client-accent, #1a472a)",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                marginTop: 12,
              }}
            >
              Go to NMDGF Online Sales →
            </a>
            <p style={{ marginTop: 16 }}>Click "Create Account" and follow the prompts.</p>
          </>
        }
      />

      <StepSection
        number={2}
        title="Required Information"
        content={
          <>
            <p>You'll need the following information to complete registration:</p>
            <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
              <li>Full legal name (as shown on ID)</li>
              <li>Date of birth</li>
              <li>Social Security Number (last 4 digits or full)</li>
              <li>Physical address</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Driver's license or state ID information</li>
            </ul>
          </>
        }
      />

      <StepSection
        number={3}
        title="Hunter Education"
        content={
          <>
            <p>
              If you were born after January 1, 1972, you must complete a hunter education course.
              New Mexico accepts hunter education certificates from all states.
            </p>
            <p style={{ marginTop: 12 }}>
              If you need to complete hunter education, you can do so online through the
              New Mexico Hunter Education Program.
            </p>
          </>
        }
      />

      <StepSection
        number={4}
        title="Purchase Game Hunting License"
        content={
          <>
            <p>Before applying for draw hunts, you need a valid New Mexico hunting license:</p>
            <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
              <li><strong>Non-Resident Game Hunting License</strong> - Required for draw applications</li>
              <li><strong>Habitat Stamp</strong> - Required for all hunters</li>
              <li><strong>Habitat Management & Access Validation</strong> - Required</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              These can all be purchased through your NMDGF online account.
            </p>
          </>
        }
      />

      <StepSection
        number={5}
        title="Draw Application"
        content={
          <>
            <p>
              Once your account is set up and licenses purchased, you can apply for draw hunts.
              If you've authorized your outfitter to submit applications on your behalf, they'll handle this step.
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Important deadlines:</strong>
            </p>
            <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
              <li>Elk, Deer, Antelope, Ibex, Barbary Sheep: Usually March</li>
              <li>Oryx, Bighorn Sheep: Usually October/November</li>
              <li>Turkey: Usually January</li>
            </ul>
            <p style={{ marginTop: 12, color: "#666", fontStyle: "italic" }}>
              Exact dates vary by year. Check NMDGF website for current deadlines.
            </p>
          </>
        }
      />

      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#fff9e6",
          borderRadius: 8,
          border: "1px solid #ffe082",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8, color: "#f57f17" }}>Important Notes</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#555", lineHeight: 1.8 }}>
          <li>Keep your NMDGF customer number handy - you'll need it for draw results</li>
          <li>Make sure your email is correct - draw results are sent via email</li>
          <li>Save your username and password in a secure location</li>
          <li>Share your NMDGF username with your outfitter if you want them to submit applications for you</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          background: "#f0f7f4",
          borderRadius: 8,
          border: "1px solid #c8e6c9",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8, color: "var(--client-accent, #1a472a)" }}>Need Help?</h3>
        <p style={{ margin: 0, color: "#555" }}>
          Contact your outfitter if you have any questions about setting up your account or
          applying for draws. We're here to help make the process as smooth as possible.
        </p>
      </div>
    </div>
  );
}

function StepSection({
  number,
  title,
  content,
}: {
  number: number;
  title: string;
  content: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 20,
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--client-accent, #1a472a)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {number}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 12, fontSize: 18 }}>{title}</h3>
          <div style={{ color: "#555", lineHeight: 1.7 }}>{content}</div>
        </div>
      </div>
    </div>
  );
}
