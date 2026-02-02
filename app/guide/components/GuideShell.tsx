"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface GuideShellProps {
  children: React.ReactNode;
  guideName?: string;
  guideEmail?: string;
}

const TABS = [
  { href: "/guide", label: "Dashboard", icon: "🏠" },
  { href: "/guide/schedule", label: "My Schedule", icon: "📅" },
  { href: "/guide/calendar", label: "Calendar", icon: "📆" },
  { href: "/guide/packets", label: "Hunt Packets", icon: "📦" },
  { href: "/guide/profile", label: "Profile", icon: "👤" },
  { href: "/guide/documents", label: "Documents", icon: "📄" },
  { href: "/guide/time-off", label: "Time Off", icon: "⏰" },
];

export default function GuideShell({ children, guideName, guideEmail }: GuideShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string): boolean {
    if (href === "/guide") {
      return pathname === "/guide";
    }
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {/* Header */}
      <header
        style={{
          background: "#059669",
          color: "white",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/guide"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            Guide Portal
          </Link>
          {guideName && (
            <span style={{ opacity: 0.9, fontSize: 14 }}>{guideName}</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {guideEmail && <span style={{ fontSize: 14 }}>{guideEmail}</span>}
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav
        style={{
          background: "white",
          borderBottom: "1px solid #ddd",
          padding: "0 24px",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 0,
            minWidth: "max-content",
          }}
        >
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  padding: "16px 20px",
                  textDecoration: "none",
                  color: active ? "#059669" : "#666",
                  fontWeight: active ? 600 : 400,
                  borderBottom: active ? "3px solid #059669" : "3px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
