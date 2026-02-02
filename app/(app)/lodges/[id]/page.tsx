"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface LodgePhoto {
  id: string;
  storage_path: string;
  photo_type: string;
  display_order: number;
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

export default function LodgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lodgeId = params.id as string;

  const [lodge, setLodge] = useState<Lodge | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Array<LodgePhoto & { signed_url?: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (lodgeId) {
      loadLodge();
      loadPhotos();
    }
  }, [lodgeId]);

  async function loadLodge() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/lodges");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to load lodge: ${res.status}`);
      }
      const data = await res.json();
      const found = data.lodges?.find((l: Lodge) => l.id === lodgeId);
      setLodge(found || null);
    } catch (e: any) {
      console.error("Error loading lodge:", e);
      alert(`Error loading lodge: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadPhotos() {
    try {
      const res = await fetch(`/api/admin/lodges/${lodgeId}/photos`);
      if (!res.ok) throw new Error("Failed to load photos");
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (e: any) {
      console.error("Error loading photos:", e);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("photo_type", "other");

      const res = await fetch(`/api/admin/lodges/${lodgeId}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload photo");
      }

      await loadPhotos();
      setShowUpload(false);
      e.target.value = ""; // Reset input
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Delete this photo?")) return;

    try {
      const res = await fetch(`/api/admin/lodges/${lodgeId}/photos/${photoId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete photo");
      await loadPhotos();
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!lodge) return <p>Lodge not found</p>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/lodges" style={{ color: "#1a472a", textDecoration: "none" }}>← Back to Lodges</Link>
        <h1 style={{ marginTop: 12, marginBottom: 8 }}>{lodge.name}</h1>
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        <div style={{ padding: 20, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Details</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {lodge.address && (
              <div>
                <strong>Address:</strong> {lodge.address}
              </div>
            )}
            {lodge.gps_latitude && lodge.gps_longitude && (
              <div>
                <strong>GPS:</strong> {lodge.gps_latitude}, {lodge.gps_longitude}
              </div>
            )}
            {lodge.onx_share_link && (
              <div>
                <strong>OnX Link:</strong>{" "}
                <a href={lodge.onx_share_link} target="_blank" rel="noopener noreferrer" style={{ color: "#1a472a" }}>
                  Open in OnX
                </a>
              </div>
            )}
            {lodge.description && (
              <div>
                <strong>Description:</strong>
                <p style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{lodge.description}</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 20, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Capacity</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#1a472a" }}>{lodge.max_clients}</div>
              <div style={{ fontSize: 14, color: "#666" }}>Max Clients</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#1a472a" }}>{lodge.max_guides}</div>
              <div style={{ fontSize: 14, color: "#666" }}>Max Guides</div>
            </div>
            {lodge.max_beds && (
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#1a472a" }}>{lodge.max_beds}</div>
                <div style={{ fontSize: 14, color: "#666" }}>Max Beds</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 20, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Photos ({photos.length})</h2>
            <button
              onClick={() => setShowUpload(!showUpload)}
              style={{
                padding: "8px 16px",
                background: "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Upload Photo
            </button>
          </div>

          {showUpload && (
            <div style={{ padding: 16, background: "#f9f9f9", borderRadius: 8, marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Select Photo</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoUpload}
                disabled={uploading}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: 6 }}
              />
              <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Max file size: 10MB. Formats: JPEG, PNG, WebP
              </p>
            </div>
          )}

          {photos.length === 0 ? (
            <p style={{ color: "#666", fontSize: 14 }}>No photos uploaded yet</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {photos.map((photo) => (
                <div key={photo.id} style={{ position: "relative" }}>
                  {photo.signed_url ? (
                    <img
                      src={photo.signed_url}
                      alt={`Lodge photo ${photo.photo_type}`}
                      style={{
                        width: "100%",
                        height: 200,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 200,
                        background: "#f0f0f0",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#999",
                      }}
                    >
                      Loading...
                    </div>
                  )}
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      padding: "6px 12px",
                      background: "rgba(220, 53, 69, 0.9)",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Delete
                  </button>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#666", textTransform: "capitalize" }}>
                    {photo.photo_type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
