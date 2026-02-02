"use client";

import Link from "next/link";

export default function QuickCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 20,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        transition: "box-shadow 0.15s ease",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 32 }}>{icon}</span>
        <div>
          <h3 style={{ fontWeight: 600, marginBottom: 4, fontSize: 18 }}>{title}</h3>
          <p style={{ color: "#666", fontSize: 14, margin: 0 }}>{description}</p>
        </div>
      </div>
    </Link>
  );
}
