"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Client {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
}

interface Guide {
  id: string;
  name?: string;
  email?: string;
  username?: string;
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
  lodge?: { id: string; name: string };
  max_clients?: number;
  max_guides?: number;
  onx_share_link?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  location_label?: string;
  camp_manager_user_id?: string;
}

export default function CampDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campId = params.id as string;

  const [camp, setCamp] = useState<Camp | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [eligibleClients, setEligibleClients] = useState<Client[]>([]);
  const [allGuides, setAllGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "guides">("overview");
  const [showAddClients, setShowAddClients] = useState(false);
  const [showAddGuides, setShowAddGuides] = useState(false);

  useEffect(() => {
    if (campId) {
      loadCamp();
      loadClients();
      loadGuides();
      loadEligibleClients();
      loadAllGuides();
    }
  }, [campId]);

  async function loadCamp() {
    try {
      const res = await fetch(`/api/admin/camps`);
      if (!res.ok) throw new Error("Failed to load camp");
      const data = await res.json();
      const found = data.camps?.find((c: Camp) => c.id === campId);
      setCamp(found || null);
    } catch (e: any) {
      console.error("Error loading camp:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const res = await fetch(`/api/admin/camps/${campId}/clients`);
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e: any) {
      console.error("Error loading clients:", e);
    }
  }

  async function loadGuides() {
    try {
      const res = await fetch(`/api/admin/camps/${campId}/guides`);
      if (!res.ok) throw new Error("Failed to load guides");
      const data = await res.json();
      setGuides(data.guides || []);
    } catch (e: any) {
      console.error("Error loading guides:", e);
    }
  }

  async function loadEligibleClients() {
    try {
      const res = await fetch(`/api/admin/camps/${campId}/eligible-clients`);
      if (!res.ok) throw new Error("Failed to load eligible clients");
      const data = await res.json();
      setEligibleClients(data.eligible_clients || []);
    } catch (e: any) {
      console.error("Error loading eligible clients:", e);
    }
  }

  async function loadAllGuides() {
    try {
      const res = await fetch("/api/guides");
      if (!res.ok) throw new Error("Failed to load guides");
      const data = await res.json();
      setAllGuides(data.guides || []);
    } catch (e: any) {
      console.error("Error loading all guides:", e);
    }
  }

  async function addClients(clientIds: string[]) {
    try {
      const res = await fetch(`/api/admin/camps/${campId}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_ids: clientIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add clients");
      }
      await loadClients();
      await loadEligibleClients();
      setShowAddClients(false);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function removeClient(clientId: string) {
    if (!confirm("Remove this client from the camp?")) return;
    try {
      const res = await fetch(`/api/admin/camps/${campId}/clients?client_id=${clientId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove client");
      await loadClients();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function addGuides(guideIds: string[]) {
    try {
      const res = await fetch(`/api/admin/camps/${campId}/guides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guide_ids: guideIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add guides");
      }
      await loadGuides();
      setShowAddGuides(false);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function removeGuide(guideId: string) {
    if (!confirm("Remove this guide from the camp?")) return;
    try {
      const res = await fetch(`/api/admin/camps/${campId}/guides?guide_id=${guideId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove guide");
      await loadGuides();
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!camp) return <p>Camp not found</p>;

  const assignedClientIds = new Set(clients.map((c) => c.id));
  const assignedGuideIds = new Set(guides.map((g) => g.id));

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/camps" style={{ color: "#1a472a", textDecoration: "none" }}>← Back to Camps</Link>
        <h1 style={{ marginTop: 12, marginBottom: 8 }}>{camp.name}</h1>
        <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#666" }}>
          <span>📍 {camp.state} - Unit {camp.unit}</span>
          <span>🎯 {camp.hunt_code}</span>
          <span>📅 {new Date(camp.start_date).toLocaleDateString()} - {new Date(camp.end_date).toLocaleDateString()}</span>
          <span style={{ textTransform: "capitalize" }}>🏕️ {camp.camp_type}</span>
          {camp.lodge && <span>🏨 {camp.lodge.name}</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid #ddd", marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "10px 20px",
            background: activeTab === "overview" ? "#1a472a" : "transparent",
            color: activeTab === "overview" ? "white" : "#333",
            border: "none",
            borderBottom: activeTab === "overview" ? "2px solid #1a472a" : "2px solid transparent",
            cursor: "pointer",
            fontWeight: activeTab === "overview" ? 600 : 400,
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("clients")}
          style={{
            padding: "10px 20px",
            background: activeTab === "clients" ? "#1a472a" : "transparent",
            color: activeTab === "clients" ? "white" : "#333",
            border: "none",
            borderBottom: activeTab === "clients" ? "2px solid #1a472a" : "2px solid transparent",
            cursor: "pointer",
            fontWeight: activeTab === "clients" ? 600 : 400,
          }}
        >
          Clients ({clients.length}/{camp.max_clients || "∞"})
        </button>
        <button
          onClick={() => setActiveTab("guides")}
          style={{
            padding: "10px 20px",
            background: activeTab === "guides" ? "#1a472a" : "transparent",
            color: activeTab === "guides" ? "white" : "#333",
            border: "none",
            borderBottom: activeTab === "guides" ? "2px solid #1a472a" : "2px solid transparent",
            cursor: "pointer",
            fontWeight: activeTab === "guides" ? 600 : 400,
          }}
        >
          Guides ({guides.length}/{camp.max_guides || "∞"})
        </button>
      </div>

      {activeTab === "overview" && (
        <div style={{ display: "grid", gap: 24 }}>
          {camp.onx_share_link && (
            <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
              <strong>📍 OnX Location:</strong>{" "}
              <a href={camp.onx_share_link} target="_blank" rel="noopener noreferrer" style={{ color: "#1a472a" }}>
                Navigate to Camp
              </a>
            </div>
          )}
          {camp.gps_latitude && camp.gps_longitude && (
            <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
              <strong>📍 GPS:</strong> {camp.gps_latitude}, {camp.gps_longitude}
            </div>
          )}
        </div>
      )}

      {activeTab === "clients" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h2>Assigned Clients</h2>
            <button
              onClick={() => setShowAddClients(true)}
              style={{
                padding: "8px 16px",
                background: "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              + Add Clients
            </button>
          </div>

          {showAddClients && (
            <div style={{ padding: 20, background: "#f9f9f9", borderRadius: 8, marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>Add Clients</h3>
              <p style={{ fontSize: 14, color: "#666" }}>
                Eligible clients match: Hunt Code {camp.hunt_code}, Unit {camp.unit}, overlapping dates
              </p>
              <div style={{ maxHeight: 300, overflowY: "auto", marginTop: 12 }}>
                {eligibleClients.length === 0 ? (
                  <p>No eligible clients found</p>
                ) : (
                  eligibleClients.map((client) => {
                    const isAssigned = assignedClientIds.has(client.id);
                    return (
                      <label
                        key={client.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: 8,
                          background: isAssigned ? "#e0e0e0" : "white",
                          marginBottom: 4,
                          borderRadius: 4,
                          cursor: isAssigned ? "not-allowed" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          disabled={isAssigned}
                          onChange={(e) => {
                            if (e.target.checked && !isAssigned) {
                              addClients([client.id]);
                            }
                          }}
                          style={{ marginRight: 8 }}
                        />
                        <span>
                          {client.first_name} {client.last_name} ({client.email})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowAddClients(false)}
                  style={{
                    padding: "8px 16px",
                    background: "#ddd",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {clients.length === 0 ? (
            <p>No clients assigned</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {clients.map((client) => (
                <div
                  key={client.id}
                  style={{
                    padding: 12,
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{client.first_name} {client.last_name}</strong>
                    <div style={{ fontSize: 14, color: "#666" }}>
                      {client.email} {client.phone && `• ${client.phone}`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeClient(client.id)}
                    style={{
                      padding: "6px 12px",
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "guides" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h2>Assigned Guides</h2>
            <button
              onClick={() => setShowAddGuides(true)}
              style={{
                padding: "8px 16px",
                background: "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              + Add Guides
            </button>
          </div>

          {showAddGuides && (
            <div style={{ padding: 20, background: "#f9f9f9", borderRadius: 8, marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>Add Guides</h3>
              <div style={{ maxHeight: 300, overflowY: "auto", marginTop: 12 }}>
                {allGuides.length === 0 ? (
                  <p>No guides available</p>
                ) : (
                  allGuides.map((guide) => {
                    const isAssigned = assignedGuideIds.has(guide.id);
                    return (
                      <label
                        key={guide.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: 8,
                          background: isAssigned ? "#e0e0e0" : "white",
                          marginBottom: 4,
                          borderRadius: 4,
                          cursor: isAssigned ? "not-allowed" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          disabled={isAssigned}
                          onChange={(e) => {
                            if (e.target.checked && !isAssigned) {
                              addGuides([guide.id]);
                            }
                          }}
                          style={{ marginRight: 8 }}
                        />
                        <span>
                          {guide.name || guide.username} ({guide.email})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowAddGuides(false)}
                  style={{
                    padding: "8px 16px",
                    background: "#ddd",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {guides.length === 0 ? (
            <p>No guides assigned</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {guides.map((guide) => (
                <div
                  key={guide.id}
                  style={{
                    padding: 12,
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{guide.name || guide.username}</strong>
                    <div style={{ fontSize: 14, color: "#666" }}>{guide.email}</div>
                  </div>
                  <button
                    onClick={() => removeGuide(guide.id)}
                    style={{
                      padding: "6px 12px",
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
