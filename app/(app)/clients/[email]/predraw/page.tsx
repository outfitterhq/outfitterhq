"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PreDraw {
  id: string;
  nmdgf_username: string | null;
  height: string | null;
  weight: string | null;
  eye_color: string | null;
  hair_color: string | null;
  dob: string | null;
  drivers_license_number: string | null;
  drivers_license_state: string | null;
  ssn_last4: string | null;
  passport_number: string | null;
  credit_card_last4: string | null;
  exp_mm: string | null;
  exp_yyyy: string | null;
  elk_comments: string | null;
  deer_comments: string | null;
  antelope_comments: string | null;
  acknowledged_contract: boolean;
  submit_choice: string | null;
  docusign_status: string | null;
  submitted_at: string | null;
  year: number;
  admin_reviewed_at: string | null;
}

interface Selection {
  id: string;
  species: string;
  choice_index: number;
  weapon: string | null;
  code_or_unit: string | null;
  dates: string | null;
}

export default function PreDrawDetailPage() {
  const params = useParams();
  const email = decodeURIComponent(params.email as string);
  
  const [predraw, setPredraw] = useState<PreDraw | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  async function loadData() {
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/predraw`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load pre-draw contract");
        return;
      }
      const data = await res.json();
      setPredraw(data.predraw);
      setSelections(data.selections || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [email]);

  async function markAsReviewed() {
    if (!predraw || marking) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/predraw/review`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to mark as reviewed");
        return;
      }
      await loadData();
    } catch (e) {
      alert(String(e));
    } finally {
      setMarking(false);
    }
  }

  async function markDocuSignComplete() {
    if (!predraw || marking) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/predraw/docusign`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update DocuSign status");
        return;
      }
      await loadData();
    } catch (e) {
      alert(String(e));
    } finally {
      setMarking(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <p>Loading pre-draw contract...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
          ← Back to Client
        </Link>
        <h1 style={{ marginTop: 16 }}>Pre-Draw Contract</h1>
        <p style={{ background: "#fee", padding: 12, borderRadius: 8 }}>{error}</p>
      </main>
    );
  }

  if (!predraw) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
          ← Back to Client
        </Link>
        <h1 style={{ marginTop: 16 }}>Pre-Draw Contract</h1>
        <p>No pre-draw contract submitted yet.</p>
      </main>
    );
  }

  const Field = ({ label, value }: { label: string; value: string | null | boolean }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: "#666", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16 }}>
        {typeof value === "boolean" ? (value ? "Yes" : "No") : (value || "—")}
      </div>
    </div>
  );

  // Group selections by species
  const selectionsBySpecies: Record<string, Selection[]> = {};
  selections.forEach(s => {
    if (!selectionsBySpecies[s.species]) {
      selectionsBySpecies[s.species] = [];
    }
    selectionsBySpecies[s.species].push(s);
  });

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
      <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
        ← Back to Client
      </Link>
      
      <h1 style={{ marginTop: 16, marginBottom: 8 }}>Pre-Draw Contract {predraw.year}</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Submitted: {predraw.submitted_at ? new Date(predraw.submitted_at).toLocaleString() : "Unknown"}
        {predraw.docusign_status && ` • DocuSign: ${predraw.docusign_status}`}
      </p>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Submission Info</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Submit Choice" value={predraw.submit_choice === "authorize_g3" ? "Outfitter submits application" : "Client submits own"} />
          <Field label="Contract Acknowledged" value={predraw.acknowledged_contract} />
        </div>
      </section>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>NMDGF & License Info</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Field label="NMDGF Username" value={predraw.nmdgf_username} />
          <Field label="Height" value={predraw.height} />
          <Field label="Weight" value={predraw.weight} />
          <Field label="Eye Color" value={predraw.eye_color} />
          <Field label="Hair Color" value={predraw.hair_color} />
          <Field label="DOB" value={predraw.dob} />
          <Field label="Driver's License #" value={predraw.drivers_license_number} />
          <Field label="DL State" value={predraw.drivers_license_state} />
          <Field label="SSN (last 4)" value={predraw.ssn_last4} />
          <Field label="Passport #" value={predraw.passport_number} />
        </div>
      </section>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Payment Info</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Field label="Card (last 4)" value={predraw.credit_card_last4 ? `****${predraw.credit_card_last4}` : null} />
          <Field label="Exp Month" value={predraw.exp_mm} />
          <Field label="Exp Year" value={predraw.exp_yyyy} />
        </div>
      </section>

      <section style={{ background: "#e8f5e9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #c8e6c9", paddingBottom: 8 }}>Hunt Selections</h2>
        
        {Object.keys(selectionsBySpecies).length === 0 ? (
          <p style={{ color: "#666" }}>No hunt codes selected (client may have chosen outfitter to select hunts)</p>
        ) : (
          Object.entries(selectionsBySpecies).map(([species, sels]) => (
            <div key={species} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>{species}</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#c8e6c9" }}>
                    <th style={{ padding: 8, textAlign: "left" }}>Choice</th>
                    <th style={{ padding: 8, textAlign: "left" }}>Weapon</th>
                    <th style={{ padding: 8, textAlign: "left" }}>Hunt Code</th>
                    <th style={{ padding: 8, textAlign: "left" }}>Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {sels.sort((a, b) => a.choice_index - b.choice_index).map(sel => (
                    <tr key={sel.id} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: 8 }}>{sel.choice_index === 1 ? "1st" : sel.choice_index === 2 ? "2nd" : "3rd"}</td>
                      <td style={{ padding: 8 }}>{sel.weapon || "—"}</td>
                      <td style={{ padding: 8, fontFamily: "monospace" }}>{sel.code_or_unit || "—"}</td>
                      <td style={{ padding: 8 }}>{sel.dates || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Comments</h2>
        <Field label="Elk Comments" value={predraw.elk_comments} />
        <Field label="Deer Comments" value={predraw.deer_comments} />
        <Field label="Antelope Comments" value={predraw.antelope_comments} />
      </section>

      <section style={{ background: "#e3f2fd", padding: 20, borderRadius: 12, marginBottom: 20, border: "1px solid #90caf9" }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #64b5f6", paddingBottom: 8 }}>Admin Review & DocuSign</h2>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>DocuSign Status</div>
          <span style={{
            padding: "6px 12px",
            borderRadius: 6,
            background: predraw.docusign_status === "completed" ? "#e8f5e9" : "#fff3e0",
            color: predraw.docusign_status === "completed" ? "#2e7d32" : "#e65100",
            fontWeight: 600,
          }}>
            {predraw.docusign_status === "completed" ? "✓ Completed" : predraw.docusign_status || "Pending"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {predraw.admin_reviewed_at ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2e7d32" }}>
              <span style={{ fontSize: 20 }}>✓</span>
              <span style={{ fontWeight: 600 }}>
                Reviewed on {new Date(predraw.admin_reviewed_at).toLocaleString()}
              </span>
            </div>
          ) : (
            <button
              onClick={markAsReviewed}
              disabled={marking}
              style={{
                padding: "10px 20px",
                background: marking ? "#9e9e9e" : "#1976d2",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                cursor: marking ? "not-allowed" : "pointer",
              }}
            >
              {marking ? "Saving..." : "Mark as Reviewed"}
            </button>
          )}

          {predraw.docusign_status !== "completed" && (
            <button
              onClick={markDocuSignComplete}
              disabled={marking}
              style={{
                padding: "10px 20px",
                background: marking ? "#9e9e9e" : "#2e7d32",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                cursor: marking ? "not-allowed" : "pointer",
              }}
            >
              {marking ? "Updating..." : "Mark DocuSign Complete"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
