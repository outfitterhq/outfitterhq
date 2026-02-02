"use client";

import Link from "next/link";

export default function AntelopeOryxGearPage() {
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
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Antelope & Oryx Gear List</h1>
        <p style={{ color: "#666" }}>
          Specialized equipment for hunting antelope and oryx in New Mexico's open country.
        </p>
      </div>

      <div
        style={{
          background: "#fff9e6",
          border: "1px solid #ffe082",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: "0 0 8px", color: "#f57f17" }}>Special Considerations</h3>
        <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
          Antelope and oryx hunting typically involves long-range shooting in open, arid terrain.
          Prepare for extreme sun exposure, wind, and temperature swings.
        </p>
      </div>

      <GearSection
        title="Firearm Setup"
        items={[
          { name: "Flat-shooting Rifle", note: ".25-06, .270, 6.5 Creedmoor, etc." },
          { name: "Quality Scope", note: "4-16x or higher magnification" },
          { name: "Ammunition (60+ rounds)", note: "Long-range capable" },
          { name: "Bipod", note: "Essential for prone shooting" },
          { name: "Shooting Mat", note: "For ground shooting" },
          { name: "Rear Bag", note: "For stable shots" },
          { name: "Rifle Sling", note: "For carrying" },
          { name: "Data Book", note: "For recording drops/wind holds" },
        ]}
      />

      <GearSection
        title="Optics (Critical)"
        items={[
          { name: "High-Power Binoculars", note: "12x50 or 15x56" },
          { name: "Rangefinder", note: "1500+ yard capability" },
          { name: "Spotting Scope", note: "20-60x minimum" },
          { name: "Quality Tripod", note: "Carbon fiber recommended" },
          { name: "Bino Harness", note: "For all-day carry" },
        ]}
      />

      <GearSection
        title="Clothing - Sun & Heat"
        items={[
          { name: "Long-sleeve Sun Shirt", note: "UPF 50+" },
          { name: "Sun Hoodie", note: "For head/neck protection" },
          { name: "Wide-Brim Hat", note: "Essential" },
          { name: "Buff/Neck Gaiter", note: "Sun and dust protection" },
          { name: "Sunglasses", note: "Polarized" },
          { name: "Light Gloves", note: "Sun protection" },
          { name: "Lightweight Pants", note: "Quick-dry, ventilated" },
          { name: "Light Hiking Boots", note: "Breathable" },
        ]}
      />

      <GearSection
        title="Clothing - Cold Mornings"
        items={[
          { name: "Puffy Jacket", note: "For dawn sits" },
          { name: "Fleece Layer", note: "For layering" },
          { name: "Warm Hat", note: "For cold mornings" },
          { name: "Warm Gloves", note: "For early hours" },
        ]}
      />

      <GearSection
        title="Essentials"
        items={[
          { name: "Water (4L+ per day)", note: "Hydration is critical" },
          { name: "Electrolytes", note: "For heat management" },
          { name: "Sunscreen SPF 50+", note: "Reapply frequently" },
          { name: "Lip Balm with SPF", note: "Prevent cracking" },
          { name: "Light Day Pack", note: "20-30L" },
          { name: "Seat Cushion", note: "For long glassing sessions" },
          { name: "Snacks", note: "High energy, won't melt" },
          { name: "GPS/Phone", note: "With maps" },
          { name: "First Aid", note: "Include heat illness supplies" },
        ]}
      />

      <GearSection
        title="Oryx-Specific (White Sands Area)"
        items={[
          { name: "Lighter Colors", note: "Desert camo or tan" },
          { name: "Eye Protection", note: "For white sand glare" },
          { name: "Vehicle Shade", note: "Canopy or tarp" },
          { name: "Extra Water", note: "2x normal amount" },
          { name: "Snake Gaiters", note: "Recommended" },
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
          <li>Practice shooting at 300-500 yards before the hunt</li>
          <li>Know your rifle's ballistics and come with a drop chart</li>
          <li>Wind reading is essential - bring a Kestrel or similar</li>
          <li>Antelope have incredible eyesight - stay low and move slowly</li>
          <li>Start hydrating days before arrival</li>
          <li>Oryx are tough - be prepared for follow-up shots</li>
          <li>The desert sun is intense - even in winter, protect yourself</li>
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
