"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BookedHunt {
  id: string;
  calendar_event_id: string;
  outfitter_id: string;
  hunt_start_date: string;
  hunt_end_date: string;
  unit?: string | null;
  species?: string | null;
  weapon?: string | null;
  status: string;
  camp_name?: string | null;
  client_email: string;
  client_name?: string | null;
  client_address?: string | null;
  client_phone?: string | null;
  guide_username?: string | null;
  guide_name?: string | null;
  guide_address?: string | null;
  guide_vehicle?: string | null;
  guide_plate?: string | null;
  guide_card_number?: string | null;
  guide_fee_usd?: number | null;
  selected_pricing_item_id?: string | null;
  booked_at: string;
}

export default function BookedHuntsPage() {
  const [bookedHunts, setBookedHunts] = useState<BookedHunt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHunt, setSelectedHunt] = useState<BookedHunt | null>(null);

  // Filters
  const [month, setMonth] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [species, setSpecies] = useState<string>("");
  const [weapon, setWeapon] = useState<string>("");

  // Get unique values for filter dropdowns
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [availableSpecies, setAvailableSpecies] = useState<string[]>([]);
  const [availableWeapons, setAvailableWeapons] = useState<string[]>([]);

  useEffect(() => {
    loadBookedHunts();
  }, [month, unit, species, weapon]);

  async function loadBookedHunts() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (unit) params.set("unit", unit);
      if (species) params.set("species", species);
      if (weapon) params.set("weapon", weapon);

      const res = await fetch(`/api/booked-hunts?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load booked hunts");
      }
      const data = await res.json();
      const hunts = data.booked_hunts || [];
      setBookedHunts(hunts);

      // Extract unique values for filters
      const units = [...new Set(hunts.map((h: BookedHunt) => h.unit).filter(Boolean))].sort() as string[];
      const speciesList = [...new Set(hunts.map((h: BookedHunt) => h.species).filter(Boolean))].sort() as string[];
      const weapons = [...new Set(hunts.map((h: BookedHunt) => h.weapon).filter(Boolean))].sort() as string[];
      setAvailableUnits(units);
      setAvailableSpecies(speciesList);
      setAvailableWeapons(weapons);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateRange(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} - ${endStr}`;
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }

  function clearFilters() {
    setMonth("");
    setUnit("");
    setSpecies("");
    setWeapon("");
  }

  function getCurrentMonthValue(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Booked Hunts</h1>
        <p style={{ marginTop: 6, opacity: 0.75, fontSize: 14 }}>
          View all booked and confirmed hunts with client, guide, and financial information.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#fee",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            color: "#c00",
          }}
        >
          {error}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          background: "white",
          padding: 20,
          borderRadius: 8,
          border: "1px solid #ddd",
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 150 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "#666" }}>
            Month
          </label>
          <input
            type="month"
            value={month || getCurrentMonthValue()}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ flex: "1 1 150px", minWidth: 120 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "#666" }}>
            Unit
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            <option value="">All Units</option>
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 150px", minWidth: 120 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "#666" }}>
            Species
          </label>
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            <option value="">All Species</option>
            {availableSpecies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 150px", minWidth: 120 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "#666" }}>
            Weapon
          </label>
          <select
            value={weapon}
            onChange={(e) => setWeapon(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            <option value="">All Weapons</option>
            {availableWeapons.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "0 0 auto" }}>
          <button
            onClick={clearFilters}
            style={{
              padding: "8px 16px",
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading booked hunts...</p>
      ) : bookedHunts.length === 0 ? (
        <div
          style={{
            background: "white",
            padding: 48,
            borderRadius: 8,
            border: "1px solid #ddd",
            textAlign: "center",
            color: "#666",
          }}
        >
          <p style={{ margin: 0, fontSize: 16 }}>No booked hunts found.</p>
          <p style={{ marginTop: 8, fontSize: 14, opacity: 0.75 }}>
            Hunts will appear here automatically when their status is set to "Booked" or "Confirmed".
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {bookedHunts.map((hunt) => (
            <div
              key={hunt.id}
              onClick={() => setSelectedHunt(hunt)}
              style={{
                background: "white",
                padding: 20,
                borderRadius: 8,
                border: "1px solid #ddd",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#1a472a";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#ddd";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 16, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {formatDateRange(hunt.hunt_start_date, hunt.hunt_end_date)}
                  </div>
                  <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                    {[hunt.unit, hunt.species, hunt.weapon].filter(Boolean).join(" • ")}
                  </div>
                  <div style={{ fontSize: 12, color: "#999" }}>
                    {hunt.camp_name && `Camp: ${hunt.camp_name}`}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Client</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{hunt.client_name || hunt.client_email}</div>
                  {hunt.client_phone && (
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{hunt.client_phone}</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Guide</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{hunt.guide_name || hunt.guide_username || "—"}</div>
                  {hunt.guide_plate && (
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Plate: {hunt.guide_plate}</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Guide Fee</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
                    {formatCurrency(hunt.guide_fee_usd)}
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: hunt.status === "Booked" ? "#dbeafe" : "#dcfce7",
                      color: hunt.status === "Booked" ? "#1e40af" : "#166534",
                    }}
                  >
                    {hunt.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedHunt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setSelectedHunt(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 32,
              maxWidth: 800,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Hunt Details</h2>
              <button
                onClick={() => setSelectedHunt(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#666",
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: 24 }}>
              {/* Hunt Info */}
              <section>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#666" }}>Hunt Information</h3>
                <div style={{ display: "grid", gap: 12, background: "#f9fafb", padding: 16, borderRadius: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#666" }}>Dates:</span>
                    <span>{formatDateRange(selectedHunt.hunt_start_date, selectedHunt.hunt_end_date)}</span>
                  </div>
                  {selectedHunt.unit && (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#666" }}>Unit:</span>
                      <span>{selectedHunt.unit}</span>
                    </div>
                  )}
                  {selectedHunt.species && (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#666" }}>Species:</span>
                      <span>{selectedHunt.species}</span>
                    </div>
                  )}
                  {selectedHunt.weapon && (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#666" }}>Weapon:</span>
                      <span>{selectedHunt.weapon}</span>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#666" }}>Status:</span>
                    <span>{selectedHunt.status}</span>
                  </div>
                  {selectedHunt.camp_name && (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#666" }}>Camp:</span>
                      <span>{selectedHunt.camp_name}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Client Info */}
              <section>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#666" }}>Client Information</h3>
                <div style={{ display: "grid", gap: 12, background: "#f9fafb", padding: 16, borderRadius: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#666" }}>Name:</span>
                    <span>{selectedHunt.client_name || selectedHunt.client_email}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#666" }}>Email:</span>
                    <span>
                      <Link
                        href={`/clients/${encodeURIComponent(selectedHunt.client_email)}`}
                        style={{ color: "#1a472a", textDecoration: "underline" }}
                      >
                        {selectedHunt.client_email}
                      </Link>
                    </span>
                  </div>
                  {selectedHunt.client_phone && (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#666" }}>Phone:</span>
                      <span>{selectedHunt.client_phone}</span>
                    </div>
                  )}
                  {selectedHunt.client_address && (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#666" }}>Address:</span>
                      <span>{selectedHunt.client_address}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Guide Info */}
              {selectedHunt.guide_name || selectedHunt.guide_username ? (
                <section>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#666" }}>Guide Information</h3>
                  <div style={{ display: "grid", gap: 12, background: "#f9fafb", padding: 16, borderRadius: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#666" }}>Name:</span>
                      <span>{selectedHunt.guide_name || selectedHunt.guide_username}</span>
                    </div>
                    {selectedHunt.guide_address && (
                      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#666" }}>Address:</span>
                        <span>{selectedHunt.guide_address}</span>
                      </div>
                    )}
                    {selectedHunt.guide_vehicle && (
                      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#666" }}>Vehicle:</span>
                        <span>{selectedHunt.guide_vehicle}</span>
                      </div>
                    )}
                    {selectedHunt.guide_plate && (
                      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#666" }}>License Plate:</span>
                        <span>{selectedHunt.guide_plate}</span>
                      </div>
                    )}
                    {selectedHunt.guide_card_number && (
                      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#666" }}>Guide Card:</span>
                        <span>{selectedHunt.guide_card_number}</span>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {/* Financial Info */}
              <section>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#666" }}>Financial Information</h3>
                <div style={{ display: "grid", gap: 12, background: "#f9fafb", padding: 16, borderRadius: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#666" }}>Guide Fee:</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#1a472a" }}>
                      {formatCurrency(selectedHunt.guide_fee_usd)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#666", fontStyle: "italic", marginTop: 4 }}>
                    Note: Guide fee only. Private land tag purchases are excluded.
                  </div>
                </div>
              </section>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Link
                  href={`/clients/${encodeURIComponent(selectedHunt.client_email)}`}
                  style={{
                    padding: "10px 20px",
                    background: "#1a472a",
                    color: "white",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  View Client Profile
                </Link>
                {selectedHunt.guide_username && (
                  <Link
                    href={`/guides?search=${encodeURIComponent(selectedHunt.guide_username)}`}
                    style={{
                      padding: "10px 20px",
                      background: "#f5f5f5",
                      color: "#333",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "1px solid #ddd",
                    }}
                  >
                    View Guide Profile
                  </Link>
                )}
                <Link
                  href={`/calendar`}
                  style={{
                    padding: "10px 20px",
                    background: "#f5f5f5",
                    color: "#333",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "1px solid #ddd",
                  }}
                >
                  View in Calendar
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
