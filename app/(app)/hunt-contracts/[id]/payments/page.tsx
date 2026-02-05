"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PaymentData {
  contract: {
    id: string;
    contract_total_usd: number;
    amount_paid_usd: number;
    remaining_balance_usd: number;
    payment_percentage: number;
    payment_status: string;
  };
  paymentItems: Array<{
    id: string;
    description: string;
    total_cents: number;
    amount_paid_cents: number;
    status: string;
    due_date: string | null;
    created_at: string;
  }>;
  paymentPlan: any;
  scheduledPayments: Array<{
    id: string;
    payment_number: number;
    amount_usd: number;
    due_date: string;
    status: string;
    is_overdue: boolean;
  }>;
  transactions: any[];
}

export default function ContractPaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;

  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentData();
  }, [contractId]);

  async function loadPaymentData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/hunt-contracts/${contractId}/payments`);
      if (!res.ok) {
        throw new Error("Failed to load payment data");
      }
      const paymentData = await res.json();
      setData(paymentData);
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
        <p>Loading payment information...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 1000, margin: "48px auto", padding: 32, textAlign: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Error</h2>
        <p style={{ color: "#666", marginBottom: 24 }}>{error || "Failed to load payment data"}</p>
        <button
          onClick={() => router.back()}
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
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "48px auto", padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <Link
          href="/clients"
          style={{
            color: "#666",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 16,
            display: "inline-block",
          }}
        >
          ← Back to Clients
        </Link>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginTop: 16 }}>Contract Payments</h1>
        <p style={{ color: "#666", fontSize: 16, marginTop: 8 }}>
          Contract ID: {contractId.slice(0, 8)}...
        </p>
      </div>

      {/* Payment Summary */}
      <div
        style={{
          background: "white",
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Payment Summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              <div>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Contract Total</p>
                <p style={{ fontSize: 24, fontWeight: 700 }}>
                  ${data.contract.contract_total_usd.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Amount Paid</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "#2e7d32" }}>
                  ${data.contract.amount_paid_usd.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Remaining Balance</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: data.contract.remaining_balance_usd > 0 ? "#d32f2f" : "#2e7d32" }}>
                  ${data.contract.remaining_balance_usd.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <span
            style={{
              padding: "8px 16px",
              background: getPaymentStatusColor(data.contract.payment_status),
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {getPaymentStatusLabel(data.contract.payment_status)}
          </span>
        </div>

        {/* Progress Bar */}
        {data.contract.contract_total_usd > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Payment Progress</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{data.contract.payment_percentage.toFixed(1)}%</span>
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
                  width: `${Math.min(100, data.contract.payment_percentage)}%`,
                  height: "100%",
                  background: data.contract.payment_percentage >= 100 ? "#2e7d32" : "#1a472a",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Payment Items */}
      <div
        style={{
          background: "white",
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Payment Items</h2>
        {data.paymentItems.length === 0 ? (
          <p style={{ color: "#666" }}>No payment items found.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {data.paymentItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  background: "#f9f9f9",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{item.description}</p>
                    <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                      Created: {new Date(item.created_at).toLocaleDateString()}
                    </p>
                    {item.due_date && (
                      <p style={{ fontSize: 12, color: "#666" }}>
                        Due: {new Date(item.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                      ${(item.total_cents / 100).toFixed(2)}
                    </p>
                    <span
                      style={{
                        padding: "4px 12px",
                        background: item.status === "paid" ? "#e8f5e9" : "#fff3cd",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {item.status === "paid" ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
                {item.amount_paid_cents > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #ddd" }}>
                    <p style={{ fontSize: 12, color: "#666" }}>
                      Paid: ${(item.amount_paid_cents / 100).toFixed(2)} of ${(item.total_cents / 100).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled Payments */}
      {data.scheduledPayments.length > 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Scheduled Payments</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {data.scheduledPayments.map((sp) => (
              <div
                key={sp.id}
                style={{
                  padding: 16,
                  background: sp.is_overdue ? "#ffebee" : "#f9f9f9",
                  borderRadius: 8,
                  border: sp.is_overdue ? "1px solid #d32f2f" : "1px solid #ddd",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                      Payment #{sp.payment_number}
                    </p>
                    <p style={{ fontSize: 12, color: "#666" }}>
                      Due: {new Date(sp.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                      ${sp.amount_usd.toFixed(2)}
                    </p>
                    {sp.is_overdue && (
                      <p style={{ fontSize: 11, color: "#d32f2f", fontWeight: 600, margin: 0 }}>
                        Overdue
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
