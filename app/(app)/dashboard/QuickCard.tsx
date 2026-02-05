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
    <Link href={href} className="pro-card" style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div
          style={{
            fontSize: 36,
            lineHeight: 1,
            flexShrink: 0,
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-gray-50)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="pro-card-title">{title}</h3>
          <p className="pro-card-description">{description}</p>
        </div>
      </div>
    </Link>
  );
}
