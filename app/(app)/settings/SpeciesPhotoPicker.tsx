"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

// Component to preview photo (handles both URLs and photo IDs)
function SpeciesPhotoPreview({ url, species }: { url: string; species: string }) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setDisplayUrl(null);
      return;
    }

    if (url.startsWith("photo:")) {
      // Extract photo ID and fetch fresh signed URL
      const photoId = url.replace("photo:", "");
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
      setDisplayUrl(url);
    }
  }, [url]);

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: 120,
          borderRadius: 4,
          border: "1px solid #ddd",
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
    <div style={{ position: "relative", width: "100%", height: 120, borderRadius: 4, overflow: "hidden", border: "1px solid #ddd", background: "#f3f4f6" }}>
      <Image
        src={displayUrl}
        alt={species}
        fill
        style={{ objectFit: "cover" }}
        unoptimized
        onError={(e) => {
          console.error("Failed to load photo preview:", displayUrl);
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}

interface Photo {
  id: string;
  signed_url: string | null;
  storage_path: string;
  file_name: string;
  species: string | null;
  weapon: string | null;
  unit: string | null;
  category: string | null;
}

interface SpeciesPhotoPickerProps {
  species: string;
  currentUrl: string;
  onSelect: (url: string) => void;
  onRemove: () => void;
}

// Removed unused interface

export default function SpeciesPhotoPicker({
  species,
  currentUrl,
  onSelect,
  onRemove,
}: SpeciesPhotoPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSpecies, setFilterSpecies] = useState(species);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterSpecies) params.append("species", filterSpecies);
      params.append("approved_for_marketing", "true"); // Only show marketing-approved photos

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
  }, [filterSpecies]);

  useEffect(() => {
    if (showPicker) {
      loadPhotos();
    }
  }, [showPicker, loadPhotos]);

  return (
    <div>
      <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
        {species}
      </label>
      
      {/* Current Photo Preview */}
      {currentUrl && (
        <div style={{ marginBottom: 8 }}>
          <SpeciesPhotoPreview url={currentUrl} species={species} />
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
            {currentUrl.startsWith("photo:") ? "Selected from photo library" : currentUrl}
          </div>
        </div>
      )}

      {/* Input/Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="url"
          value={currentUrl}
          onChange={(e) => onSelect(e.target.value)}
          style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
          placeholder="https://example.com/elk-photo.jpg or select from library"
        />
        <button
          onClick={() => setShowPicker(!showPicker)}
          style={{
            padding: "8px 16px",
            background: showPicker ? "#666" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          {showPicker ? "Close Library" : "Browse Library"}
        </button>
        {currentUrl && (
          <button
            onClick={onRemove}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid #ef4444",
              color: "#ef4444",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Photo Library Picker */}
      {showPicker && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            background: "#f9fafb",
            marginTop: 8,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
              Filter by Species (optional)
            </label>
            <input
              type="text"
              value={filterSpecies}
              onChange={(e) => setFilterSpecies(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              placeholder="Filter photos by species..."
            />
          </div>

          {loading ? (
            <p style={{ textAlign: "center", padding: 24 }}>Loading photos...</p>
          ) : error ? (
            <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8 }}>
              <p style={{ color: "#dc2626", margin: 0, fontSize: 14 }}>{error}</p>
            </div>
          ) : photos.length === 0 ? (
            <p style={{ textAlign: "center", padding: 24, opacity: 0.7 }}>
              No marketing-approved photos found. Upload photos from hunt closeouts first.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: 12,
                maxHeight: 400,
                overflowY: "auto",
                padding: 8,
              }}
            >
              {photos.map((photo) => {
                // Check if this photo is currently selected (by comparing URL or storage path)
                const isSelected = currentUrl && (
                  currentUrl.includes(photo.id) || 
                  currentUrl.includes(photo.storage_path) ||
                  currentUrl === photo.signed_url
                );
                
                return (
                  <button
                    key={photo.id}
                    onClick={() => {
                      // Store photo ID in format: "photo:{photoId}"
                      // This allows us to fetch fresh signed URLs when needed
                      const photoReference = `photo:${photo.id}`;
                      onSelect(photoReference);
                      setShowPicker(false);
                    }}
                    style={{
                      border: isSelected ? "3px solid #059669" : "1px solid #ddd",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "white",
                      cursor: "pointer",
                      padding: 0,
                      position: "relative",
                    }}
                  >
                    {photo.signed_url && (
                      <div style={{ position: "relative", width: "100%", height: 120, background: "#f3f4f6" }}>
                        <Image
                          src={photo.signed_url}
                          alt={photo.file_name}
                          fill
                          style={{ objectFit: "cover" }}
                          unoptimized
                          onError={(e) => {
                            console.error("Failed to load photo:", photo.signed_url);
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div style={{ padding: 8, fontSize: 10, opacity: 0.7 }}>
                      {photo.category || "Uncategorized"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
