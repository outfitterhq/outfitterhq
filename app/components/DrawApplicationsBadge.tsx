"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function DrawApplicationsBadge() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCount();
    // Refresh every 30 seconds
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadCount() {
    try {
      const currentYear = new Date().getFullYear();
      const res = await fetch(`/api/admin/draw-applications?year=${currentYear}`);
      if (res.ok) {
        const data = await res.json();
        setCount(data.applications?.length || 0);
      }
    } catch (e) {
      console.error("Failed to load draw applications count", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading || count === null || count === 0) {
    return null;
  }

  return (
    <Link
      href="/draw-applications"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: count > 0 ? "#f59e0b" : "transparent",
        color: count > 0 ? "white" : "inherit",
        borderRadius: 6,
        textDecoration: "none",
        fontWeight: count > 0 ? 600 : 400,
        fontSize: 14,
      }}
    >
      <span>📝</span>
      <span>Draw Applications</span>
      {count > 0 && (
        <span
          style={{
            background: "white",
            color: "#f59e0b",
            borderRadius: "50%",
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
