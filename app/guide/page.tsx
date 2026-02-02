"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PendingCloseoutHunt } from "@/lib/types/hunt-closeout";

interface GuideStats {
  totalHunts: number;
  pendingCloseouts: number;
  upcomingHunts: number;
}

export default function GuideHomePage() {
  const router = useRouter();
  const [pendingCloseouts, setPendingCloseouts] = useState<PendingCloseoutHunt[]>([]);
  const [stats, setStats] = useState<GuideStats>({
    totalHunts: 0,
    pendingCloseouts: 0,
    upcomingHunts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load pending closeouts and guide hunts in parallel
      const [closeoutRes, huntsRes] = await Promise.all([
        fetch("/api/hunts/pending-closeout"),
        fetch("/api/guide/hunts"),
      ]);

      let pendingCount = 0;
      if (closeoutRes.ok) {
        const closeoutData = await closeoutRes.json();
        setPendingCloseouts(closeoutData.hunts || []);
        pendingCount = closeoutData.hunts?.length || 0;
      }

      let totalHunts = 0;
      let upcomingHunts = 0;
      if (huntsRes.ok) {
        const huntsData = await huntsRes.json();
        const hunts = huntsData.hunts || [];
        totalHunts = hunts.length;
        const now = new Date();
        upcomingHunts = hunts.filter((h: any) => {
          const startDate = new Date(h.start_time || "");
          return startDate > now;
        }).length;
      }

      setStats({
        totalHunts,
        pendingCloseouts: pendingCount,
        upcomingHunts,
      });
    } catch (e: any) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Dashboard</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>Welcome to your guide portal</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div style={{ padding: 20, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#059669" }}>{stats.totalHunts}</div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>Total Hunts</div>
        </div>
        <div style={{ padding: 20, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>{stats.pendingCloseouts}</div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>Pending Closeouts</div>
        </div>
        <div style={{ padding: 20, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#3b82f6" }}>{stats.upcomingHunts}</div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>Upcoming Hunts</div>
        </div>
      </div>

      {/* Pending Closeouts Section */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pending Closeouts</h2>
          {pendingCloseouts.length > 0 && (
            <span style={{ padding: "4px 12px", background: "#fee2e2", color: "#dc2626", borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
              {pendingCloseouts.length} {pendingCloseouts.length === 1 ? "hunt" : "hunts"}
            </span>
          )}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : pendingCloseouts.length === 0 ? (
          <div style={{ padding: 24, background: "white", border: "1px solid #ddd", borderRadius: 8, textAlign: "center" }}>
            <p style={{ margin: 0, opacity: 0.8 }}>No hunts pending closeout. Great job! 🎉</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingCloseouts.map((hunt) => (
              <Link
                key={hunt.hunt_id}
                href={`/guide/closeout/${hunt.hunt_id}`}
                style={{
                  display: "block",
                  padding: 16,
                  border: "2px solid #059669",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "#333",
                  background: "#f0fdf4",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#dcfce7";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700, color: "#059669" }}>
                      {hunt.hunt_title}
                    </h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14, opacity: 0.8 }}>
                      {hunt.species && <span>Species: {hunt.species}</span>}
                      {hunt.unit && <span>Unit: {hunt.unit}</span>}
                      {hunt.weapon && <span>Weapon: {hunt.weapon}</span>}
                    </div>
                    <p style={{ margin: "8px 0 0 0", fontSize: 12, opacity: 0.6 }}>
                      {hunt.days_pending} {hunt.days_pending === 1 ? "day" : "days"} pending
                    </p>
                  </div>
                  <div style={{ paddingLeft: 16 }}>
                    <span style={{ padding: "6px 12px", background: "#059669", color: "white", borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
                      Complete →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px 0" }}>Quick Actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          <Link
            href="/guide/schedule"
            style={{
              display: "block",
              padding: 20,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "#333",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>View Schedule</div>
            <div style={{ fontSize: 14, color: "#666" }}>See your assigned hunts (list view)</div>
          </Link>
          <Link
            href="/guide/calendar"
            style={{
              display: "block",
              padding: 20,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "#333",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📆</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Calendar</div>
            <div style={{ fontSize: 14, color: "#666" }}>Full month calendar of your hunts</div>
          </Link>
          <Link
            href="/guide/packets"
            style={{
              display: "block",
              padding: 20,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "#333",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Hunt Packets</div>
            <div style={{ fontSize: 14, color: "#666" }}>Contract, questionnaire &amp; docs per hunt</div>
          </Link>
          <Link
            href="/guide/time-off"
            style={{
              display: "block",
              padding: 20,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "#333",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏰</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Request Time Off</div>
            <div style={{ fontSize: 14, color: "#666" }}>Submit time off requests</div>
          </Link>
          <Link
            href="/guide/documents"
            style={{
              display: "block",
              padding: 20,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "#333",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Manage Documents</div>
            <div style={{ fontSize: 14, color: "#666" }}>Upload certifications</div>
          </Link>
          <Link
            href="/guide/profile"
            style={{
              display: "block",
              padding: 20,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "#333",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>👤</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Edit Profile</div>
            <div style={{ fontSize: 14, color: "#666" }}>Update your information</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
