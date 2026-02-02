"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PhotoFile {
  file: File;
  photoType: string;
  preview: string;
}

export default function NewLodgePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    gps_latitude: "",
    gps_longitude: "",
    onx_share_link: "",
    description: "",
    max_clients: "10",
    max_guides: "5",
    max_beds: "",
  });

  function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    
    files.forEach((file) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert(`${file.name} is not an image file`);
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is 10MB`);
        return;
      }

      const preview = URL.createObjectURL(file);
      setPhotos((prev) => [
        ...prev,
        {
          file,
          photoType: "other",
          preview,
        },
      ]);
    });

    e.target.value = ""; // Reset input
  }

  function handlePhotoRemove(index: number) {
    setPhotos((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handlePhotoTypeChange(index: number, photoType: string) {
    setPhotos((prev) =>
      prev.map((photo, i) => (i === index ? { ...photo, photoType } : photo))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // First, create the lodge
      const payload: any = {
        name: formData.name,
        max_clients: parseInt(formData.max_clients, 10),
        max_guides: parseInt(formData.max_guides, 10),
      };

      if (formData.address) payload.address = formData.address;
      if (formData.gps_latitude) payload.gps_latitude = parseFloat(formData.gps_latitude);
      if (formData.gps_longitude) payload.gps_longitude = parseFloat(formData.gps_longitude);
      if (formData.onx_share_link) payload.onx_share_link = formData.onx_share_link;
      if (formData.description) payload.description = formData.description;
      if (formData.max_beds) payload.max_beds = parseInt(formData.max_beds, 10);

      const res = await fetch("/api/admin/lodges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create lodge");
      }

      const data = await res.json();
      const lodgeId = data.lodge.id;

      // Then, upload photos if any
      if (photos.length > 0) {
        setUploadingPhotos(true);
        try {
          await Promise.all(
            photos.map(async (photo) => {
              const formData = new FormData();
              formData.append("file", photo.file);
              formData.append("photo_type", photo.photoType);

              const uploadRes = await fetch(`/api/admin/lodges/${lodgeId}/photos`, {
                method: "POST",
                body: formData,
              });

              if (!uploadRes.ok) {
                const err = await uploadRes.json();
                throw new Error(err.error || `Failed to upload ${photo.file.name}`);
              }
            })
          );
        } catch (uploadError: any) {
          // Lodge was created, but photo upload failed
          alert(`Lodge created, but some photos failed to upload: ${uploadError.message}`);
        } finally {
          setUploadingPhotos(false);
        }
      }

      router.push(`/lodges/${lodgeId}`);
    } catch (e: any) {
      alert(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Create New Lodge</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Lodge Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Lodge"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street address"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>GPS Latitude</label>
              <input
                type="number"
                step="any"
                value={formData.gps_latitude}
                onChange={(e) => setFormData({ ...formData, gps_latitude: e.target.value })}
                placeholder="e.g., 35.1234"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>GPS Longitude</label>
              <input
                type="number"
                step="any"
                value={formData.gps_longitude}
                onChange={(e) => setFormData({ ...formData, gps_longitude: e.target.value })}
                placeholder="e.g., -106.5678"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>OnX Share Link</label>
            <input
              type="url"
              value={formData.onx_share_link}
              onChange={(e) => setFormData({ ...formData, onx_share_link: e.target.value })}
              placeholder="Paste OnX share link"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description or rules"
              rows={4}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div style={{ borderTop: "1px solid #ddd", paddingTop: 16, marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Photos</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Add Photos</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handlePhotoAdd}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: 6 }}
              />
              <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Max file size: 10MB per photo. Formats: JPEG, PNG, WebP
              </p>
            </div>

            {photos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
                {photos.map((photo, index) => (
                  <div key={index} style={{ position: "relative" }}>
                    <img
                      src={photo.preview}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: "100%",
                        height: 150,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handlePhotoRemove(index)}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        padding: "4px 8px",
                        background: "rgba(220, 53, 69, 0.9)",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      ✕
                    </button>
                    <select
                      value={photo.photoType}
                      onChange={(e) => handlePhotoTypeChange(index, e.target.value)}
                      style={{
                        width: "100%",
                        marginTop: 4,
                        padding: "4px 8px",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    >
                      <option value="exterior">Exterior</option>
                      <option value="interior">Interior</option>
                      <option value="common_area">Common Area</option>
                      <option value="parking">Parking</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #ddd", paddingTop: 16, marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Capacity Limits *</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Max Clients *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.max_clients}
                  onChange={(e) => setFormData({ ...formData, max_clients: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Max Guides *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.max_guides}
                  onChange={(e) => setFormData({ ...formData, max_guides: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Max Beds</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_beds}
                  onChange={(e) => setFormData({ ...formData, max_beds: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading || uploadingPhotos}
              style={{
                padding: "10px 24px",
                background: loading || uploadingPhotos ? "#999" : "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: loading || uploadingPhotos ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading
                ? "Creating Lodge..."
                : uploadingPhotos
                ? `Uploading ${photos.length} Photo${photos.length !== 1 ? "s" : ""}...`
                : "Create Lodge"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                padding: "10px 24px",
                background: "#f5f5f5",
                color: "#333",
                border: "1px solid #ddd",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
