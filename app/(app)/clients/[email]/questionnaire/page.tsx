"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Questionnaire {
  id: string;
  full_name: string;
  mailing_address: string | null;
  contact_phone: string | null;
  email: string;
  dob: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  global_rescue_member_number: string | null;
  food_allergies: string | null;
  food_preferences: string | null;
  drink_preferences: string | null;
  specific_accommodation: string | null;
  physical_limitations: string | null;
  health_concerns: string | null;
  general_notes: string | null;
  submitted_at: string | null;
  admin_reviewed_at: string | null;
}

export default function QuestionnaireDetailPage() {
  const params = useParams();
  const router = useRouter();
  const email = decodeURIComponent(params.email as string);
  
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  async function loadData() {
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/questionnaire`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load questionnaire");
        return;
      }
      const data = await res.json();
      setQuestionnaire(data.questionnaire);
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
    if (!questionnaire || marking) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}/questionnaire/review`, {
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

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <p>Loading questionnaire...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
          ← Back to Client
        </Link>
        <h1 style={{ marginTop: 16 }}>Pre-Hunt Questionnaire</h1>
        <p style={{ background: "#fee", padding: 12, borderRadius: 8 }}>{error}</p>
      </main>
    );
  }

  if (!questionnaire) {
    return (
      <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
          ← Back to Client
        </Link>
        <h1 style={{ marginTop: 16 }}>Pre-Hunt Questionnaire</h1>
        <p>No questionnaire submitted yet.</p>
      </main>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const Field = ({ label, value }: { label: string; value: string | null }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: "#666", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16 }}>{value || "—"}</div>
    </div>
  );

  return (
    <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
      <Link href={`/clients/${encodeURIComponent(email)}`} style={{ color: "#0066cc" }}>
        ← Back to Client
      </Link>
      
      <h1 style={{ marginTop: 16, marginBottom: 8 }}>Pre-Hunt Questionnaire</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Submitted: {questionnaire.submitted_at ? new Date(questionnaire.submitted_at).toLocaleString() : "Unknown"}
      </p>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Contact Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Full Name" value={questionnaire.full_name} />
          <Field label="Email" value={questionnaire.email} />
          <Field label="Phone" value={questionnaire.contact_phone} />
          <Field label="Date of Birth" value={formatDate(questionnaire.dob)} />
        </div>
        <Field label="Mailing Address" value={questionnaire.mailing_address} />
      </section>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Emergency Contact</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Emergency Contact Name" value={questionnaire.emergency_contact_name} />
          <Field label="Emergency Contact Phone" value={questionnaire.emergency_contact_phone} />
          <Field label="Global Rescue Member #" value={questionnaire.global_rescue_member_number} />
        </div>
      </section>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Food & Drink Preferences</h2>
        <Field label="Food Allergies" value={questionnaire.food_allergies} />
        <Field label="Food Preferences" value={questionnaire.food_preferences} />
        <Field label="Drink Preferences" value={questionnaire.drink_preferences} />
      </section>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Health & Accommodations</h2>
        <Field label="Specific Accommodation Needs" value={questionnaire.specific_accommodation} />
        <Field label="Physical Limitations" value={questionnaire.physical_limitations} />
        <Field label="Health Concerns" value={questionnaire.health_concerns} />
      </section>

      <section style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Additional Notes</h2>
        <Field label="General Notes" value={questionnaire.general_notes} />
      </section>

      <section style={{ background: "#e8f5e9", padding: 20, borderRadius: 12, marginBottom: 20, border: "1px solid #c8e6c9" }}>
        <h2 style={{ marginTop: 0, fontSize: 18, borderBottom: "1px solid #a5d6a7", paddingBottom: 8 }}>Admin Review</h2>
        {questionnaire.admin_reviewed_at ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#2e7d32", fontSize: 20 }}>✓</span>
            <span style={{ color: "#2e7d32", fontWeight: 600 }}>
              Reviewed on {new Date(questionnaire.admin_reviewed_at).toLocaleString()}
            </span>
          </div>
        ) : (
          <button
            onClick={markAsReviewed}
            disabled={marking}
            style={{
              padding: "10px 20px",
              background: marking ? "#9e9e9e" : "#2e7d32",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              cursor: marking ? "not-allowed" : "pointer",
            }}
          >
            {marking ? "Marking..." : "Mark as Reviewed"}
          </button>
        )}
      </section>
    </main>
  );
}
