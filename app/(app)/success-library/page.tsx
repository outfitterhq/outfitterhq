"use client";

import { useState, useEffect } from "react";
import type { SuccessRecord } from "@/lib/types/hunt-closeout";
import { WEAPON_TYPES } from "@/lib/types/hunt-closeout";

export default function SuccessLibraryPage() {
  const [records, setRecords] = useState<SuccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [weaponFilter, setWeaponFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  // Get unique values for filter dropdowns
  const uniqueSpecies = Array.from(new Set(records.map((r) => r.species).filter((s): s is string => Boolean(s))));
  const uniqueUnits = Array.from(new Set(records.map((r) => r.unit).filter((u): u is string => Boolean(u))));
  const uniqueStates = Array.from(new Set(records.map((r) => r.state).filter((s): s is string => Boolean(s))));
  const uniqueYears = Array.from(
    new Set(records.map((r) => r.season_year).filter((y): y is number => y != null))
  ).sort((a, b) => b - a);

  useEffect(() => {
    loadSuccessRecords();
  }, []);

  async function loadSuccessRecords() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (speciesFilter) params.append("species", speciesFilter);
      if (weaponFilter) params.append("weapon", weaponFilter);
      if (unitFilter) params.append("unit", unitFilter);
      if (stateFilter) params.append("state", stateFilter);
      if (yearFilter) params.append("year", yearFilter);

      const res = await fetch(`/api/success-records?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load success records");
      }
      const data = await res.json();
      setRecords(data.records || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuccessRecords();
  }, [speciesFilter, weaponFilter, unitFilter, stateFilter, yearFilter]);

  function clearFilters() {
    setSpeciesFilter("");
    setWeaponFilter("");
    setUnitFilter("");
    setStateFilter("");
    setYearFilter("");
  }

  const hasActiveFilters = speciesFilter || weaponFilter || unitFilter || stateFilter || yearFilter;

  return (
    <main style={{ maxWidth: 1400, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Success Library</h1>
          <p style={{ opacity: 0.8, margin: 0 }}>
            View and filter successful hunts for marketing and analytics.
          </p>
        </div>
        <a
          href="/success-library/manual-entry"
          style={{
            padding: "12px 24px",
            background: "#059669",
            color: "white",
            textDecoration: "none",
            borderRadius: 4,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          + Add Manual Entry
        </a>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: 20,
          background: "#f9fafb",
          borderRadius: 8,
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            Species
          </label>
          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">All Species</option>
            {uniqueSpecies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            Weapon
          </label>
          <select
            value={weaponFilter}
            onChange={(e) => setWeaponFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">All Weapons</option>
            {WEAPON_TYPES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            Unit
          </label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">All Units</option>
            {uniqueUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            State
          </label>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">All States</option>
            {uniqueStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            Year
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">All Years</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={clearFilters}
              style={{
                padding: "8px 16px",
                background: "#e5e7eb",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8 }}>
          <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>
        </div>
      ) : records.length === 0 ? (
        <div style={{ padding: 24, background: "#f3f4f6", borderRadius: 8, textAlign: "center" }}>
          <p style={{ margin: 0, opacity: 0.8 }}>
            {hasActiveFilters
              ? "No records match your filters."
              : "No success records yet. Complete hunt closeouts to build your library."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <p style={{ opacity: 0.8, margin: 0 }}>
              Showing <strong>{records.length}</strong> {records.length === 1 ? "record" : "records"}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {records.map((record) => (
              <div
                key={record.closeout_id}
                style={{
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "white",
                }}
              >
                {record.primary_photo_url ? (
                  <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden", aspectRatio: "16/10", background: "#f3f4f6" }}>
                    <img
                      src={record.primary_photo_url}
                      alt={record.hunt_title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: 12, aspectRatio: "16/10", background: "#f3f4f6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>
                    No photo
                  </div>
                )}
                <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700 }}>
                  {record.hunt_title}
                </h3>
                <div style={{ marginBottom: 12, fontSize: 14, opacity: 0.8 }}>
                  {record.hunt_code && (
                    <div>
                      <strong>Hunt code:</strong> {record.hunt_code}
                    </div>
                  )}
                  {(record.hunt_type === "private_land" || record.hunt_type === "unit_wide") && (
                    <div>
                      <strong>Type:</strong> {record.hunt_type === "unit_wide" ? "Unit Wide" : "Private Land"}
                    </div>
                  )}
                  <div>
                    <strong>Species:</strong> {record.species || "N/A"}
                  </div>
                  <div>
                    <strong>Weapon:</strong> {record.weapon || "N/A"}
                  </div>
                  <div>
                    <strong>Unit:</strong> {record.unit || "N/A"}
                  </div>
                  {record.state && (
                    <div>
                      <strong>State:</strong> {record.state}
                    </div>
                  )}
                  {record.season_year && (
                    <div>
                      <strong>Year:</strong> {record.season_year}
                    </div>
                  )}
                  <div>
                    <strong>Guide:</strong> {record.guide_username}
                  </div>
                </div>
                {record.success_summary && (
                  <p style={{ fontSize: 14, marginBottom: 12, fontStyle: "italic" }}>
                    "{record.success_summary}"
                  </p>
                )}
                <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.6 }}>
                  <span>📷 {record.total_photos} photos</span>
                  {record.marketing_photos > 0 && (
                    <span>✅ {record.marketing_photos} marketing</span>
                  )}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
                  {new Date(record.submitted_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
