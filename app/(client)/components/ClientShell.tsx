"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";

interface ClientShellProps {
  children: React.ReactNode;
  userEmail: string;
  userName: string;
  clientId?: string;
  outfitterId: string;
  outfitterName: string;
  linkedOutfitters: { outfitter_id: string; outfitter_name: string }[];
  logoUrl?: string;
  backgroundType?: "color" | "image" | "per-page";
  backgroundColor?: string;
  backgroundImageUrl?: string;
  perPageBackgrounds?: Record<string, { type: "color" | "image"; value: string }>;
  headerColor?: string;
}

const TABS = [
  { href: "/client", label: "Dashboard", icon: "🏠" },
  { href: "/client/my-contracts", label: "My Contracts", icon: "📋" },
  { href: "/client/calendar", label: "My Calendar", icon: "📅" },
  { href: "/client/documents", label: "My Documents", icon: "📄" },
  { href: "/client/payments", label: "My Payments", icon: "💳" },
  { href: "/client/pricing", label: "Pricing", icon: "💰" },
  { href: "/client/private-tags", label: "Tags for Sale", icon: "🏷️" },
  { href: "/client/success-history", label: "Past Success", icon: "🏆" },
  { href: "/client/resources", label: "Resources", icon: "📚" },
];

export default function ClientShell({
  children,
  userEmail,
  userName,
  clientId,
  outfitterId,
  outfitterName,
  linkedOutfitters,
  logoUrl,
  backgroundType = "color",
  backgroundColor = "#f5f5f5",
  backgroundImageUrl,
  perPageBackgrounds = {},
  headerColor = "#1a472a",
}: ClientShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function isActive(href: string): boolean {
    if (href === "/client") {
      return pathname === "/client";
    }
    return pathname.startsWith(href);
  }

  // Determine background style based on type and current page
  function getBackgroundStyle(): React.CSSProperties {
    // If per-page mode, check for page-specific background
    if (backgroundType === "per-page") {
      // Try to find matching page background
      // Check exact path first, then try prefix matches
      const pageKey = Object.keys(perPageBackgrounds || {}).find((key) => {
        if (key === "/client" && pathname === "/client") return true;
        return pathname.startsWith(key) && key !== "/client";
      });

      if (pageKey && perPageBackgrounds[pageKey]) {
        const pageBg = perPageBackgrounds[pageKey];
        if (pageBg.type === "image") {
          return {
            backgroundImage: `url(${pageBg.value})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          };
        } else {
          return { backgroundColor: pageBg.value };
        }
      }
      // Fallback to default color if no per-page background found
      return { backgroundColor: backgroundColor };
    }

    // Global image background
    if (backgroundType === "image" && backgroundImageUrl) {
      return {
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      };
    }

    // Default color background
    return { backgroundColor: backgroundColor };
  }

  const backgroundStyle = getBackgroundStyle();

  return (
    <div className="client-shell" style={{ minHeight: "100vh", ...backgroundStyle }}>
      {/* Header */}
      <header
        className="client-shell-header"
        style={{
          background: headerColor,
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
        <div className="client-shell-header-title" style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={outfitterName}
              style={{
                height: 40,
                width: "auto",
                maxWidth: 200,
                objectFit: "contain",
              }}
            />
          )}
          <Link
            href="/client"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: logoUrl ? 18 : 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {outfitterName}
          </Link>
          <span style={{ opacity: 0.7, fontSize: 14, flexShrink: 0 }}>Client Portal</span>
        </div>

        <div className="client-shell-header-right" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <NotificationBell userRole="client" />
          <span style={{ fontSize: 14 }}>{userName || userEmail}</span>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              minHeight: 44,
              minWidth: 44,
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Tab Navigation - Desktop: horizontal scroll */}
      <nav
        className="client-tabs-desktop"
        style={{
          background: "white",
          borderBottom: "1px solid #ddd",
          padding: "0 24px",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ display: "flex", gap: 0, minWidth: "max-content" }}>
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="nav-link"
                style={{
                  padding: "16px 20px",
                  textDecoration: "none",
                  color: active ? "#1a472a" : "#666",
                  fontWeight: active ? 600 : 400,
                  borderBottom: active ? "3px solid #1a472a" : "3px solid transparent",
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

      {/* Tab Navigation - Mobile: hamburger + dropdown */}
      <nav
        className="client-tabs-mobile"
        style={{
          display: "none",
          background: "white",
          borderBottom: "1px solid #ddd",
          padding: "12px 16px",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
          {TABS.find((t) => isActive(t.href))?.label ?? "Menu"}
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          style={{
            padding: 12,
            minWidth: 44,
            minHeight: 44,
            background: mobileMenuOpen ? "#1a472a" : "transparent",
            color: mobileMenuOpen ? "white" : "#333",
            border: "1px solid #ddd",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {mobileMenuOpen && (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setMobileMenuOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setMobileMenuOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 998,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "auto",
              left: 0,
              right: 0,
              background: "white",
              borderTop: "1px solid #ddd",
              boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
              zIndex: 999,
              maxHeight: "70vh",
              overflowY: "auto",
              paddingBottom: "env(safe-area-inset-bottom, 0)",
            }}
          >
            {TABS.map((tab) => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="nav-link"
                  style={{
                    padding: "14px 20px",
                    textDecoration: "none",
                    color: active ? "#1a472a" : "#333",
                    fontWeight: active ? 600 : 400,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderBottom: "1px solid #eee",
                    minHeight: 48,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="client-shell-main" style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        className="client-shell-footer"
        style={{
          background: headerColor,
          color: "rgba(255,255,255,0.7)",
          padding: "24px",
          textAlign: "center",
          fontSize: 14,
          marginTop: "auto",
        }}
      >
        <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} {outfitterName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
