"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Client {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  camp_name?: string;
  species?: string;
  unit?: string;
  status?: string;
  guide_username?: string;
}

interface Document {
  id: string;
  storage_path?: string | null;
  linked_type?: string | null;
  linked_id?: string | null;
  created_at?: string | null;
  document_type: "contract" | "waiver" | "questionnaire" | "predraw" | "other";
  status: string;
  client_signed_at?: string | null;
  admin_signed_at?: string | null;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  predraw: "Pre-Draw Contract",
  questionnaire: "Pre-Hunt Questionnaire",
  waiver: "Waiver / Liability",
  contract: "Hunt Contract",
  other: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not submitted",
  submitted: "Submitted",
  client_signed: "Client signed",
  admin_signed: "Reviewed ✓",
  fully_executed: "Fully executed ✓",
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const email = decodeURIComponent(params.email as string);

  const [client, setClient] = useState<Client | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [huntContracts, setHuntContracts] = useState<Array<{
    id: string;
    status: string;
    hunt_id: string | null;
    created_at: string;
    client_signed_at: string | null;
    admin_signed_at: string | null;
    contract_total_cents?: number | null;
    amount_paid_cents?: number | null;
    remaining_balance_cents?: number | null;
    payment_status?: string | null;
  }>>([]);
  const [contractPayments, setContractPayments] = useState<Record<string, any>>({});
  const [editingContractTotal, setEditingContractTotal] = useState<string | null>(null);
  const [newContractTotal, setNewContractTotal] = useState<string>("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminSigningId, setAdminSigningId] = useState<string | null>(null);

  useEffect(() => {
    loadClientData();
  }, [email]);

  async function loadClientData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(email)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load client");
      }
      const data = await res.json();
      setClient(data.client);
      setCalendarEvents(data.calendarEvents || []);
      setHuntContracts(data.huntContracts || []);
      setDocuments(data.documents || []);
      
      // Load payment info for each contract
      const paymentData: Record<string, any> = {};
      for (const contract of data.huntContracts || []) {
        try {
          const paymentRes = await fetch(`/api/hunt-contracts/${contract.id}/payments`);
          if (paymentRes.ok) {
            const paymentInfo = await paymentRes.json();
            paymentData[contract.id] = paymentInfo;
          }
        } catch (e) {
          console.error(`Error loading payment info for contract ${contract.id}:`, e);
        }
      }
      setContractPayments(paymentData);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function getClientName(): string {
    if (!client) return email;
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return email;
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }

  async function adminSign(docId: string) {
    if (adminSigningId) return;
    setAdminSigningId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/admin-sign`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Admin sign failed");
      await loadClientData();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setAdminSigningId(null);
    }
  }

  function canAdminSign(doc: Document): boolean {
    if (doc.id.startsWith("placeholder-") || !doc.storage_path) return false;
    return ["submitted", "client_signed", "admin_signed"].includes(doc.status);
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
        <p>Loading client details...</p>
      </main>
    );
  }

  if (error || !client) {
    return (
      <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error || "Client not found"}
        </div>
        <Link href="/clients" style={{ color: "#0070f3" }}>
          ← Back to Clients
        </Link>
      </main>
    );
  }

  const upcomingHunts = calendarEvents.filter((e) => {
    const endDate = new Date(e.end_time);
    return endDate >= new Date();
  });

  const pastHunts = calendarEvents.filter((e) => {
    const endDate = new Date(e.end_time);
    return endDate < new Date();
  });

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/clients"
          style={{
            color: "#0070f3",
            textDecoration: "none",
            marginBottom: 16,
            display: "inline-block",
          }}
        >
          ← Back to Clients
        </Link>
        <h1 style={{ margin: "8px 0" }}>{getClientName()}</h1>
        <p style={{ marginTop: 6, opacity: 0.75, fontSize: 16 }}>{email}</p>
      </div>

      {/* Client Info Section */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>Client Information</h2>
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 20,
            background: "#fafafa",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, marginBottom: 12 }}>
            <strong>Name:</strong>
            <span>{getClientName()}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, marginBottom: 12 }}>
            <strong>Email:</strong>
            <span>{email}</span>
          </div>
          {client.phone && (
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, marginBottom: 12 }}>
              <strong>Phone:</strong>
              <span>{client.phone}</span>
            </div>
          )}
          {(client.address_line1 || client.city || client.state || client.postal_code) && (
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, marginBottom: 12 }}>
              <strong>Address:</strong>
              <span>
                {[
                  client.address_line1,
                  client.city,
                  client.state,
                  client.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Hunts */}
      {upcomingHunts.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>Upcoming Hunts</h2>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Hunt</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Dates</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Species/Unit</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Guide</th>
                </tr>
              </thead>
              <tbody>
                {upcomingHunts.map((hunt) => (
                  <tr key={hunt.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 12 }}>
                      <strong>{hunt.title}</strong>
                      {hunt.camp_name && (
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                          {hunt.camp_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {formatDate(hunt.start_time)} - {formatDate(hunt.end_time)}
                    </td>
                    <td style={{ padding: 12 }}>
                      {hunt.species && <div>{hunt.species}</div>}
                      {hunt.unit && <div style={{ fontSize: 12, color: "#666" }}>Unit {hunt.unit}</div>}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          background: "#e3f2fd",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {hunt.status || "Inquiry"}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      {hunt.guide_username || <span style={{ color: "#999" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Past Hunts */}
      {pastHunts.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>Hunt History</h2>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Hunt</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Dates</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Species/Unit</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Guide</th>
                </tr>
              </thead>
              <tbody>
                {pastHunts.map((hunt) => (
                  <tr key={hunt.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 12 }}>
                      <strong>{hunt.title}</strong>
                      {hunt.camp_name && (
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                          {hunt.camp_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {formatDate(hunt.start_time)} - {formatDate(hunt.end_time)}
                    </td>
                    <td style={{ padding: 12 }}>
                      {hunt.species && <div>{hunt.species}</div>}
                      {hunt.unit && <div style={{ fontSize: 12, color: "#666" }}>Unit {hunt.unit}</div>}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          background: "#e8f5e9",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {hunt.status || "Completed"}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      {hunt.guide_username || <span style={{ color: "#999" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Hunt Contracts Section */}
      {huntContracts.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: 20, fontWeight: 600 }}>Hunt Contracts</h2>
              <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>
                All hunt contracts for this client. Assign to calendar to create calendar events.
              </p>
            </div>
            {(() => {
              const totalOwedCents = huntContracts.reduce((sum, c) => sum + (c.remaining_balance_cents || 0), 0);
              if (totalOwedCents > 0) {
                return (
                  <div
                    style={{
                      padding: "16px 24px",
                      background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
                      borderRadius: 8,
                      color: "white",
                      textAlign: "right",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>Total Amount Owed Across All Contracts</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>${(totalOwedCents / 100).toLocaleString()}</div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Contract ID</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Payment Status</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Paid</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Remaining</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Created</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {huntContracts.map((contract) => {
                  const paymentInfo = contractPayments[contract.id];
                  const totalCents = contract.contract_total_cents || 0;
                  const paidCents = contract.amount_paid_cents || 0;
                  const remainingCents = contract.remaining_balance_cents || 0;
                  const paymentStatus = contract.payment_status || "unpaid";
                  
                  const getPaymentStatusColor = (status: string) => {
                    switch (status) {
                      case "paid_in_full": return "#e8f5e9";
                      case "deposit_paid": return "#fff3cd";
                      case "payment_plan_active": return "#e3f2fd";
                      case "unpaid": return "#ffebee";
                      default: return "#f5f5f5";
                    }
                  };
                  
                  const getPaymentStatusLabel = (status: string) => {
                    switch (status) {
                      case "paid_in_full": return "Paid in Full";
                      case "deposit_paid": return "Deposit Paid";
                      case "payment_plan_active": return "Payment Plan Active";
                      case "unpaid": return "Unpaid";
                      default: return status;
                    }
                  };
                  
                  return (
                    <tr key={contract.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: 12 }}>
                        <code style={{ fontSize: 12 }}>{contract.id.slice(0, 8)}...</code>
                      </td>
                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            background: contract.status === "fully_executed" ? "#e8f5e9" : "#fff3cd",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          {contract.status}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            background: getPaymentStatusColor(paymentStatus),
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          {getPaymentStatusLabel(paymentStatus)}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>
                        {totalCents > 0 ? `$${(totalCents / 100).toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding: 12 }}>
                        {paidCents > 0 ? `$${(paidCents / 100).toFixed(2)}` : "$0.00"}
                      </td>
                      <td style={{ padding: 12 }}>
                        {remainingCents > 0 ? (
                          <span style={{ color: "#d32f2f", fontWeight: 600 }}>
                            ${(remainingCents / 100).toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ color: "#2e7d32" }}>$0.00</span>
                        )}
                      </td>
                      <td style={{ padding: 12 }}>
                        {formatDate(contract.created_at)}
                      </td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {!contract.hunt_id ? (
                            <Link
                              href={`/calendar?assign_contract=${contract.id}`}
                              style={{
                                padding: "6px 12px",
                                background: "#0070f3",
                                color: "white",
                                textDecoration: "none",
                                borderRadius: 6,
                                fontSize: 14,
                                display: "inline-block",
                              }}
                            >
                              Assign
                            </Link>
                          ) : (
                            <Link
                              href={`/calendar?event=${contract.hunt_id}`}
                              style={{
                                padding: "6px 12px",
                                background: "#666",
                                color: "white",
                                textDecoration: "none",
                                borderRadius: 6,
                                fontSize: 14,
                                display: "inline-block",
                              }}
                            >
                              View Event
                            </Link>
                          )}
                          <Link
                            href={`/hunt-contracts/${contract.id}/payments`}
                            style={{
                              padding: "6px 12px",
                              background: "#4caf50",
                              color: "white",
                              textDecoration: "none",
                              borderRadius: 6,
                              fontSize: 14,
                              display: "inline-block",
                            }}
                          >
                            View Payments
                          </Link>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/hunt-contracts/${contract.id}`);
                                if (!res.ok) throw new Error("Failed to load contract");
                                const contractData = await res.json();
                                const printWindow = window.open("", "_blank");
                                if (printWindow) {
                                  printWindow.document.write(`
                                    <!DOCTYPE html>
                                    <html>
                                      <head>
                                        <title>Hunt Contract - ${contract.id.slice(0, 8)}</title>
                                        <style>
                                          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                                          @media print { body { padding: 20px; } }
                                          .header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #000; }
                                          .section { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
                                          .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0; }
                                          .detail-grid { display: grid; grid-template-columns: 150px 1fr; gap: 12px 16px; font-size: 11px; }
                                          .detail-label { font-weight: 600; color: #666; }
                                          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 9px; color: #999; }
                                        </style>
                                      </head>
                                      <body>
                                        <div class="header">
                                          <h1 style="font-size: 32px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: 1px;">HUNT CONTRACT</h1>
                                          <p style="font-size: 14px; font-weight: 500; color: #666; margin: 0;">Agreement for Guided Hunting Services</p>
                                        </div>
                                        <div class="section">
                                          <div class="section-title">CONTRACT INFORMATION</div>
                                          <div class="detail-grid">
                                            <div class="detail-label">Contract ID:</div>
                                            <div>${contract.id.slice(0, 8).toUpperCase()}</div>
                                            <div class="detail-label">Date Created:</div>
                                            <div>${contract.created_at ? new Date(contract.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Not set"}</div>
                                            <div class="detail-label">Status:</div>
                                            <div>${contract.status.replace(/_/g, " ").replace(/\\b\\w/g, (l: string) => l.toUpperCase())}</div>
                                          </div>
                                        </div>
                                        <div class="section">
                                          <div class="section-title">CLIENT INFORMATION</div>
                                          <div class="detail-grid">
                                            <div class="detail-label">Client:</div>
                                            <div>${client?.name || client?.email || "Unknown"}</div>
                                            <div class="detail-label">Email:</div>
                                            <div>${client?.email || "Not set"}</div>
                                          </div>
                                        </div>
                                        ${contractData.hunt ? `
                                        <div class="section">
                                          <div class="section-title">HUNT DETAILS</div>
                                          <div class="detail-grid">
                                            ${contractData.hunt.species ? `<div class="detail-label">Species:</div><div>${contractData.hunt.species}</div>` : ""}
                                            ${contractData.hunt.unit ? `<div class="detail-label">Unit:</div><div>${contractData.hunt.unit}</div>` : ""}
                                          </div>
                                        </div>
                                        ` : ""}
                                        <div class="section">
                                          <div class="section-title">TERMS & CONDITIONS</div>
                                          <div style="font-size: 11px; line-height: 1.6; color: #333; white-space: pre-wrap; font-family: inherit;">
                                            ${contractData.content || "Contract text is not available."}
                                          </div>
                                        </div>
                                        <div class="footer">
                                          <p style="margin: 8px 0;">This contract is a legally binding agreement between the client and outfitter.</p>
                                          <p style="margin: 0;">Generated on ${new Date().toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                                        </div>
                                      </body>
                                    </html>
                                  `);
                                  printWindow.document.close();
                                  printWindow.focus();
                                  setTimeout(() => {
                                    printWindow.print();
                                  }, 250);
                                }
                              } catch (e) {
                                alert("Failed to load contract for printing");
                              }
                            }}
                            style={{
                              padding: "6px 12px",
                              background: "#1a472a",
                              color: "white",
                              border: "none",
                              borderRadius: 6,
                              fontSize: 14,
                              cursor: "pointer",
                              marginLeft: 8,
                            }}
                          >
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Documents Section */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>Documents & Forms</h2>
        <p style={{ marginBottom: 16, opacity: 0.8, fontSize: 14 }}>
          Contract(s), Waiver / liability, Questionnaire, and other required client docs. Status: Not submitted → Submitted → Signed → Fully executed.
        </p>
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Document type</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Status</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>View / Download</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Admin sign</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const isPlaceholder = doc.id.startsWith("placeholder-") || !doc.storage_path;
                const timestamp =
                  doc.admin_signed_at || doc.client_signed_at || doc.created_at
                    ? formatDate(
                        (doc.admin_signed_at || doc.client_signed_at || doc.created_at) as string
                      )
                    : "—";
                const showAdminSign = canAdminSign(doc);
                const signing = adminSigningId === doc.id;
                return (
                  <tr key={doc.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 12 }}>
                      {DOC_TYPE_LABEL[doc.document_type] || doc.document_type}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          background:
                            doc.status === "fully_executed" || doc.status === "admin_signed"
                              ? "#e8f5e9"
                              : doc.status === "not_submitted"
                                ? "#fff3e0"
                                : "#e3f2fd",
                          color:
                            doc.status === "fully_executed" || doc.status === "admin_signed"
                              ? "#2e7d32"
                              : undefined,
                          fontWeight:
                            doc.status === "fully_executed" || doc.status === "admin_signed"
                              ? 600
                              : undefined,
                        }}
                      >
                        {STATUS_LABEL[doc.status] || doc.status}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>{timestamp}</td>
                    <td style={{ padding: 12 }}>
                      {doc.document_type === "questionnaire" && doc.status !== "not_submitted" ? (
                        <Link
                          href={`/clients/${encodeURIComponent(email)}/questionnaire`}
                          style={{
                            padding: "6px 12px",
                            background: "#0070f3",
                            color: "white",
                            textDecoration: "none",
                            borderRadius: 6,
                            fontSize: 14,
                            display: "inline-block",
                          }}
                        >
                          View Details
                        </Link>
                      ) : doc.document_type === "predraw" && doc.status !== "not_submitted" ? (
                        <Link
                          href={`/clients/${encodeURIComponent(email)}/predraw`}
                          style={{
                            padding: "6px 12px",
                            background: "#0070f3",
                            color: "white",
                            textDecoration: "none",
                            borderRadius: 6,
                            fontSize: 14,
                            display: "inline-block",
                          }}
                        >
                          View Details
                        </Link>
                      ) : doc.document_type === "waiver" && doc.status !== "not_submitted" ? (
                        <Link
                          href={`/clients/${encodeURIComponent(email)}/waiver`}
                          style={{
                            padding: "6px 12px",
                            background: "#0070f3",
                            color: "white",
                            textDecoration: "none",
                            borderRadius: 6,
                            fontSize: 14,
                            display: "inline-block",
                          }}
                        >
                          View Details
                        </Link>
                      ) : !isPlaceholder && doc.storage_path ? (
                        <a
                          href={`/api/documents/${doc.id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "6px 12px",
                            background: "#0070f3",
                            color: "white",
                            textDecoration: "none",
                            borderRadius: 6,
                            fontSize: 14,
                            display: "inline-block",
                          }}
                        >
                          View / Download
                        </a>
                      ) : (
                        <span style={{ color: "#999", fontSize: 12 }}>
                          {doc.status === "not_submitted" ? "—" : "No file available"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {showAdminSign ? (
                        <button
                          type="button"
                          onClick={() => adminSign(doc.id)}
                          disabled={!!adminSigningId}
                          style={{
                            padding: "6px 12px",
                            background: "#2e7d32",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 14,
                            cursor: adminSigningId ? "not-allowed" : "pointer",
                          }}
                        >
                          {signing ? "Signing…" : "Countersign"}
                        </button>
                      ) : (
                        <span style={{ color: "#999", fontSize: 12 }}>
                          {doc.status === "fully_executed" ? "Done" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {documents.length === 0 && (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 20,
              background: "#fafafa",
              textAlign: "center",
              color: "#666",
              marginTop: 16,
            }}
          >
            <p>No documents tracked for this client yet.</p>
          </div>
        )}
      </section>

      {calendarEvents.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: "#666" }}>
          <p>No hunt history found for this client.</p>
        </div>
      )}
    </main>
  );
}
