"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

export default function TimeOffRequestsPage() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "denied">("pending");

  useEffect(() => {
    loadRequests();
  }, [filter]);

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const statusParam = filter === "all" ? "" : filter;
      // Add cache-busting timestamp to prevent browser caching
      const baseUrl = "/api/time-off";
      const params = new URLSearchParams();
      if (statusParam) params.set("status", statusParam);
      params.set("_t", Date.now().toString());
      const url = `${baseUrl}?${params.toString()}`;
      
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        console.error("Time off API error:", data);
        throw new Error(data.error || "Failed to load requests");
      }
      
      console.log("Time off API response:", {
        count: data.requests?.length || 0,
        debug: data.debug,
        requests: data.requests,
      });
      
      setRequests(data.requests || []);
    } catch (e: any) {
      console.error("Time off load error:", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: "approved" | "denied") {
    try {
      const res = await fetch(`/api/time-off/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update request");
      }
      await loadRequests();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Time Off Requests</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Review and approve guide time off requests</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => loadRequests()}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: loading ? "#ccc" : "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Loading..." : "🔄 Refresh"}
          </button>
          <Link
            href="/calendar"
            style={{
              padding: "10px 20px",
              background: "#f5f5f5",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to Calendar
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {/* Filter buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "all" ? "#0070f3" : "white",
            color: filter === "all" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          All
        </button>
        <button
          onClick={() => setFilter("pending")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "pending" ? "#ff9500" : "white",
            color: filter === "pending" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Pending {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => setFilter("approved")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "approved" ? "#22c55e" : "white",
            color: filter === "approved" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Approved
        </button>
        <button
          onClick={() => setFilter("denied")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "denied" ? "#ef4444" : "white",
            color: filter === "denied" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Denied
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "#f9f9f9", borderRadius: 8 }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>No {filter === "all" ? "" : filter} requests found</p>
          {error && (
            <p style={{ fontSize: 14, marginTop: 8, color: "#dc3545" }}>
              Error: {error}
            </p>
          )}
          <p style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>
            Check browser console (F12) for debug information
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {requests.map((request) => (
            <div
              key={request.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 20,
                background: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Guide: {request.guide_username}</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, opacity: 0.7 }}>
                    Requested: {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background:
                      request.status === "pending"
                        ? "#ff9500"
                        : request.status === "approved"
                        ? "#22c55e"
                        : "#ef4444",
                    color: "white",
                  }}
                >
                  {request.status.toUpperCase()}
                </span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "8px 0", fontSize: 14 }}>
                  <strong>Dates:</strong> {new Date(request.start_date).toLocaleDateString()} →{" "}
                  {new Date(request.end_date).toLocaleDateString()}
                </p>
                {request.reason && (
                  <p style={{ margin: "8px 0", fontSize: 14 }}>
                    <strong>Reason:</strong> {request.reason}
                  </p>
                )}
                {request.reviewed_at && (
                  <p style={{ margin: "8px 0", fontSize: 12, opacity: 0.7 }}>
                    Reviewed by {request.reviewed_by} on {new Date(request.reviewed_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              {request.status === "pending" && (
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button
                    onClick={() => updateStatus(request.id, "approved")}
                    style={{
                      padding: "10px 20px",
                      background: "#22c55e",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                      flex: 1,
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => updateStatus(request.id, "denied")}
                    style={{
                      padding: "10px 20px",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                      flex: 1,
                    }}
                  >
                    ✗ Deny
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
