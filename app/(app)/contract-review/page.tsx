"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Contract {
  id: string;
  status: string;
  content?: string;
  client_email: string;
  client_name?: string;
  client_completed_at: string | null;
  client_completion_data?: any;
  admin_reviewed_at: string | null;
  admin_reviewed_by: string | null;
  admin_review_notes?: string;
  created_at: string;
  hunt_id?: string | null;  // NULL means no calendar event created yet
  hunt?: {
    id: string;
    title: string;
    species?: string;
    unit?: string;
    start_time?: string;
    end_time?: string;
    hunt_code?: string;
    guide_username?: string;
    camp_name?: string;
  };
  client_signed_at?: string | null;
}

export default function ContractReviewPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [readyForSignature, setReadyForSignature] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [readyLoading, setReadyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewingContract, setReviewingContract] = useState<string | null>(null);
  const [sendingContractId, setSendingContractId] = useState<string | null>(null);
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [pendingAdminSign, setPendingAdminSign] = useState<Contract[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadContracts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts/pending-review");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load contracts");
      }
      const data = await res.json();
      setContracts(data.contracts || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadReadyForSignature() {
    setReadyLoading(true);
    try {
      const res = await fetch("/api/contracts/ready-for-signature");
      if (res.ok) {
        const data = await res.json();
        setReadyForSignature(data.contracts || []);
      } else {
        setReadyForSignature([]);
      }
    } catch {
      setReadyForSignature([]);
    } finally {
      setReadyLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, readyRes, adminSignRes] = await Promise.all([
        fetch("/api/contracts/pending-review"),
        fetch("/api/contracts/ready-for-signature"),
        fetch("/api/contracts/pending-admin-sign"),
      ]);
      if (!pendingRes.ok) {
        const data = await pendingRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load contracts");
      }
      const pendingData = await pendingRes.json();
      setContracts(pendingData.contracts || []);
      if (readyRes.ok) {
        const readyData = await readyRes.json();
        setReadyForSignature(readyData.contracts || []);
      } else {
        setReadyForSignature([]);
      }
      if (adminSignRes.ok) {
        const adminSignData = await adminSignRes.json();
        setPendingAdminSign(adminSignData.contracts || []);
      } else {
        setPendingAdminSign([]);
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
      setReadyLoading(false);
    }
  }

  async function reviewContract(contractId: string, action: "approve" | "reject") {
    setReviewingContract(contractId);
    try {
      const res = await fetch(`/api/contracts/${contractId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: reviewNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to review contract");
      }

      const data = await res.json();
      const msg = action === "approve"
        ? "Contract approved! You can send it for signature below (Ready to send for signature) or from Calendar."
        : (data.message || "Contract rejected.");
      alert(msg);
      
      await loadAll();
      setReviewNotes("");
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setReviewingContract(null);
    }
  }

  async function sendToDocuSign(contractId: string) {
    setSendingContractId(contractId);
    try {
      const res = await fetch(`/api/hunt-contracts/${contractId}/send-docusign`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || data.hint || "Failed to send to DocuSign");
        return;
      }
      alert(data.docusign?.message || "Contract sent to DocuSign. Client can sign from their Documents page.");
      await loadAll();
    } catch (e: unknown) {
      alert("Failed to send: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSendingContractId(null);
    }
  }

  async function adminSignDocuSign(contractId: string) {
    setSigningContractId(contractId);
    try {
      const res = await fetch(`/api/hunt-contracts/${contractId}/admin-sign-docusign`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to get signing link");
        return;
      }
      if (data.signingUrl) {
        window.open(data.signingUrl, "_blank");
        alert("Signing window opened. After you sign, click Refresh to update the list.");
      } else if (data.mock && data.message) {
        alert(data.message);
        await loadAll();
      } else {
        await loadAll();
      }
    } catch (e: unknown) {
      alert("Failed to open signing: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSigningContractId(null);
    }
  }

  const pendingCount = contracts.length;
  const readyCount = readyForSignature.length;
  const adminSignCount = pendingAdminSign.length;

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Contract Review Queue</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Review and approve client-submitted hunt contracts</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => loadAll()}
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

      {loading ? (
        <p>Loading contracts...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Pending your signature — client signed, outfitter must sign (works even when no calendar event) */}
          {adminSignCount > 0 && (
            <section>
              <div style={{ padding: 12, background: "#e3f2fd", border: "1px solid #2196f3", borderRadius: 8, marginBottom: 12 }}>
                <strong>Pending your signature</strong> — {adminSignCount} contract{adminSignCount !== 1 ? "s" : ""} signed by the client. Sign to complete.
              </div>
              {pendingAdminSign.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #90caf9",
                    borderRadius: 8,
                    padding: 16,
                    background: "#e3f2fd",
                    marginBottom: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 16 }}>
                      {c.hunt?.title || c.hunt?.hunt_code || "Hunt Contract"}
                    </strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, opacity: 0.85 }}>
                      Client: {c.client_name || c.client_email}
                    </p>
                    {c.hunt && (
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, opacity: 0.75 }}>
                        {c.hunt.species && <span>{c.hunt.species}</span>}
                        {c.hunt.unit && <span> · Unit {c.hunt.unit}</span>}
                        {c.hunt.hunt_code && <span> · {c.hunt.hunt_code}</span>}
                      </p>
                    )}
                    {c.client_signed_at && (
                      <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.7 }}>
                        Client signed: {new Date(c.client_signed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => adminSignDocuSign(c.id)}
                    disabled={signingContractId === c.id}
                    style={{
                      padding: "10px 20px",
                      background: signingContractId === c.id ? "#999" : "#1976d2",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      cursor: signingContractId === c.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {signingContractId === c.id ? "Opening…" : "Sign (DocuSign)"}
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* Ready to send for signature — send to DocuSign from here (works even when no calendar event) */}
          {readyCount > 0 && (
            <section>
              <div style={{ padding: 12, background: "#e8f5e9", border: "1px solid #4caf50", borderRadius: 8, marginBottom: 12 }}>
                <strong>Ready to send for signature</strong> — {readyCount} contract{readyCount !== 1 ? "s" : ""} approved. Send to DocuSign so the client can sign.
              </div>
              {readyForSignature.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #c8e6c9",
                    borderRadius: 8,
                    padding: 16,
                    background: "#f1f8e9",
                    marginBottom: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 16 }}>
                      {c.hunt?.title || c.hunt?.hunt_code || "Hunt Contract"}
                    </strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, opacity: 0.85 }}>
                      Client: {c.client_name || c.client_email}
                    </p>
                    {c.hunt && (
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, opacity: 0.75 }}>
                        {c.hunt.species && <span>{c.hunt.species}</span>}
                        {c.hunt.unit && <span> · Unit {c.hunt.unit}</span>}
                        {c.hunt.hunt_code && <span> · {c.hunt.hunt_code}</span>}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => sendToDocuSign(c.id)}
                    disabled={sendingContractId === c.id}
                    style={{
                      padding: "10px 20px",
                      background: sendingContractId === c.id ? "#999" : "#1a472a",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      cursor: sendingContractId === c.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {sendingContractId === c.id ? "Sending…" : "Send to DocuSign"}
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* Pending review */}
          {pendingCount === 0 && readyCount === 0 && adminSignCount === 0 ? (
            <div style={{ textAlign: "center", padding: 48, background: "#f9f9f9", borderRadius: 8 }}>
              <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>
                ✅ No contracts pending review
              </p>
              <p style={{ fontSize: 14, marginTop: 8, opacity: 0.6 }}>
                All submitted contracts have been reviewed. New submissions will appear here.
              </p>
            </div>
          ) : null}

          {pendingCount > 0 && (
            <>
              <div style={{ padding: 12, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8 }}>
                <strong>{pendingCount}</strong> contract{pendingCount !== 1 ? "s" : ""} pending review
              </div>

              {contracts.map((contract) => (
            <div
              key={contract.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 20,
                background: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>
                    {contract.hunt?.title || "Hunt Contract"}
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, opacity: 0.7 }}>
                    Client: <strong>{contract.client_name || contract.client_email}</strong>
                  </p>
                  {contract.hunt && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14 }}>
                      {contract.hunt.species && <span>🦌 {contract.hunt.species}</span>}
                      {contract.hunt.unit && <span>📍 Unit {contract.hunt.unit}</span>}
                      {contract.hunt.guide_username && <span>👤 Guide: {contract.hunt.guide_username}</span>}
                      {contract.hunt.start_time && (
                        <span>
                          📅 {new Date(contract.hunt.start_time).toLocaleDateString()}
                          {contract.hunt.end_time && ` - ${new Date(contract.hunt.end_time).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                  )}
                  <p style={{ margin: "8px 0 0 0", fontSize: 12, opacity: 0.6 }}>
                    Submitted: {contract.client_completed_at 
                      ? new Date(contract.client_completed_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#ff9500",
                    color: "white",
                  }}
                >
                  PENDING REVIEW
                </span>
              </div>

              {/* Contract Content Preview */}
              {contract.content && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    background: "#f9fafb",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    maxHeight: 300,
                    overflow: "auto",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      color: "#333",
                    }}
                    dangerouslySetInnerHTML={{ __html: contract.content.replace(/\n/g, "<br />") }}
                  />
                </div>
              )}

              {/* Client Completion Data */}
              {contract.client_completion_data && (
                <div style={{ marginTop: 16 }}>
                  <strong style={{ fontSize: 14 }}>Client Submission Details:</strong>
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: "#f0f0f0",
                      borderRadius: 4,
                      fontSize: 12,
                      overflow: "auto",
                      maxHeight: 200,
                    }}
                  >
                    {JSON.stringify(contract.client_completion_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Review Notes Input */}
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
                  Review Notes (optional):
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this review..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Calendar Event Status */}
              {!contract.hunt_id && (
                <div style={{ marginTop: 16, padding: 12, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    ⚠️ No calendar event created yet
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.8 }}>
                    After approving this contract, you'll need to manually create a calendar event for this hunt.
                    The hunt will not appear in the calendar until you add it.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  onClick={() => reviewContract(contract.id, "approve")}
                  disabled={reviewingContract === contract.id}
                  style={{
                    padding: "10px 20px",
                    background: reviewingContract === contract.id ? "#ccc" : "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: reviewingContract === contract.id ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
                  {reviewingContract === contract.id ? "Processing..." : "✓ Approve"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to reject this contract? The client will need to resubmit.")) {
                      reviewContract(contract.id, "reject");
                    }
                  }}
                  disabled={reviewingContract === contract.id}
                  style={{
                    padding: "10px 20px",
                    background: reviewingContract === contract.id ? "#ccc" : "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: reviewingContract === contract.id ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
                  {reviewingContract === contract.id ? "Processing..." : "✗ Reject"}
                </button>
              </div>
            </div>
          ))}
            </>
          )}
        </div>
      )}
    </main>
  );
}
