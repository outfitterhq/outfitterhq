"use client";

import { useState, useEffect } from "react";

interface TimeOffRequest {
  id: string;
  guide_username: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export default function GuideTimeOffPage() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [guideUsername, setGuideUsername] = useState<string>("");

  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });

  useEffect(() => {
    loadGuideInfo();
    loadRequests();
  }, []);

  async function loadGuideInfo() {
    try {
      const res = await fetch("/api/guide/profile");
      if (res.ok) {
        const data = await res.json();
        setGuideUsername(data.guide.username || data.guide.email || "");
      }
    } catch (e) {
      console.error("Failed to load guide info", e);
    }
  }

  async function loadRequests() {
    try {
      setLoading(true);
      // Use guide-specific endpoint
      const res = await fetch("/api/guide/time-off");
      if (!res.ok) throw new Error("Failed to load requests");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e: any) {
      console.error("Error loading requests:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Load guide info if not already loaded
    if (!guideUsername) {
      try {
        const profileRes = await fetch("/api/guide/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const username = profileData.guide.username || profileData.guide.email || "";
          if (!username) {
            alert("Unable to determine guide username. Please refresh the page.");
            return;
          }
          setGuideUsername(username);
        } else {
          alert("Failed to load guide profile. Please refresh the page.");
          return;
        }
      } catch (e) {
        alert("Error loading guide profile. Please refresh the page.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guide_username: guideUsername,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit request");
      }

      setShowForm(false);
      setFormData({ start_date: "", end_date: "", reason: "" });
      await loadRequests();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "approved":
        return { bg: "#d1fae5", color: "#065f46" };
      case "denied":
        return { bg: "#fee2e2", color: "#991b1b" };
      default:
        return { bg: "#fef3c7", color: "#92400e" };
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Time Off Requests</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Request days off and view your time off history</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 20px",
            background: "#059669",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showForm ? "Cancel" : "+ New Request"}
        </button>
      </div>

      {/* Request Form */}
      {showForm && (
        <div style={{ padding: 24, background: "white", border: "1px solid #ddd", borderRadius: 8, marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600 }}>New Time Off Request</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
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
                <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
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
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Reason (Optional)</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 20px",
                background: submitting ? "#999" : "#059669",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: submitting ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <div style={{ padding: 48, background: "white", border: "1px solid #ddd", borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>No time off requests yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((request) => {
            const statusColors = getStatusColor(request.status);
            return (
              <div
                key={request.id}
                style={{
                  padding: 20,
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background: statusColors.bg,
                          color: statusColors.color,
                        }}
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      <span style={{ fontSize: 14, color: "#666" }}>
                        {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    {request.reason && (
                      <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#666" }}>{request.reason}</p>
                    )}
                    {request.reviewed_at && (
                      <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#999" }}>
                        Reviewed {new Date(request.reviewed_at).toLocaleDateString()}
                        {request.reviewed_by && ` by ${request.reviewed_by}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
