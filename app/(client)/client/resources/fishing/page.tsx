"use client";

import Link from "next/link";

export default function FishingPage() {
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
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Fishing Information</h1>
        <p style={{ color: "#666" }}>
          Local fishing spots and regulations for the New Mexico area.
        </p>
      </div>

      <Section
        title="Fishing Opportunities"
        content={
          <>
            <p>
              New Mexico offers excellent fishing opportunities, from high mountain streams to
              desert lakes. During your visit, you may have opportunities to fish for:
            </p>
            <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
              <li><strong>Trout</strong> - Rainbow, Brown, and Cutthroat in mountain streams and lakes</li>
              <li><strong>Bass</strong> - Largemouth and Smallmouth in warmer waters</li>
              <li><strong>Catfish</strong> - Channel catfish in lakes and rivers</li>
              <li><strong>Walleye</strong> - In select larger lakes</li>
            </ul>
          </>
        }
      />

      <Section
        title="License Requirements"
        content={
          <>
            <p>All anglers 12 years and older must have a valid New Mexico fishing license.</p>
            <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
              <li>Licenses can be purchased at NMDGF online or local vendors</li>
              <li>Non-resident licenses available as 1-day, 5-day, or annual</li>
              <li>Trout stamp may be required in some waters</li>
            </ul>
            <a
              href="https://onlinesales.wildlife.state.nm.us/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                background: "var(--client-accent, #1a472a)",
                color: "white",
                borderRadius: 6,
                textDecoration: "none",
                fontWeight: 500,
                marginTop: 8,
                fontSize: 14,
              }}
            >
              Purchase License →
            </a>
          </>
        }
      />

      <Section
        title="Regulations"
        content={
          <>
            <p>Key regulations to be aware of:</p>
            <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
              <li>Bag limits vary by species and water body</li>
              <li>Some waters are catch-and-release only</li>
              <li>Special regulations may apply in certain areas</li>
              <li>Always check current regulations for specific waters</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              Full regulations are available in the NMDGF fishing proclamation.
            </p>
          </>
        }
      />

      <Section
        title="Recommended Gear"
        content={
          <>
            <p>Basic fishing gear to bring:</p>
            <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
              <li>Rod and reel appropriate for target species</li>
              <li>Tackle box with variety of lures/flies</li>
              <li>Fishing line (6-10 lb test for trout)</li>
              <li>Polarized sunglasses</li>
              <li>Fishing license and regulations</li>
              <li>Cooler for keeping fish (if keeping)</li>
              <li>Sunscreen and hat</li>
            </ul>
          </>
        }
      />

      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#e3f2fd",
          borderRadius: 8,
          border: "1px solid #90caf9",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8, color: "#1565c0" }}>Local Recommendations</h3>
        <p style={{ margin: 0, color: "#555" }}>
          Ask your guide about local fishing spots during your visit. Many of our hunting areas
          have excellent fishing nearby, and we may be able to arrange fishing time during your stay.
        </p>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          background: "#f5f5f5",
          borderRadius: 8,
          border: "1px solid #ddd",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Useful Links</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
          <li>
            <a
              href="https://www.wildlife.state.nm.us/fishing/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--client-accent, #1a472a)" }}
            >
              NMDGF Fishing Page
            </a>
          </li>
          <li>
            <a
              href="https://www.wildlife.state.nm.us/fishing/weekly-report/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--client-accent, #1a472a)" }}
            >
              Weekly Fishing Report
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Section({ title, content }: { title: string; content: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 24,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "var(--client-accent, #1a472a)" }}>
        {title}
      </h2>
      <div style={{ color: "#555", lineHeight: 1.7 }}>{content}</div>
    </div>
  );
}
