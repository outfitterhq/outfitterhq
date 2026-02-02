"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface PacketData {
  hunt: { id: string; title: string; start_time?: string; end_time?: string; species?: string; unit?: string; client_email?: string };
  contract: { id: string; status: string; content?: string } | null;
  questionnaire: Record<string, unknown> | null;
  guide_documents: Array<{ id: string; title: string; file_name?: string }>;
}

export default function GuidePacketPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [data, setData] = useState<PacketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/guide/hunts/${id}/packet`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to load packet: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function downloadText(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!id) {
    return (
      <div>
        <p>Invalid hunt.</p>
        <Link href="/guide/schedule" style={{ color: "#059669", fontWeight: 600 }}>← Back to Schedule</Link>
      </div>
    );
  }
  if (loading) {
    return <p>Loading hunt packet…</p>;
  }
  if (error) {
    return (
      <div>
        <p style={{ color: "#dc2626" }}>{error}</p>
        <Link href="/guide/schedule" style={{ color: "#059669", fontWeight: 600 }}>← Back to Schedule</Link>
      </div>
    );
  }
  if (!data) {
    return <p>No packet data.</p>;
  }

  const { hunt, contract, questionnaire, guide_documents } = data;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/guide/schedule" style={{ color: "#059669", fontWeight: 600, marginBottom: 8, display: "inline-block" }}>← Back to Schedule</Link>
        <h1 style={{ margin: "0 0 4px 0", fontSize: 24, fontWeight: 700 }}>Hunt Packet</h1>
        <p style={{ margin: 0, color: "#666" }}>{hunt.title}</p>
        {hunt.start_time && (
          <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#666" }}>
            {new Date(hunt.start_time).toLocaleDateString()} – {hunt.end_time ? new Date(hunt.end_time).toLocaleDateString() : "—"}
            {hunt.species && ` · ${hunt.species}`}
            {hunt.unit && ` · Unit ${hunt.unit}`}
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Hunt Contract */}
        <section style={{ background: "white", border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>Hunt Contract</h2>
          {contract?.content ? (
            <>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, margin: "0 0 12px 0", padding: 12, background: "#f9f9f9", borderRadius: 8, maxHeight: 300, overflow: "auto" }}>
                {contract.content}
              </pre>
              <button
                type="button"
                onClick={() => downloadText("Hunt_Contract.txt", contract.content!)}
                style={{ padding: "8px 16px", background: "#059669", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
              >
                Download Contract (.txt)
              </button>
            </>
          ) : (
            <p style={{ margin: 0, color: "#666" }}>No contract generated for this hunt yet.</p>
          )}
        </section>

        {/* Client Questionnaire */}
        <section style={{ background: "white", border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>Client Questionnaire</h2>
          {questionnaire ? (
            <>
              <div style={{ fontSize: 14, marginBottom: 12 }}>
                <p><strong>Name:</strong> {(questionnaire.full_name as string) ?? (questionnaire.email as string) ?? "—"}</p>
                <p><strong>Email:</strong> {(questionnaire.email as string) ?? "—"}</p>
                <p><strong>Phone:</strong> {(questionnaire.contact_phone as string) ?? "—"}</p>
                <p><strong>Emergency:</strong> {(questionnaire.emergency_contact_name as string) ?? "—"} {(questionnaire.emergency_contact_phone as string) ?? ""}</p>
                <p><strong>Food allergies:</strong> {(questionnaire.food_allergies as string) ?? "—"}</p>
                <p><strong>Food preferences:</strong> {(questionnaire.food_preferences as string) ?? "—"}</p>
                <p><strong>Physical limitations:</strong> {(questionnaire.physical_limitations as string) ?? "—"}</p>
                <p><strong>Health concerns:</strong> {(questionnaire.health_concerns as string) ?? "—"}</p>
                <p><strong>Notes:</strong> {(questionnaire.general_notes as string) ?? "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const lines = [
                    "CLIENT QUESTIONNAIRE",
                    "Client: " + ((questionnaire.full_name as string) ?? (questionnaire.email as string) ?? "—"),
                    "Email: " + ((questionnaire.email as string) ?? "—"),
                    "Phone: " + ((questionnaire.contact_phone as string) ?? "—"),
                    "Emergency: " + (questionnaire.emergency_contact_name as string) + " " + (questionnaire.emergency_contact_phone as string),
                    "Food allergies: " + (questionnaire.food_allergies as string),
                    "Food preferences: " + (questionnaire.food_preferences as string),
                    "Physical limitations: " + (questionnaire.physical_limitations as string),
                    "Health concerns: " + (questionnaire.health_concerns as string),
                    "Notes: " + (questionnaire.general_notes as string),
                  ];
                  downloadText("Client_Questionnaire.txt", lines.join("\n"));
                }}
                style={{ padding: "8px 16px", background: "#059669", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
              >
                Download Questionnaire (.txt)
              </button>
            </>
          ) : (
            <p style={{ margin: 0, color: "#666" }}>No client questionnaire submitted for this hunt.</p>
          )}
        </section>

        {/* Guide Documents */}
        <section style={{ background: "white", border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>Your Guide Documents</h2>
          {guide_documents.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {guide_documents.map((doc) => (
                <li key={doc.id} style={{ marginBottom: 8 }}>
                  <a
                    href={`/api/guide/documents/${doc.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#059669", fontWeight: 600 }}
                  >
                    {doc.title} ({doc.file_name || "file"}) — Download
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "#666" }}>No guide documents uploaded. Add documents in Documents.</p>
          )}
        </section>
      </div>
    </div>
  );
}
