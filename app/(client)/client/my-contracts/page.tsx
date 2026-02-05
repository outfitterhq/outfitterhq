"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Contract {
  id: string;
  status: string;
  hunt_id: string | null;
  created_at: string;
  contract_total_cents: number | null;
  amount_paid_cents: number | null;
  remaining_balance_cents: number | null;
  payment_status: string | null;
  client_email: string;
}

interface PaymentInfo {
  contract: {
    contract_total_usd: number;
    amount_paid_usd: number;
    remaining_balance_usd: number;
    payment_percentage: number;
    payment_status: string;
  };
  paymentPlan: any;
  scheduledPayments: Array<{
    id: string;
    payment_number: number;
    amount_usd: number;
    due_date: string;
    status: string;
    is_overdue: boolean;
  }>;
}

export default function MyContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<Record<string, PaymentInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalOwed, setTotalOwed] = useState(0);

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    try {
      setLoading(true);
      setError(null);

      // Get contracts for this client (API handles auth)
      const contractsRes = await fetch(`/api/client/hunt-contracts`, {
        credentials: "include", // Include cookies for auth
      });
      if (!contractsRes.ok) {
        const errorData = await contractsRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load contracts");
      }
      const contractsData = await contractsRes.json();
      setContracts(contractsData.contracts || []);

      // Load payment info for each contract
      const paymentData: Record<string, PaymentInfo> = {};
      let total = 0;

      for (const contract of contractsData.contracts || []) {
        try {
          const paymentRes = await fetch(`/api/hunt-contracts/${contract.id}/payments`, {
            credentials: "include", // Include cookies for auth
          });
          if (paymentRes.ok) {
            const payment = await paymentRes.json();
            paymentData[contract.id] = payment;
            total += payment.contract.remaining_balance_usd || 0;
          } else {
            console.error(`Failed to load payment for contract ${contract.id}:`, paymentRes.status);
          }
        } catch (e) {
          console.error(`Error loading payment for contract ${contract.id}:`, e);
        }
      }

      setPaymentInfo(paymentData);
      setTotalOwed(total);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: "48px auto", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <p>Loading your contracts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1000, margin: "48px auto", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Error</h2>
        <p style={{ color: "#666", marginBottom: 24 }}>{error}</p>
        <button
          onClick={loadContracts}
          style={{
            padding: "12px 24px",
            background: "#1a472a",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "48px auto", padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>My Contracts</h1>
        <p style={{ color: "#666", fontSize: 16 }}>
          View your hunt contracts and payment status
        </p>
      </div>

      {/* Total Owed Summary */}
      {totalOwed > 0 && (
        <div
          style={{
            padding: "24px 28px",
            background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
            borderRadius: 12,
            color: "white",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Total Amount Owed
              </h2>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 800 }}>
                ${totalOwed.toFixed(2)}
              </p>
            </div>
            <Link
              href="/client/pay"
              style={{
                padding: "14px 28px",
                background: "white",
                color: "#1a472a",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              Make Payment
            </Link>
          </div>
        </div>
      )}

      {/* Contracts List */}
      {contracts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "white", borderRadius: 12, border: "1px solid #ddd" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No Contracts Yet</h3>
          <p style={{ color: "#666" }}>When you have a confirmed hunt, your contract will appear here.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {contracts.map((contract) => {
            const payment = paymentInfo[contract.id];
            const status = payment?.contract.payment_status || contract.payment_status || "unpaid";
            const total = payment?.contract.contract_total_usd || (contract.contract_total_cents || 0) / 100;
            const paid = payment?.contract.amount_paid_usd || (contract.amount_paid_cents || 0) / 100;
            const remaining = payment?.contract.remaining_balance_usd || (contract.remaining_balance_cents || 0) / 100;
            const percentage = payment?.contract.payment_percentage || 0;

            return (
              <div
                key={contract.id}
                style={{
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 24,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                      Contract #{contract.id.slice(0, 8)}
                    </h3>
                    <p style={{ color: "#666", fontSize: 14, marginBottom: 4 }}>
                      Created: {new Date(contract.created_at).toLocaleDateString()}
                    </p>
                    <p style={{ color: "#666", fontSize: 14 }}>
                      Status: <span style={{ textTransform: "capitalize" }}>{contract.status.replace(/_/g, " ")}</span>
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "8px 16px",
                      background: getPaymentStatusColor(status),
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {getPaymentStatusLabel(status)}
                  </span>
                </div>

                {/* Payment Summary */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Contract Total</p>
                      <p style={{ fontSize: 20, fontWeight: 700 }}>
                        {total > 0 ? `$${total.toFixed(2)}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Amount Paid</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: "#2e7d32" }}>
                        ${paid.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Remaining</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: remaining > 0 ? "#d32f2f" : "#2e7d32" }}>
                        ${remaining.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {total > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Payment Progress</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{percentage.toFixed(1)}%</span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: 8,
                          background: "#e0e0e0",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, percentage)}%`,
                            height: "100%",
                            background: percentage >= 100 ? "#2e7d32" : "#1a472a",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Scheduled Payments */}
                {payment?.scheduledPayments && payment.scheduledPayments.length > 0 && (
                  <div style={{ marginBottom: 20, padding: 16, background: "#f9f9f9", borderRadius: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Upcoming Payments</h4>
                    <div style={{ display: "grid", gap: 8 }}>
                      {payment.scheduledPayments
                        .filter((sp: any) => sp.status !== "paid")
                        .map((sp: any) => (
                          <div
                            key={sp.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 12px",
                              background: sp.is_overdue ? "#ffebee" : "white",
                              borderRadius: 6,
                              border: sp.is_overdue ? "1px solid #d32f2f" : "1px solid #ddd",
                            }}
                          >
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                                Payment #{sp.payment_number}
                              </p>
                              <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0 0" }}>
                                Due: {new Date(sp.due_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                                ${sp.amount_usd.toFixed(2)}
                              </p>
                              {sp.is_overdue && (
                                <p style={{ fontSize: 11, color: "#d32f2f", margin: "4px 0 0 0", fontWeight: 600 }}>
                                  Overdue
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 12 }}>
                  {remaining > 0 && (
                    <Link
                      href={`/client/pay?contract_id=${contract.id}`}
                      style={{
                        padding: "10px 20px",
                        background: "#1a472a",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Make Payment
                    </Link>
                  )}
                  <Link
                    href={`/client/documents/hunt-contract?contract_id=${contract.id}`}
                    style={{
                      padding: "10px 20px",
                      background: "#f0f0f0",
                      color: "#333",
                      textDecoration: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    View Contract
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
