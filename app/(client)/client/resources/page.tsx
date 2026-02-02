"use client";

import Link from "next/link";

const RESOURCES = [
  {
    title: "Archery Gear List",
    description: "Essential equipment and recommendations for archery hunts",
    icon: "🏹",
    href: "/client/resources/archery",
  },
  {
    title: "Rifle Gear List",
    description: "Essential equipment and recommendations for rifle hunts",
    icon: "🎯",
    href: "/client/resources/rifle",
  },
  {
    title: "Antelope & Oryx Gear",
    description: "Specialized gear for antelope and oryx hunts",
    icon: "🦌",
    href: "/client/resources/antelope-oryx",
  },
  {
    title: "NMDGF Account Setup",
    description: "Guide to setting up your New Mexico Game & Fish account",
    icon: "📋",
    href: "/client/resources/nmdgf",
  },
  {
    title: "Fishing Information",
    description: "Local fishing spots and regulations",
    icon: "🎣",
    href: "/client/resources/fishing",
  },
];

export default function ClientResourcesPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Resources</h1>
        <p style={{ color: "#666" }}>
          Helpful guides, gear lists, and information to help you prepare for your hunt.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {RESOURCES.map((resource) => (
          <Link
            key={resource.href}
            href={resource.href}
            style={{
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 24,
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              transition: "box-shadow 0.15s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                fontSize: 32,
                width: 56,
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f0f7f4",
                borderRadius: 12,
                flexShrink: 0,
              }}
            >
              {resource.icon}
            </div>
            <div>
              <h3 style={{ fontWeight: 600, marginBottom: 4 }}>{resource.title}</h3>
              <p style={{ color: "#666", fontSize: 14, margin: 0 }}>{resource.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
