"use client";

import Link from "next/link";

export default function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "16px 20px",
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "background 0.15s ease",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "#f9f9f9";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "white";
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontWeight: 500 }}>{label}</span>
    </Link>
  );
}
