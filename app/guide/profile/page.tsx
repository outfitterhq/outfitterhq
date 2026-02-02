"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface GuideProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  has_guide_license: boolean;
  has_cpr_card: boolean;
  has_leave_no_trace: boolean;
}

export default function GuideProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle_year: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_color: "",
    vehicle_plate: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await fetch("/api/guide/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      setProfile(data.guide);
      setFormData({
        name: data.guide.name || "",
        phone: data.guide.phone || "",
        vehicle_year: data.guide.vehicle_year || "",
        vehicle_make: data.guide.vehicle_make || "",
        vehicle_model: data.guide.vehicle_model || "",
        vehicle_color: data.guide.vehicle_color || "",
        vehicle_plate: data.guide.vehicle_plate || "",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/guide/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save profile");
      }

      setMessage("Profile saved successfully!");
      await loadProfile();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading profile...</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Profile</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>Manage your guide profile information</p>
      </div>

      {error && (
        <div style={{ padding: 12, background: "#fee", border: "1px solid #fcc", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#c00" }}>Error: {error}</p>
        </div>
      )}

      {message && (
        <div style={{ padding: 12, background: "#efe", border: "1px solid #cfc", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#060" }}>{message}</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        {/* Personal Information */}
        <div style={{ padding: 24, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600 }}>Personal Information</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Email</label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                  background: "#f5f5f5",
                  color: "#666",
                }}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#666" }}>Email cannot be changed</p>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        </div>

        {/* Vehicle Information */}
        <div style={{ padding: 24, background: "white", border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600 }}>Vehicle Information</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Year</label>
              <input
                type="text"
                value={formData.vehicle_year}
                onChange={(e) => setFormData({ ...formData, vehicle_year: e.target.value })}
                placeholder="e.g., 2020"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Make</label>
              <input
                type="text"
                value={formData.vehicle_make}
                onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value })}
                placeholder="e.g., Ford"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Model</label>
              <input
                type="text"
                value={formData.vehicle_model}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                placeholder="e.g., F-150"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Color</label>
              <input
                type="text"
                value={formData.vehicle_color}
                onChange={(e) => setFormData({ ...formData, vehicle_color: e.target.value })}
                placeholder="e.g., Black"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>License Plate</label>
              <input
                type="text"
                value={formData.vehicle_plate}
                onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                placeholder="e.g., ABC-1234"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "12px 24px",
            background: saving ? "#999" : "#059669",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: saving ? "not-allowed" : "pointer",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
