"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface LodgePhoto {
  id: string;
  storage_path: string;
  photo_type: string;
}

interface Lodge {
  id: string;
  name: string;
  address?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  onx_share_link?: string;
  description?: string;
  max_clients: number;
  max_guides: number;
  max_beds?: number;
  photos?: LodgePhoto[];
}

export default function LodgesPage() {
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLodges();
  }, []);

  async function loadLodges() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/lodges");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to load lodges: ${res.status}`);
      }
      const data = await res.json();
      setLodges(data.lodges || []);
    } catch (e: any) {
      console.error("Error loading lodges:", e);
      alert(`Error loading lodges: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Lodges</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Manage lodge profiles and capacity</p>
        </div>
        <Link
          href="/lodges/new"
          style={{
            padding: "10px 20px",
            background: "#1a472a",
            color: "white",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          + New Lodge
        </Link>
      </div>

      {loading ? (
        <p>Loading lodges...</p>
      ) : lodges.length === 0 ? (
        <div style={{ padding: 48, background: "white", border: "1px solid #ddd", borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>No lodges created yet</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {lodges.map((lodge) => (
            <Link
              key={lodge.id}
              href={`/lodges/${lodge.id}`}
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
              <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600, color: "#1a472a" }}>
                {lodge.name}
              </h3>
              {lodge.address && (
                <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#666" }}>📍 {lodge.address}</p>
              )}
              <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#666", marginTop: 12 }}>
                <span>👥 Max {lodge.max_clients} clients</span>
                <span>🎯 Max {lodge.max_guides} guides</span>
                {lodge.max_beds && <span>🛏️ {lodge.max_beds} beds</span>}
              </div>
              {lodge.photos && lodge.photos.length > 0 && (
                <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#999" }}>
                  📷 {lodge.photos.length} photo{lodge.photos.length !== 1 ? "s" : ""}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
