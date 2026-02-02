"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Lodge {
  id: string;
  name: string;
  address?: string;
  max_clients: number;
  max_guides: number;
}

interface Camp {
  id: string;
  name: string;
  state: string;
  unit: string;
  hunt_code: string;
  start_date: string;
  end_date: string;
  camp_type: string;
  lodge?: Lodge;
  max_clients?: number;
  max_guides?: number;
  onx_share_link?: string;
  client_count: number;
  guide_count: number;
}

export default function CampsPage() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadCamps();
  }, [year]);

  async function loadCamps() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/camps?year=${year}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to load camps: ${res.status}`);
      }
      const data = await res.json();
      setCamps(data.camps || []);
    } catch (e: any) {
      console.error("Error loading camps:", e);
      alert(`Error loading camps: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Camps</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Manage camps, lodges, and assignments</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Year:</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, width: 80 }}
            />
          </label>
          <Link
            href="/camps/new"
            style={{
              padding: "10px 20px",
              background: "#1a472a",
              color: "white",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            + New Camp
          </Link>
          <Link
            href="/lodges"
            style={{
              padding: "10px 20px",
              background: "#f5f5f5",
              color: "#333",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Manage Lodges
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Loading camps...</p>
      ) : camps.length === 0 ? (
        <div style={{ padding: 48, background: "white", border: "1px solid #ddd", borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>No camps for {year}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {camps.map((camp) => (
            <Link
              key={camp.id}
              href={`/camps/${camp.id}`}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600, color: "#1a472a" }}>
                    {camp.name}
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14, color: "#666", marginBottom: 8 }}>
                    <span>📍 {camp.state} - Unit {camp.unit}</span>
                    <span>🎯 {camp.hunt_code}</span>
                    <span>📅 {formatDate(camp.start_date)} - {formatDate(camp.end_date)}</span>
                    <span style={{ textTransform: "capitalize" }}>🏕️ {camp.camp_type}</span>
                    {camp.lodge && <span>🏨 {camp.lodge.name}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                    <span>👥 {camp.client_count} / {camp.max_clients || "∞"} clients</span>
                    <span>🎯 {camp.guide_count} / {camp.max_guides || "∞"} guides</span>
                  </div>
                </div>
                <div style={{ marginLeft: 16 }}>
                  <span style={{ fontSize: 20, color: "#999" }}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
