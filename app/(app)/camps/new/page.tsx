"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Lodge {
  id: string;
  name: string;
  max_clients: number;
  max_guides: number;
}

export default function NewCampPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    state: "",
    unit: "",
    hunt_code: "",
    start_date: "",
    end_date: "",
    camp_type: "lodge" as "lodge" | "spike" | "mobile",
    lodge_id: "",
    max_clients: "",
    max_guides: "",
    onx_share_link: "",
    gps_latitude: "",
    gps_longitude: "",
    location_label: "",
  });

  useEffect(() => {
    loadLodges();
  }, []);

  async function loadLodges() {
    try {
      const res = await fetch("/api/admin/lodges");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to load lodges:", errorData);
        // Don't alert here, just log - lodges are optional
        return;
      }
      const data = await res.json();
      setLodges(data.lodges || []);
    } catch (e: any) {
      console.error("Error loading lodges:", e);
      // Don't alert here, just log - lodges are optional
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        name: formData.name,
        state: formData.state,
        unit: formData.unit,
        hunt_code: formData.hunt_code,
        start_date: formData.start_date,
        end_date: formData.end_date,
        camp_type: formData.camp_type,
      };

      if (formData.camp_type === "lodge" && formData.lodge_id) {
        payload.lodge_id = formData.lodge_id;
      } else {
        if (!formData.max_clients || !formData.max_guides) {
          alert("Max clients and guides are required for spike/mobile camps");
          setLoading(false);
          return;
        }
        payload.max_clients = parseInt(formData.max_clients, 10);
        payload.max_guides = parseInt(formData.max_guides, 10);
      }

      if (formData.onx_share_link) payload.onx_share_link = formData.onx_share_link;
      if (formData.gps_latitude) payload.gps_latitude = parseFloat(formData.gps_latitude);
      if (formData.gps_longitude) payload.gps_longitude = parseFloat(formData.gps_longitude);
      if (formData.location_label) payload.location_label = formData.location_label;

      const res = await fetch("/api/admin/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create camp");
      }

      const data = await res.json();
      router.push(`/camps/${data.camp.id}`);
    } catch (e: any) {
      alert(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Create New Camp</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Camp Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Camp X – Unit 15 Archery"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>State *</label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Unit *</label>
              <input
                type="text"
                required
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Hunt Code *</label>
            <input
              type="text"
              required
              value={formData.hunt_code}
              onChange={(e) => setFormData({ ...formData, hunt_code: e.target.value })}
              placeholder="e.g., ELK-1-294"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Start Date *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>End Date *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Camp Type *</label>
            <select
              required
              value={formData.camp_type}
              onChange={(e) => setFormData({ ...formData, camp_type: e.target.value as any })}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
            >
              <option value="lodge">Lodge</option>
              <option value="spike">Spike</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>

          {formData.camp_type === "lodge" && (
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Lodge</label>
              <select
                value={formData.lodge_id}
                onChange={(e) => setFormData({ ...formData, lodge_id: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
              >
                <option value="">Select a lodge...</option>
                {lodges.map((lodge) => (
                  <option key={lodge.id} value={lodge.id}>
                    {lodge.name} (Max {lodge.max_clients} clients, {lodge.max_guides} guides)
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.camp_type !== "lodge" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Max Clients *</label>
                  <input
                    type="number"
                    required
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
                    value={formData.max_guides}
                    onChange={(e) => setFormData({ ...formData, max_guides: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ borderTop: "1px solid #ddd", paddingTop: 16, marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>OnX Location (Optional)</h3>
            <div style={{ display: "grid", gap: 12 }}>
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
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Location Label</label>
                <input
                  type="text"
                  value={formData.location_label}
                  onChange={(e) => setFormData({ ...formData, location_label: e.target.value })}
                  placeholder="Optional address or pin name"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 24px",
                background: loading ? "#999" : "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading ? "Creating..." : "Create Camp"}
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
