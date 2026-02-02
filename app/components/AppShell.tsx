"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TenantSwitcher from "./TenantSwitcher";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";

type Membership = {
  outfitter_id: string;
  outfitter_name: string;
  role: string;
  status: string;
};

type MenuItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Core",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "🏠" },
      { href: "/clients", label: "Clients", icon: "👥" },
      { href: "/calendar", label: "Hunt Calendar", icon: "📅" },
      { href: "/guides", label: "Guides", icon: "🎯" },
      { href: "/cooks", label: "Cooks", icon: "👨‍🍳" },
    ],
  },
  {
    title: "Draw Management",
    items: [
      { href: "/draw-applications", label: "Draw Applications", icon: "📝", badge: 0 }, // Will be updated dynamically
      { href: "/draw-results", label: "Draw Results", icon: "🎲" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/pricing", label: "Pricing", icon: "💰" },
      { href: "/payments", label: "Payments", icon: "💳" },
      { href: "/private-land-tags", label: "Tags for Sale", icon: "🏷️" },
    ],
  },
  {
    title: "Workflow",
    items: [
      { href: "/contract-review", label: "Contract Review", icon: "📋" },
      { href: "/time-off-requests", label: "Time Off Requests", icon: "⏰" },
      { href: "/documents", label: "Documents", icon: "📄" },
    ],
  },
  {
    title: "Camps & Lodges",
    items: [
      { href: "/camps", label: "Camps", icon: "🏕️" },
      { href: "/lodges", label: "Lodges", icon: "🏨" },
    ],
  },
  {
    title: "Library",
    items: [
      { href: "/success-library", label: "Success Library", icon: "🏆" },
      { href: "/photo-library", label: "Photo Library", icon: "📷" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings", label: "Settings", icon: "⚙️" },
    ],
  },
];

export default function AppShell({
  children,
  memberships,
  userEmail,
}: {
  children: React.ReactNode;
  memberships: Membership[];
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentOutfitter = memberships.find((m) => m.status === "active") || memberships[0];
  const outfitterName = currentOutfitter?.outfitter_name || "Outfitter HQ";
  const [drawApplicationsCount, setDrawApplicationsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDrawApplicationsCount();
    const interval = setInterval(loadDrawApplicationsCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update badge count in menu
    const drawAppsGroup = MENU_GROUPS.find(g => g.title === "Draw Management");
    if (drawAppsGroup) {
      const drawAppsItem = drawAppsGroup.items.find(item => item.href === "/draw-applications");
      if (drawAppsItem) {
        drawAppsItem.badge = drawApplicationsCount;
      }
    }
  }, [drawApplicationsCount]);

  useEffect(() => {
    // Close menu when clicking outside or pressing Escape
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [menuOpen]);

  async function loadDrawApplicationsCount() {
    try {
      const currentYear = new Date().getFullYear();
      const res = await fetch(`/api/admin/draw-applications?year=${currentYear}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        setDrawApplicationsCount(data.applications?.length || 0);
      }
    } catch (e) {
      console.error("Failed to load draw applications count", e);
    }
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  }

  function getCurrentPageLabel(): string {
    for (const group of MENU_GROUPS) {
      for (const item of group.items) {
        if (isActive(item.href)) {
          return item.label;
        }
      }
    }
    return "Dashboard";
  }

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: "#f5f5f5", position: "relative" }}>
      {/* Header */}
      <header
        className="app-shell-header"
        style={{
          background: "#1a472a",
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
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <Link
            href="/dashboard"
            className="app-shell-header-title"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            {outfitterName}
          </Link>
          <span style={{ opacity: 0.7, fontSize: 14, flexShrink: 0 }}>Admin Portal</span>
        </div>

        <div className="app-shell-header-right" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {memberships.length > 1 && (
            <div style={{ fontSize: 14 }}>
              <TenantSwitcher memberships={memberships} />
            </div>
          )}
          <NotificationBell userRole="admin" />
          <span style={{ fontSize: 14 }}>{userEmail}</span>
          <LogoutButton />
        </div>
      </header>

      {/* Menu Navigation */}
      <nav
        className="nav-bar"
        style={{
          background: "white",
          borderBottom: "1px solid #ddd",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1001,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Hamburger Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: "12px",
              background: menuOpen ? "#1a472a" : "transparent",
              color: menuOpen ? "white" : "#333",
              border: "1px solid #ddd",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              transition: "all 0.2s ease",
            }}
            aria-label="Toggle menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>

          {/* Current Page Indicator */}
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
            {getCurrentPageLabel()}
          </div>
        </div>
      </nav>

      {/* Backdrop Overlay */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 999,
          }}
        />
      )}

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: "120px", // Below header (60px) + nav (60px)
            left: 0,
            right: 0,
            background: "white",
            borderBottom: "1px solid #ddd",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            zIndex: 1000,
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 32 }}>
              {MENU_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#666",
                    }}
                  >
                    {group.title}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      const badge = item.href === "/draw-applications" ? drawApplicationsCount : item.badge;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          style={{
                            padding: "10px 12px",
                            textDecoration: "none",
                            color: active ? "#1a472a" : "#333",
                            fontWeight: active ? 600 : 400,
                            background: active ? "#f0f9ff" : "transparent",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            transition: "all 0.15s ease",
                            position: "relative",
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = "#f9fafb";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{item.icon}</span>
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {badge !== undefined && badge > 0 && (
                            <span
                              style={{
                                background: "#f59e0b",
                                color: "white",
                                borderRadius: "50%",
                                minWidth: 20,
                                height: 20,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "0 6px",
                              }}
                            >
                              {badge > 9 ? "9+" : badge}
                            </span>
                          )}
                          {active && (
                            <span
                              style={{
                                width: 4,
                                height: 4,
                                background: "#1a472a",
                                borderRadius: "50%",
                              }}
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        className="app-shell-footer"
        style={{
          background: "#1a472a",
          color: "rgba(255,255,255,0.7)",
          padding: "24px",
          textAlign: "center",
          fontSize: 14,
          marginTop: "auto",
        }}
      >
        <p>&copy; {new Date().getFullYear()} {outfitterName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
