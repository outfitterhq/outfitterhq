"use client";

import { useState, useEffect } from "react";

interface PaymentSchedule {
  label: string;
  amount: number;
  due_date: string;
  is_paid: boolean;
  paid_at?: string;
}

interface PaymentSummary {
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_plan: string;
  payments: PaymentSchedule[];
  hunt?: {
    title: string;
    start_date: string;
  };
}

export default function ClientPaymentsPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    try {
      const res = await fetch("/api/client/payments");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load payments");
      }
      const data = await res.json();
      setSummary(data);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading payment information...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>My Payments</h1>
        <p style={{ color: "#666" }}>
          View your payment schedule and balance. Contact your outfitter for payment options.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <p style={{ color: "#c00" }}>{error}</p>
        </div>
      )}

      {!summary || summary.total_amount === 0 ? (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 48,
            textAlign: "center",
            color: "#666",
          }}
        >
          <p style={{ fontSize: 18, marginBottom: 8 }}>No payment schedule set up yet.</p>
          <p style={{ fontSize: 14 }}>
            Your payment schedule will appear here once your hunt contract is finalized.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <SummaryCard
              label="Total Amount"
              value={`$${summary.total_amount.toLocaleString()}`}
              icon="💵"
            />
            <SummaryCard
              label="Amount Paid"
              value={`$${summary.amount_paid.toLocaleString()}`}
              icon="✅"
              color="#2e7d32"
            />
            <SummaryCard
              label="Balance Due"
              value={`$${summary.balance_due.toLocaleString()}`}
              icon="📋"
              color={summary.balance_due > 0 ? "#e65100" : "#2e7d32"}
            />
            <SummaryCard
              label="Payment Plan"
              value={getPlanLabel(summary.payment_plan)}
              icon="📆"
            />
          </div>

          {/* Hunt Info */}
          {summary.hunt && (
            <div
              style={{
                background: "#f0f7f4",
                border: "1px solid #c8e6c9",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <p style={{ margin: 0, color: "#1a472a" }}>
                <strong>{summary.hunt.title}</strong> • Hunt starts{" "}
                {formatDate(summary.hunt.start_date)}
              </p>
            </div>
          )}

          {/* Payment Schedule */}
          <div
            style={{
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #eee",
                background: "#fafafa",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Payment Schedule</h2>
            </div>

            {summary.payments.length > 0 ? (
              summary.payments.map((payment, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 20,
                    borderBottom: idx < summary.payments.length - 1 ? "1px solid #eee" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: payment.is_paid ? "#f8fff8" : "white",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{payment.is_paid ? "✅" : "⏳"}</span>
                      <div>
                        <h3 style={{ fontWeight: 600, margin: 0 }}>{payment.label}</h3>
                        <p style={{ color: "#666", fontSize: 14, margin: "4px 0 0" }}>
                          Due: {formatDate(payment.due_date)}
                          {payment.is_paid && payment.paid_at && (
                            <span style={{ color: "#2e7d32", marginLeft: 12 }}>
                              Paid: {formatDate(payment.paid_at)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: payment.is_paid ? "#2e7d32" : "#1a472a",
                      }}
                    >
                      ${payment.amount.toLocaleString()}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: payment.is_paid ? "#e8f5e9" : "#fff3e0",
                        color: payment.is_paid ? "#2e7d32" : "#e65100",
                      }}
                    >
                      {payment.is_paid ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "#666" }}>
                No payments scheduled yet.
              </div>
            )}
          </div>
        </>
      )}

      {/* Payment Methods Info */}
      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#f5f5f5",
          borderRadius: 8,
          border: "1px solid #ddd",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Payment Methods</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#555", lineHeight: 1.8 }}>
          <li>Contact your outfitter for accepted payment methods</li>
          <li>Payments are typically due according to the schedule above</li>
          <li>Full balance must be paid before hunt start date</li>
        </ul>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontSize: 14, color: "#666" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#1a472a" }}>{value}</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getPlanLabel(plan: string): string {
  switch (plan) {
    case "full":
      return "Pay in Full";
    case "two":
      return "2 Payments";
    case "three":
      return "3 Payments";
    default:
      return plan || "Not Set";
  }
}
