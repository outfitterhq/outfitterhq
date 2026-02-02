"use client";

import Link from "next/link";

export default function ArcheryGearPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/resources"
          style={{ color: "#1a472a", textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Resources
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Archery Gear List</h1>
        <p style={{ color: "#666" }}>
          Essential equipment recommendations for archery hunting in New Mexico.
        </p>
      </div>

      <GearSection
        title="Bow & Accessories"
        items={[
          { name: "Compound Bow", note: "60-70 lb draw weight recommended" },
          { name: "Arrows (12+)", note: "Carbon arrows with broadhead-compatible inserts" },
          { name: "Broadheads (12+)", note: "Fixed or mechanical, 100+ grain" },
          { name: "Release Aid", note: "Bring a backup" },
          { name: "Bow Case", note: "Hard case for travel" },
          { name: "String Wax", note: "For bow maintenance" },
          { name: "Allen Keys / Hex Set", note: "For bow adjustments" },
          { name: "Sight", note: "Single or multi-pin" },
          { name: "Stabilizer", note: "Optional but recommended" },
          { name: "Arrow Rest", note: "Drop-away or whisker biscuit" },
        ]}
      />

      <GearSection
        title="Optics"
        items={[
          { name: "Binoculars", note: "10x42 recommended" },
          { name: "Rangefinder", note: "Essential for archery" },
          { name: "Spotting Scope", note: "20-60x with tripod" },
          { name: "Tripod", note: "For glassing sessions" },
        ]}
      />

      <GearSection
        title="Clothing"
        items={[
          { name: "Camo Base Layers", note: "Moisture-wicking" },
          { name: "Camo Mid Layers", note: "Fleece or insulated" },
          { name: "Camo Outer Layer", note: "Quiet fabric, wind/water resistant" },
          { name: "Hunting Boots", note: "Broken in, ankle support" },
          { name: "Gaiters", note: "For brush and snakes" },
          { name: "Gloves", note: "Both warm and release-compatible" },
          { name: "Face Mask/Paint", note: "For concealment" },
          { name: "Hat", note: "Brimmed for sun, beanie for cold" },
          { name: "Rain Gear", note: "Packable jacket and pants" },
        ]}
      />

      <GearSection
        title="Pack & Essentials"
        items={[
          { name: "Hunting Pack", note: "40-60L with frame for meat haul" },
          { name: "Hydration System", note: "Bladder or bottles (3L minimum)" },
          { name: "Headlamp", note: "With extra batteries" },
          { name: "GPS/Phone", note: "With onX or similar maps" },
          { name: "First Aid Kit", note: "Including blister care" },
          { name: "Game Bags", note: "Lightweight mesh bags" },
          { name: "Knife", note: "Fixed blade for field dressing" },
          { name: "Bone Saw", note: "Folding style" },
          { name: "Paracord", note: "50+ feet" },
          { name: "Fire Starter", note: "Lighter and backup" },
          { name: "Emergency Blanket", note: "Mylar or similar" },
        ]}
      />

      <GearSection
        title="Camp Gear (if camping)"
        items={[
          { name: "Tent", note: "3-season minimum" },
          { name: "Sleeping Bag", note: "Rated for 20°F or lower" },
          { name: "Sleeping Pad", note: "Insulated" },
          { name: "Camp Chair", note: "Lightweight" },
          { name: "Cooler", note: "For meat storage" },
        ]}
      />

      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#f0f7f4",
          borderRadius: 8,
          border: "1px solid #c8e6c9",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8, color: "#1a472a" }}>Pro Tips</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#555", lineHeight: 1.8 }}>
          <li>Practice shooting at various angles and distances before the hunt</li>
          <li>Test all broadheads for flight consistency</li>
          <li>Break in boots at least 2 weeks before arrival</li>
          <li>New Mexico can vary from 40°F to 90°F - layer appropriately</li>
          <li>Bring more arrows than you think you'll need</li>
        </ul>
      </div>
    </div>
  );
}

function GearSection({ title, items }: { title: string; items: { name: string; note?: string }[] }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #eee",
          background: "#fafafa",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
      </div>
      <div style={{ padding: 16 }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: idx < items.length - 1 ? "1px solid #f0f0f0" : "none",
            }}
          >
            <span style={{ fontWeight: 500 }}>☐ {item.name}</span>
            {item.note && <span style={{ color: "#666", fontSize: 14 }}>{item.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
