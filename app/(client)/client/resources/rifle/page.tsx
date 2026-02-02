"use client";

import Link from "next/link";

export default function RifleGearPage() {
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
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Rifle Gear List</h1>
        <p style={{ color: "#666" }}>
          Essential equipment recommendations for rifle hunting in New Mexico.
        </p>
      </div>

      <GearSection
        title="Firearm & Ammunition"
        items={[
          { name: "Rifle", note: ".270, .308, .30-06, or similar" },
          { name: "Ammunition (40+ rounds)", note: "Premium hunting ammo, zeroed" },
          { name: "Rifle Scope", note: "3-9x40 or similar variable power" },
          { name: "Rifle Sling", note: "Padded for comfort" },
          { name: "Rifle Case", note: "Hard case for travel" },
          { name: "Cleaning Kit", note: "For field maintenance" },
          { name: "Bore Snake", note: "Quick cleaning" },
          { name: "Lens Covers", note: "Flip-up or bikini style" },
          { name: "Shooting Sticks/Bipod", note: "For steady shots" },
        ]}
      />

      <GearSection
        title="Optics"
        items={[
          { name: "Binoculars", note: "10x42 or 12x50" },
          { name: "Rangefinder", note: "1000+ yard capability" },
          { name: "Spotting Scope", note: "20-60x with tripod" },
          { name: "Tripod", note: "Sturdy for glassing" },
        ]}
      />

      <GearSection
        title="Clothing"
        items={[
          { name: "Blaze Orange Vest/Hat", note: "Required during rifle season" },
          { name: "Base Layers", note: "Moisture-wicking" },
          { name: "Insulating Layers", note: "Fleece or down" },
          { name: "Outer Shell", note: "Wind/water resistant" },
          { name: "Hunting Boots", note: "Insulated, waterproof" },
          { name: "Warm Gloves", note: "Convertible recommended" },
          { name: "Warm Hat", note: "Beanie or cap with ear coverage" },
          { name: "Gaiters", note: "For snow/brush" },
          { name: "Rain Gear", note: "Packable" },
        ]}
      />

      <GearSection
        title="Pack & Essentials"
        items={[
          { name: "Hunting Pack", note: "40-60L for day hunts" },
          { name: "Water (3L minimum)", note: "Hydration bladder or bottles" },
          { name: "Headlamp", note: "With extra batteries" },
          { name: "GPS/Phone", note: "With maps downloaded" },
          { name: "First Aid Kit", note: "Comprehensive" },
          { name: "Game Bags", note: "Lightweight mesh" },
          { name: "Knife Set", note: "Skinning and caping knives" },
          { name: "Bone Saw", note: "Folding" },
          { name: "Paracord (50ft)", note: "Multiple uses" },
          { name: "Fire Starter", note: "Lighter + backup" },
          { name: "Emergency Blanket", note: "Space blanket" },
          { name: "Snacks", note: "High calorie, easy to eat" },
        ]}
      />

      <GearSection
        title="Vehicle Gear"
        items={[
          { name: "Cooler", note: "For meat storage" },
          { name: "Ice/Ice Packs", note: "Keep meat cold" },
          { name: "Tarp", note: "For meat protection" },
          { name: "Recovery Gear", note: "If going off-road" },
          { name: "Extra Fuel", note: "For remote areas" },
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
          <li>Verify rifle zero before leaving home and after travel</li>
          <li>Blaze orange is required - bring extra in case of loss</li>
          <li>November rifle seasons can be very cold - prepare for single digits</li>
          <li>Practice shooting from realistic field positions</li>
          <li>Know your maximum effective range and stick to it</li>
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
