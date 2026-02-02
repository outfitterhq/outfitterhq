"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SpeciesSelection {
  id: string;
  species: string;
  weapon: string;
  code_or_unit: string;
  dates: string;
  choice_index: number;
}

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface DrawApplication {
  id: string;
  client_id: string;
  outfitter_id: string;
  year: number;
  nmdgf_username: string;
  height: string;
  weight: string;
  eye_color: string;
  hair_color: string;
  dob: string;
  drivers_license_number: string;
  drivers_license_state: string;
  ssn_last4: string;
  passport_number: string;
  credit_card_last4: string;
  exp_mm: string;
  exp_yyyy: string;
  elk_comments: string;
  deer_comments: string;
  antelope_comments: string;
  submit_choice: string;
  acknowledged_contract: boolean;
  submitted_at: string;
  submission_status?: string | null;
  completed_at?: string | null;
  client: Client;
  selections: SpeciesSelection[];
}

export default function DrawApplicationsPage() {
  const [applications, setApplications] = useState<DrawApplication[]>([]);
  const [allApplications, setAllApplications] = useState<DrawApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "completed" | "all">("pending");

  useEffect(() => {
    loadApplications();
  }, [year, statusFilter]);

  async function loadApplications() {
    setLoading(true);
    setError(null);
    try {
      // Load filtered applications
      const res = await fetch(`/api/admin/draw-applications?year=${year}&status=${statusFilter}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load applications");
      }
      const data = await res.json();
      setApplications(data.applications || []);

      // Also load all applications for tab counts
      const allRes = await fetch(`/api/admin/draw-applications?year=${year}&status=all`);
      if (allRes.ok) {
        const allData = await allRes.json();
        setAllApplications(allData.applications || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function markAsCompleted(id: string) {
    try {
      const res = await fetch(`/api/admin/draw-applications/${id}/complete`, {
        method: "PUT",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to mark as completed");
      }
      // Reload applications
      await loadApplications();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  return (
    <main style={{ maxWidth: 1400, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Draw Application Submissions</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Clients who authorized you to submit their draw applications
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Year:</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              style={{
                padding: "6px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                width: 80,
              }}
            />
          </label>
          <Link
            href="/dashboard"
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
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "2px solid #eee", paddingBottom: 8 }}>
        <button
          onClick={() => setStatusFilter("pending")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: statusFilter === "pending" ? "#1a472a" : "transparent",
            color: statusFilter === "pending" ? "white" : "#666",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: statusFilter === "pending" ? 600 : 400,
            borderBottom: statusFilter === "pending" ? "2px solid #1a472a" : "2px solid transparent",
            marginBottom: -10,
          }}
        >
          Pending ({allApplications.filter(a => !a.submission_status || a.submission_status === "pending").length})
        </button>
        <button
          onClick={() => setStatusFilter("completed")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: statusFilter === "completed" ? "#1a472a" : "transparent",
            color: statusFilter === "completed" ? "white" : "#666",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: statusFilter === "completed" ? 600 : 400,
            borderBottom: statusFilter === "completed" ? "2px solid #1a472a" : "2px solid transparent",
            marginBottom: -10,
          }}
        >
          Completed ({allApplications.filter(a => a.submission_status === "completed").length})
        </button>
        <button
          onClick={() => setStatusFilter("all")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: statusFilter === "all" ? "#1a472a" : "transparent",
            color: statusFilter === "all" ? "white" : "#666",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: statusFilter === "all" ? 600 : 400,
            borderBottom: statusFilter === "all" ? "2px solid #1a472a" : "2px solid transparent",
            marginBottom: -10,
          }}
        >
          All ({allApplications.length})
        </button>
      </div>

      {loading ? (
        <p>Loading applications...</p>
      ) : error ? (
        <div style={{ padding: 16, background: "#fee", border: "1px solid #fcc", borderRadius: 8 }}>
          <p style={{ margin: 0, color: "#c00" }}>Error: {error}</p>
        </div>
      ) : applications.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "#f9f9f9", borderRadius: 8 }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>
            {statusFilter === "pending" 
              ? `No pending applications for ${year}`
              : statusFilter === "completed"
              ? `No completed applications for ${year}`
              : `No applications for ${year}`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {statusFilter === "pending" && (
            <div style={{ padding: 12, background: "#e8f5e9", borderRadius: 8, marginBottom: 8 }}>
              <strong>{applications.length}</strong> client{applications.length !== 1 ? "s" : ""} ready for submission
            </div>
          )}
          {statusFilter === "completed" && (
            <div style={{ padding: 12, background: "#dbeafe", borderRadius: 8, marginBottom: 8 }}>
              <strong>{applications.length}</strong> completed application{applications.length !== 1 ? "s" : ""}
            </div>
          )}

          {applications.map((app) => (
            <div
              key={app.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                overflow: "hidden",
                background: "white",
              }}
            >
              {/* Header - Always visible (collapsed view) */}
              <div
                onClick={() => toggleExpand(app.id)}
                style={{
                  padding: 16,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: expandedId === app.id ? "#f0f9ff" : "white",
                  transition: "background 0.2s",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                    {app.client.first_name} {app.client.last_name}
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#666" }}>
                    {app.client.email}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#888" }}>
                    {app.selections.length} species selection{app.selections.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  {app.submission_status === "completed" ? (
                    <span style={{ padding: "6px 14px", background: "#d1fae5", color: "#065f46", borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                      ✓ Completed
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Mark this application as completed?")) {
                          markAsCompleted(app.id);
                        }
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "#1a472a",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Mark Completed
                    </button>
                  )}
                  <span style={{ fontSize: 18, color: "#666" }}>
                    {expandedId === app.id ? "▼" : "▶"}
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === app.id && (
                <div style={{ padding: 20, borderTop: "1px solid #eee", background: "#fafafa" }}>
                  {/* Submission Dates */}
                  <div style={{ marginBottom: 20, padding: 12, background: "#f0f9ff", borderRadius: 6, fontSize: 13, color: "#666" }}>
                    <strong>Submitted:</strong> {formatDate(app.submitted_at)}
                    {app.completed_at && <span> • <strong>Completed:</strong> {formatDate(app.completed_at)}</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                    {/* Client Information */}
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
                        Client Information
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <Field label="Name" value={`${app.client.first_name || ""} ${app.client.last_name || ""}`.trim()} />
                        <Field label="Email" value={app.client.email || "N/A"} />
                        <Field label="Phone" value={app.client.phone || "N/A"} />
                      </div>
                    </div>

                    {/* NMDGF & License Info */}
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
                        NMDGF & License Information
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <Field label="NMDGF Username" value={app.nmdgf_username || "N/A"} />
                        <Field label="Date of Birth" value={app.dob ? formatDate(app.dob) : "N/A"} />
                        <Field label="Height" value={app.height || "N/A"} />
                        <Field label="Weight" value={app.weight || "N/A"} />
                        <Field label="Eye Color" value={app.eye_color || "N/A"} />
                        <Field label="Hair Color" value={app.hair_color || "N/A"} />
                        <Field label="Driver's License #" value={app.drivers_license_number || "N/A"} />
                        <Field label="Driver's License State" value={app.drivers_license_state || "N/A"} />
                        <Field label="SSN Last 4" value={app.ssn_last4 || "N/A"} />
                        <Field label="Passport Number" value={app.passport_number || "N/A"} />
                      </div>
                    </div>

                    {/* Payment Authorization */}
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
                        Payment Authorization
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <Field label="Credit Card Last 4" value={app.credit_card_last4 || "N/A"} />
                        <Field label="Expiration" value={app.exp_mm && app.exp_yyyy ? `${app.exp_mm}/${app.exp_yyyy}` : "N/A"} />
                      </div>
                    </div>
                  </div>

                  {/* Species Selections */}
                  {app.selections && app.selections.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
                        Species Selections ({app.selections.length})
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                        {app.selections.map((sel, idx) => (
                          <div
                            key={sel.id}
                            style={{
                              padding: 12,
                              background: "white",
                              border: "1px solid #ddd",
                              borderRadius: 6,
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                              Choice #{sel.choice_index}: {sel.species}
                            </div>
                            <div style={{ fontSize: 13, color: "#666" }}>
                              <div>Weapon: {sel.weapon}</div>
                              <div>Code/Unit: {sel.code_or_unit || "N/A"}</div>
                              <div>Dates: {sel.dates || "N/A"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  {(app.elk_comments || app.deer_comments || app.antelope_comments) && (
                    <div style={{ marginTop: 24 }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
                        Comments
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {app.elk_comments && <Field label="Elk Comments" value={app.elk_comments} />}
                        {app.deer_comments && <Field label="Deer Comments" value={app.deer_comments} />}
                        {app.antelope_comments && <Field label="Antelope Comments" value={app.antelope_comments} />}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #ddd" }}>
                    <Link
                      href={`/clients/${encodeURIComponent(app.client.email || "")}/predraw`}
                      style={{
                        display: "inline-block",
                        padding: "10px 20px",
                        background: "#1a472a",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: 6,
                        fontWeight: 600,
                      }}
                    >
                      View Full Details →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>{label}:</span>
      <div style={{ fontSize: 14, marginTop: 2 }}>{value || "N/A"}</div>
    </div>
  );
}
