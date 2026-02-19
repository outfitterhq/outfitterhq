"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { SuccessRecord } from "@/lib/types/hunt-closeout";
import { WEAPON_TYPES } from "@/lib/types/hunt-closeout";

// Component to display species photo (handles both URLs and photo IDs)
function SpeciesPhotoDisplay({ photoReference }: { photoReference: string }) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!photoReference) {
      setDisplayUrl(null);
      return;
    }

    if (photoReference.startsWith("photo:")) {
      // Extract photo ID and fetch fresh signed URL
      const photoId = photoReference.replace("photo:", "");
      if (!photoId) {
        setDisplayUrl(null);
        return;
      }
      setLoading(true);
      fetch(`/api/photos/${photoId}/url`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch photo URL");
          }
          return res.json();
        })
        .then((data) => {
          if (data.url) {
            setDisplayUrl(data.url);
          } else {
            setDisplayUrl(null);
          }
        })
        .catch((err) => {
          console.error("Failed to load photo URL:", err);
          setDisplayUrl(null);
        })
        .finally(() => setLoading(false));
    } else {
      setDisplayUrl(photoReference);
    }
  }, [photoReference]);

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: 250,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f4f6",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!displayUrl) {
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        height: 250,
        position: "relative",
        background: "#f3f4f6",
      }}
    >
      <Image
        src={displayUrl}
        alt="Species photo"
        fill
        style={{ objectFit: "cover" }}
        unoptimized
        onError={(e) => {
          console.error("Failed to load species photo:", displayUrl);
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}

interface SuccessHistoryCustomization {
  introText?: string;
  speciesPhotos?: Record<string, string>;
  availableSpecies?: string[];
}

// Species list will be loaded from API

export default function ClientSuccessHistoryPage() {
  const [records, setRecords] = useState<SuccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customization, setCustomization] = useState<SuccessHistoryCustomization>({});
  const [availableSpecies, setAvailableSpecies] = useState<string[]>([]);

  // Filters (client can filter by unit, weapon, species, state)
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [weaponFilter, setWeaponFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  // Lightbox: open photo full-size when client clicks thumbnail
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Get unique values for filter dropdowns
  const uniqueSpecies = Array.from(new Set(records.map((r) => r.species).filter((s): s is string => Boolean(s))));
  const uniqueUnits = Array.from(new Set(records.map((r) => r.unit).filter((s): s is string => Boolean(s))));
  const uniqueStates = Array.from(new Set(records.map((r) => r.state).filter((s): s is string => Boolean(s))));

  useEffect(() => {
    loadCustomization();
    loadAvailableSpecies();
    loadSuccessRecords();
  }, []);

  async function loadAvailableSpecies() {
    try {
      const res = await fetch("/api/outfitter/species");
      if (res.ok) {
        const data = await res.json();
        setAvailableSpecies(data.species || []);
      }
    } catch (e) {
      console.error("Failed to load available species", e);
      // Fallback to default list
      setAvailableSpecies(["Elk", "Deer", "Antelope", "Oryx", "Ibex", "Aoudad", "Bighorn Sheep", "Bear", "Mountain Lion", "Turkey"]);
    }
  }

  async function loadCustomization() {
    try {
      const res = await fetch("/api/client/success-history-customization");
      if (res.ok) {
        const data = await res.json();
        console.log("✅ Success history customization loaded:", data);
        setCustomization({
          introText: data.introText || undefined,
          speciesPhotos: data.speciesPhotos || {},
          availableSpecies: data.availableSpecies || [],
        });
        // Update available species from customization
        if (data.availableSpecies && data.availableSpecies.length > 0) {
          setAvailableSpecies(data.availableSpecies);
        }
      } else {
        const errorText = await res.text();
        console.error("❌ Failed to load customization:", res.status, errorText);
      }
    } catch (e) {
      console.error("❌ Failed to load customization", e);
    }
  }

  async function loadSuccessRecords() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (speciesFilter) params.append("species", speciesFilter);
      if (weaponFilter) params.append("weapon", weaponFilter);
      if (unitFilter) params.append("unit", unitFilter);
      if (stateFilter) params.append("state", stateFilter);

      const res = await fetch(`/api/success-records?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load success history");
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
  }, [speciesFilter, weaponFilter, unitFilter, stateFilter]);

  function clearFilters() {
    setSpeciesFilter("");
    setWeaponFilter("");
    setUnitFilter("");
    setStateFilter("");
  }

  const hasActiveFilters = speciesFilter || weaponFilter || unitFilter || stateFilter;

  // Get species that have photos configured (use available species from outfitter)
  const speciesWithPhotos = availableSpecies.filter(
    (species) => customization.speciesPhotos?.[species]
  );

  return (
    <main style={{ maxWidth: 1400, margin: "32px auto", padding: 16 }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Past Success by Unit</h1>
      
      {/* Intro Text */}
      {customization.introText && (
        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            marginBottom: 32,
          }}
        >
          <p style={{ fontSize: 16, lineHeight: 1.8, color: "#374151", margin: 0, textAlign: "center" }}>
            {customization.introText}
          </p>
        </div>
      )}

      {/* Species Photos Gallery */}
      {speciesWithPhotos.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            {speciesWithPhotos.map((species) => {
              const photoUrlRaw = customization.speciesPhotos?.[species] || "";
              const speciesRecords = records.filter((r) => r.species === species);
              const isFiltered = speciesFilter === species;

              return (
                <div
                  key={species}
                  onClick={() => {
                    if (isFiltered) {
                      setSpeciesFilter("");
                    } else {
                      setSpeciesFilter(species);
                    }
                  }}
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: isFiltered ? "3px solid #059669" : "2px solid #e5e7eb",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    background: "white",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {photoUrlRaw && (
                    <SpeciesPhotoDisplay photoReference={photoUrlRaw || ""} />
                  )}
                  <div
                    style={{
                      padding: 16,
                      textAlign: "center",
                      background: isFiltered ? "#059669" : "white",
                      color: isFiltered ? "white" : "var(--client-accent, #1a472a)",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{species}</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>
                      {speciesRecords.length} {speciesRecords.length === 1 ? "success" : "successes"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
              : "No success records available yet. Check back after hunts are completed!"}
          </p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <p style={{ opacity: 0.8, margin: 0 }}>
              Showing <strong>{records.length}</strong> {records.length === 1 ? "successful hunt" : "successful hunts"}
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
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                {record.primary_photo_url ? (
                  <button
                    type="button"
                    onClick={() => setLightboxPhoto(record.primary_photo_url!)}
                    style={{
                      marginBottom: 12,
                      borderRadius: 8,
                      overflow: "hidden",
                      aspectRatio: "16/10",
                      background: "#f3f4f6",
                      padding: 0,
                      border: "none",
                      cursor: "pointer",
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                    }}
                    aria-label="Open photo full size"
                  >
                    <img
                      src={record.primary_photo_url}
                      alt={record.hunt_title || record.species || "Hunt"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ) : (
                  <div style={{ marginBottom: 12, aspectRatio: "16/10", background: "#f3f4f6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>
                    No photo
                  </div>
                )}
                <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 700, color: "#059669" }}>
                  {record.species || "Hunt"} • {record.weapon || "Any Weapon"}
                </div>
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
                </div>
                {record.success_summary && (
                  <p style={{ fontSize: 14, marginBottom: 12, fontStyle: "italic", color: "#374151" }}>
                    "{record.success_summary}"
                  </p>
                )}
                {record.animal_quality_notes && (
                  <div style={{ fontSize: 13, marginBottom: 12, color: "#059669", fontWeight: 600 }}>
                    {record.animal_quality_notes}
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.6, marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                  <span>📷 {record.marketing_photos} {record.marketing_photos === 1 ? "photo" : "photos"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox: full-size photo when client clicks thumbnail */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo full size"
          onClick={() => setLightboxPhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              fontSize: 24,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <img
            src={lightboxPhoto}
            alt="Success photo"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
        </div>
      )}
    </main>
  );
}
