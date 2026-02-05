"use client";

import Link from "next/link";

export default function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="pro-card"
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 20px",
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontWeight: 500, fontSize: 14 }}>{label}</span>
    </Link>
  );
}
