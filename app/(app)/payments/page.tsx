"use client";

import { useState, useEffect } from "react";

interface PaymentItem {
  id: string;
  item_type: string;
  description: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  total_cents: number;
  status: string;
  amount_paid_cents: number;
  due_date: string | null;
  created_at: string;
  paid_at: string | null;
  clients: {
    id: string;
    email: string;
    full_name: string | null;
  };
  calendar_events: {
    id: string;
    title: string;
    start_date: string;
    species: string;
  } | null;
}

interface ConnectStatus {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  needsOnboarding?: boolean;
  notConfigured?: boolean;
  message?: string;
}

export default function PaymentsPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load Stripe Connect status
      const connectRes = await fetch("/api/payments/connect");
      if (connectRes.ok) {
        const connectData = await connectRes.json();
        setConnectStatus(connectData);
      }

      // Load payment items
      const itemsRes = await fetch("/api/payments/items");
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setItems(itemsData.items || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startOnboarding() {
    setOnboardingLoading(true);
    try {
      const res = await fetch("/api/payments/connect", { method: "POST" });
      const data = await res.json();
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        setError(data.error || "Failed to start onboarding");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setOnboardingLoading(false);
    }
  }

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    paid: "#22c55e",
    partially_paid: "#3b82f6",
    refunded: "#6b7280",
    cancelled: "#ef4444",
  };

  const pendingItems = items.filter(i => i.status === "pending");
  const paidItems = items.filter(i => i.status === "paid");
  const totalCollected = items
    .filter(i => i.status === "paid")
    .reduce((sum, i) => sum + i.total_cents, 0);
  const totalPending = items
    .filter(i => i.status === "pending")
    .reduce((sum, i) => sum + i.total_cents, 0);

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Payments</h1>
      <p style={{ opacity: 0.75, marginBottom: 24 }}>
        Manage payments and collect deposits with a 5% handling fee
      </p>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16, color: "#c00" }}>
          {error}
        </div>
      )}

      {/* Stripe Not Configured */}
      {connectStatus?.notConfigured && (
        <div style={{
          background: "#f5f5f5",
          border: "1px solid #ddd",
          padding: 24,
          borderRadius: 12,
          marginBottom: 24,
          textAlign: "center",
        }}>
          <h3 style={{ margin: 0 }}>💳 Payments Coming Soon</h3>
          <p style={{ margin: "12px 0 0", opacity: 0.75 }}>
            Payment processing is not yet configured. When ready, you&apos;ll be able to:
          </p>
          <ul style={{ textAlign: "left", maxWidth: 400, margin: "16px auto", lineHeight: 1.8 }}>
            <li>Collect deposits from clients</li>
            <li>Process hunt payments</li>
            <li>Automatic 5% handling fee on transactions</li>
            <li>Funds deposited directly to your bank</li>
          </ul>
        </div>
      )}

      {/* Stripe Connect Status */}
      {connectStatus && !connectStatus.notConfigured && (
        <div style={{
          background: connectStatus.chargesEnabled ? "#f0fdf4" : "#fefce8",
          border: `1px solid ${connectStatus.chargesEnabled ? "#22c55e" : "#f59e0b"}`,
          padding: 20,
          borderRadius: 12,
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>
                {connectStatus.chargesEnabled ? "✅ Stripe Connected" : "⚠️ Payment Setup Required"}
              </h3>
              <p style={{ margin: "8px 0 0", opacity: 0.75 }}>
                {connectStatus.chargesEnabled
                  ? "You can accept payments from clients. Funds will be deposited to your bank account."
                  : "Complete Stripe onboarding to accept payments from clients."}
              </p>
            </div>
            {!connectStatus.chargesEnabled && (
              <button
                onClick={startOnboarding}
                disabled={onboardingLoading}
                style={{
                  padding: "12px 24px",
                  background: "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: onboardingLoading ? "not-allowed" : "pointer",
                  fontSize: 16,
                }}
              >
                {onboardingLoading ? "Loading..." : "Set Up Payments"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        <div style={{ background: "#f5f5f5", padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, color: "#666" }}>Total Collected</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#22c55e" }}>
            {formatCents(totalCollected)}
          </div>
        </div>
        <div style={{ background: "#f5f5f5", padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, color: "#666" }}>Pending</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>
            {formatCents(totalPending)}
          </div>
        </div>
        <div style={{ background: "#f5f5f5", padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, color: "#666" }}>Platform Fees (5%)</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#666" }}>
            {formatCents(items.filter(i => i.status === "paid").reduce((s, i) => s + i.platform_fee_cents, 0))}
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading payments...</p>
      ) : (
        <>
          {/* Pending Payments */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ color: "#f59e0b" }}>⏳ Pending ({pendingItems.length})</h2>
            {pendingItems.length === 0 ? (
              <p style={{ color: "#666" }}>No pending payments.</p>
            ) : (
              <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={{ padding: 12, textAlign: "left" }}>Client</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Description</th>
                      <th style={{ padding: 12, textAlign: "right" }}>Amount</th>
                      <th style={{ padding: 12, textAlign: "right" }}>Fee (5%)</th>
                      <th style={{ padding: 12, textAlign: "right" }}>Total</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingItems.map((item) => (
                      <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 12 }}>
                          <strong>{item.clients?.full_name || "Unknown"}</strong>
                          <div style={{ fontSize: 12, color: "#666" }}>{item.clients?.email}</div>
                        </td>
                        <td style={{ padding: 12 }}>
                          {item.description}
                          <div style={{ fontSize: 12, color: "#666" }}>{item.item_type}</div>
                        </td>
                        <td style={{ padding: 12, textAlign: "right" }}>{formatCents(item.subtotal_cents)}</td>
                        <td style={{ padding: 12, textAlign: "right", color: "#666" }}>{formatCents(item.platform_fee_cents)}</td>
                        <td style={{ padding: 12, textAlign: "right", fontWeight: 600 }}>{formatCents(item.total_cents)}</td>
                        <td style={{ padding: 12 }}>
                          {item.due_date ? new Date(item.due_date).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paid */}
          <div>
            <h2 style={{ color: "#22c55e" }}>✅ Paid ({paidItems.length})</h2>
            {paidItems.length === 0 ? (
              <p style={{ color: "#666" }}>No paid items yet.</p>
            ) : (
              <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={{ padding: 12, textAlign: "left" }}>Client</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Description</th>
                      <th style={{ padding: 12, textAlign: "right" }}>Amount</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidItems.map((item) => (
                      <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 12 }}>
                          <strong>{item.clients?.full_name || "Unknown"}</strong>
                        </td>
                        <td style={{ padding: 12 }}>{item.description}</td>
                        <td style={{ padding: 12, textAlign: "right", fontWeight: 600 }}>{formatCents(item.total_cents)}</td>
                        <td style={{ padding: 12 }}>
                          {item.paid_at ? new Date(item.paid_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
