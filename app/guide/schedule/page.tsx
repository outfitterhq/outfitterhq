"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Hunt {
  id: string;
  title: string;
  start_time?: string;
  end_time?: string;
  species?: string;
  unit?: string;
  weapon?: string;
  client_email?: string;
  camp_name?: string;
  notes?: string;
  status?: string;
  client_questionnaire?: any;
  contract?: any;
}

export default function GuideSchedulePage() {
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

  useEffect(() => {
    loadHunts();
  }, []);

  async function loadHunts() {
    try {
      setLoading(true);
      const res = await fetch("/api/guide/hunts");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load hunts: ${res.status}`);
      }
      const data = await res.json();
      setHunts(data.hunts || []);
    } catch (e: any) {
      console.error("Error loading hunts:", e);
      // Show error to user
      alert(`Failed to load hunts: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  function getHuntStatus(hunt: Hunt): "upcoming" | "past" | "current" {
    if (!hunt.start_time) return "upcoming";
    const startDate = new Date(hunt.start_time || "");
    const endDate = new Date(hunt.end_time || "");
    const now = new Date();

    if (now < startDate) return "upcoming";
    if (now > endDate) return "past";
    return "current";
  }

  const filteredHunts = hunts.filter((hunt) => {
    if (filter === "all") return true;
    const status = getHuntStatus(hunt);
    if (filter === "upcoming") return status === "upcoming" || status === "current";
    return status === "past";
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>My Schedule</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>View your assigned hunts and calendar</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "all" ? "#059669" : "white",
            color: filter === "all" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          All ({hunts.length})
        </button>
        <button
          onClick={() => setFilter("upcoming")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "upcoming" ? "#059669" : "white",
            color: filter === "upcoming" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Upcoming ({hunts.filter((h) => getHuntStatus(h) === "upcoming" || getHuntStatus(h) === "current").length})
        </button>
        <button
          onClick={() => setFilter("past")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "past" ? "#059669" : "white",
            color: filter === "past" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Past ({hunts.filter((h) => getHuntStatus(h) === "past").length})
        </button>
      </div>

      {loading ? (
        <p>Loading hunts...</p>
      ) : filteredHunts.length === 0 ? (
        <div style={{ padding: 48, background: "white", border: "1px solid #ddd", borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>
            {filter === "all" ? "No hunts assigned yet" : `No ${filter} hunts`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredHunts.map((hunt) => {
            const status = getHuntStatus(hunt);
            return (
              <div
                key={hunt.id}
                style={{
                  padding: 20,
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600 }}>{hunt.title}</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14, color: "#666", marginBottom: 8 }}>
                      <span>
                        📅 {formatDate(hunt.start_time)} - {formatDate(hunt.end_time)}
                      </span>
                      {hunt.species && <span>🦌 {hunt.species}</span>}
                      {hunt.unit && <span>🗺️ Unit {hunt.unit}</span>}
                      {hunt.weapon && <span>🎯 {hunt.weapon}</span>}
                      {hunt.camp_name && <span>🏕️ {hunt.camp_name}</span>}
                    </div>
                    {hunt.client_email && (
                      <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#666" }}>
                        Client: {hunt.client_email}
                      </p>
                    )}
                    {hunt.notes && (
                      <p style={{ margin: "8px 0 0 0", fontSize: 14, color: "#666", fontStyle: "italic" }}>
                        {hunt.notes}
                      </p>
                    )}
                  </div>
                  <div>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          status === "upcoming"
                            ? "#dbeafe"
                            : status === "current"
                            ? "#fef3c7"
                            : "#e5e7eb",
                        color:
                          status === "upcoming"
                            ? "#1e40af"
                            : status === "current"
                            ? "#92400e"
                            : "#374151",
                      }}
                    >
                      {status === "upcoming" ? "Upcoming" : status === "current" ? "In Progress" : "Past"}
                    </span>
                  </div>
                </div>

                {/* Client Questionnaire & Contract Info */}
                <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                  {hunt.client_questionnaire && (
                    <div style={{ flex: 1, padding: 12, background: "#f0f9ff", borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Client Questionnaire</div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {hunt.client_questionnaire.full_name && (
                          <div>Name: {hunt.client_questionnaire.full_name}</div>
                        )}
                        {hunt.client_questionnaire.contact_phone && (
                          <div>Phone: {hunt.client_questionnaire.contact_phone}</div>
                        )}
                        {hunt.client_questionnaire.food_allergies && (
                          <div style={{ marginTop: 4 }}>
                            <strong>Allergies:</strong> {hunt.client_questionnaire.food_allergies}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {hunt.contract && (
                    <div style={{ flex: 1, padding: 12, background: "#f0fdf4", borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Contract Status</div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        Status: {hunt.contract.status}
                        {hunt.contract.client_signed_at && (
                          <div>Client signed: {formatDate(hunt.contract.client_signed_at)}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hunt Packet: contract, questionnaire, guide documents */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                  <Link
                    href={`/guide/packet/${hunt.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 16px",
                      background: "#059669",
                      color: "white",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <span>📦</span>
                    <span>Open Hunt Packet</span>
                  </Link>
                  <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#666" }}>
                    Contract, Client Questionnaire, and your guide documents — view and download each
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
