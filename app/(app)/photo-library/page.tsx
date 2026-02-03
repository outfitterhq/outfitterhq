"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface HuntPhoto {
  id: string;
  storage_path: string;
  signed_url: string | null;
  file_name: string;
  file_size: number;
  content_type: string;
  category: string | null;
  approved_for_marketing: boolean;
  is_private: boolean;
  species: string | null;
  weapon: string | null;
  unit: string | null;
  state: string | null;
  season_year: number | null;
  guide_username: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  hunt_closeouts: {
    id: string;
    hunt_id: string;
    species: string | null;
    weapon: string | null;
    unit: string | null;
    state: string | null;
    guide_username: string;
    client_email: string | null;
    harvested: boolean;
    success_summary: string | null;
  } | null;
  calendar_events: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  } | null;
}

const CATEGORIES = ["Harvest", "Landscape", "Camp", "Client + Guide", "Other"];

export default function PhotoLibraryPage() {
  const [photos, setPhotos] = useState<HuntPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<HuntPhoto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [weaponFilter, setWeaponFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [marketingFilter, setMarketingFilter] = useState("");

  useEffect(() => {
    loadPhotos();
  }, [speciesFilter, weaponFilter, unitFilter, categoryFilter, marketingFilter]);

  // Default to showing only unapproved photos (for admin review)
  // Approved photos should only appear in "Past Successes"
  useEffect(() => {
    if (marketingFilter === "") {
      setMarketingFilter("false"); // Default to unapproved only
    }
  }, []);

  async function loadPhotos() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (speciesFilter) params.append("species", speciesFilter);
      if (weaponFilter) params.append("weapon", weaponFilter);
      if (unitFilter) params.append("unit", unitFilter);
      if (categoryFilter) params.append("category", categoryFilter);
      if (marketingFilter) params.append("approved_for_marketing", marketingFilter);

      const res = await fetch(`/api/photos?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load photos");
      }
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("Are you sure you want to delete this photo? This cannot be undone.")) {
      return;
    }

    setDeletingId(photoId);
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete photo");
      }

      // Remove from list
      setPhotos(photos.filter((p) => p.id !== photoId));
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function updatePhoto(photoId: string, updates: Partial<HuntPhoto>) {
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update photo");
      }

      const data = await res.json();
      // Update in list
      setPhotos(photos.map((p) => (p.id === photoId ? { ...p, ...data.photo } : p)));
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto({ ...selectedPhoto, ...data.photo });
      }
    } catch (e: any) {
      alert("Error: " + String(e));
    }
  }

  const uniqueSpecies = Array.from(new Set(photos.map((p) => p.species).filter((s): s is string => Boolean(s))));
  const uniqueWeapons = Array.from(new Set(photos.map((p) => p.weapon).filter((w): w is string => Boolean(w))));
  const uniqueUnits = Array.from(new Set(photos.map((p) => p.unit).filter((u): u is string => Boolean(u))));

  const hasActiveFilters =
    speciesFilter || weaponFilter || unitFilter || categoryFilter || marketingFilter;

  return (
    <main style={{ maxWidth: 1600, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Photo Library</h1>
          <p style={{ opacity: 0.8, margin: 0 }}>
            Review and manage photos uploaded by guides. Approve photos for marketing to add them to Past Successes.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: 20,
          background: "#f9fafb",
          borderRadius: 8,
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
            {uniqueWeapons.map((w) => (
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
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            Marketing Status
          </label>
          <select
            value={marketingFilter}
            onChange={(e) => setMarketingFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">All Photos</option>
            <option value="false">Not Approved (Review)</option>
            <option value="true">Approved (In Past Successes)</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={() => {
                setSpeciesFilter("");
                setWeaponFilter("");
                setUnitFilter("");
                setCategoryFilter("");
                setMarketingFilter("");
              }}
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
        <p>Loading photos...</p>
      ) : error ? (
        <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8 }}>
          <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>
        </div>
      ) : photos.length === 0 ? (
        <div style={{ padding: 24, background: "#f3f4f6", borderRadius: 8, textAlign: "center" }}>
          <p style={{ margin: 0, opacity: 0.8 }}>
            {hasActiveFilters ? "No photos match your filters." : "No photos uploaded yet."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <p style={{ opacity: 0.8, margin: 0 }}>
              Showing <strong>{photos.length}</strong> {photos.length === 1 ? "photo" : "photos"}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 16,
            }}
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "white",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedPhoto(photo)}
              >
                {photo.signed_url && (
                  <div style={{ position: "relative", width: "100%", height: 200 }}>
                    <Image
                      src={photo.signed_url}
                      alt={photo.file_name}
                      fill
                      style={{ objectFit: "cover" }}
                      unoptimized
                    />
                  </div>
                )}
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                    {photo.species || "Unknown"} • {photo.weapon || "Any"}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    {photo.category || "Uncategorized"}
                    {photo.approved_for_marketing && " • ✅ Marketing"}
                    {photo.is_private && " • 🔒 Private"}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                    {new Date(photo.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            style={{
              maxWidth: 1200,
              maxHeight: "90vh",
              background: "white",
              borderRadius: 12,
              overflow: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "rgba(0,0,0,0.5)",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                cursor: "pointer",
                fontSize: 24,
                zIndex: 10,
              }}
            >
              ×
            </button>

            {selectedPhoto.signed_url && (
              <div style={{ position: "relative", width: "100%", minHeight: 400 }}>
                <Image
                  src={selectedPhoto.signed_url}
                  alt={selectedPhoto.file_name}
                  fill
                  style={{ objectFit: "contain" }}
                  unoptimized
                />
              </div>
            )}

            <div style={{ padding: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>Photo Details</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div>
                  <strong>File:</strong> {selectedPhoto.file_name}
                </div>
                <div>
                  <strong>Size:</strong> {(selectedPhoto.file_size / 1024 / 1024).toFixed(2)} MB
                </div>
                <div>
                  <strong>Species:</strong> {selectedPhoto.species || "N/A"}
                </div>
                <div>
                  <strong>Weapon:</strong> {selectedPhoto.weapon || "N/A"}
                </div>
                <div>
                  <strong>Unit:</strong> {selectedPhoto.unit || "N/A"}
                </div>
                <div>
                  <strong>State:</strong> {selectedPhoto.state || "N/A"}
                </div>
                <div>
                  <strong>Category:</strong> {selectedPhoto.category || "Uncategorized"}
                </div>
                <div>
                  <strong>Guide:</strong> {selectedPhoto.guide_username || "N/A"}
                </div>
                <div>
                  <strong>Uploaded:</strong> {new Date(selectedPhoto.uploaded_at).toLocaleString()}
                </div>
                <div>
                  <strong>Hunt:</strong> {selectedPhoto.calendar_events?.title || "N/A"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedPhoto.approved_for_marketing}
                    onChange={(e) =>
                      updatePhoto(selectedPhoto.id, { approved_for_marketing: e.target.checked })
                    }
                  />
                  Approved for Marketing
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedPhoto.is_private}
                    onChange={(e) => updatePhoto(selectedPhoto.id, { is_private: e.target.checked })}
                  />
                  Private (Client Only)
                </label>
                <select
                  value={selectedPhoto.category || ""}
                  onChange={(e) => updatePhoto(selectedPhoto.id, { category: e.target.value || null })}
                  style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4 }}
                >
                  <option value="">No Category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => deletePhoto(selectedPhoto.id)}
                disabled={deletingId === selectedPhoto.id}
                style={{
                  padding: "12px 24px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: deletingId === selectedPhoto.id ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {deletingId === selectedPhoto.id ? "Deleting..." : "Delete Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
