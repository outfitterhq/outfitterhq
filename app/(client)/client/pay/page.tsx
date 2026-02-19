"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface PaymentItem {
  id: string;
  description: string;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  status: string;
}

export default function ClientPayPage() {
  const searchParams = useSearchParams();
  const itemId = searchParams.get("item_id");
  const contractId = searchParams.get("contract_id");
  const [item, setItem] = useState<PaymentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const cardElRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const cardRef = useRef<any>(null);

  const allowSimulate =
    searchParams.get("simulate") === "1" || process.env.NEXT_PUBLIC_ALLOW_SIMULATE_PAYMENT === "true";

  useEffect(() => {
    if (!itemId && !contractId) {
      setError("Missing payment item");
      setLoading(false);
      return;
    }
    const qs = itemId
      ? `item_id=${encodeURIComponent(itemId)}`
      : `contract_id=${encodeURIComponent(contractId!)}`;
    fetch(`/api/client/payment-item?${qs}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setItem(data);
      })
      .catch(() => setError("Failed to load payment"))
      .finally(() => setLoading(false));
  }, [itemId, contractId]);

  // Mount Stripe card element when item is loaded and not paid
  useEffect(() => {
    if (!item || item.status === "paid" || item.balance_due_cents <= 0 || !cardElRef.current) return;
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!pk) return;
    let mounted = true;
    (async () => {
      const loadStripe = (await import("@stripe/stripe-js")).loadStripe;
      const stripe = await loadStripe(pk);
      if (!mounted || !stripe || !cardElRef.current) return;
      stripeRef.current = stripe;
      const elements = stripe.elements();
      elementsRef.current = elements;
      const card = elements.create("card", { style: { base: { fontSize: "16px" } } });
      card.mount(cardElRef.current);
      cardRef.current = card;
    })();
    return () => {
      mounted = false;
      if (cardRef.current) {
        cardRef.current.unmount?.();
        cardRef.current = null;
      }
    };
  }, [item?.id]);

  const paymentItemId = item?.id ?? itemId;

  async function handlePay() {
    if (!paymentItemId || !item || item.status === "paid" || item.balance_due_cents <= 0) return;
    if (!cardRef.current || !stripeRef.current) {
      setPayError("Please wait for the payment form to load.");
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_item_id: paymentItemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayError(data.error || "Unable to start payment. Your outfitter may not have online payments set up yet.");
        return;
      }
      const { clientSecret } = data;
      if (!clientSecret) {
        setPayError("Payment could not be started.");
        return;
      }
      const stripe = stripeRef.current;
      const { error: confirmErr } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardRef.current },
      });
      if (confirmErr) {
        setPayError(confirmErr.message || "Payment failed.");
        return;
      }
      setSuccess(true);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  }

  async function handleSimulatePay() {
    if (!paymentItemId || !item || item.status === "paid" || item.balance_due_cents <= 0) return;
    setSimulating(true);
    setPayError(null);
    try {
      const res = await fetch("/api/client/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_item_id: paymentItemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayError(data.error || "Simulate payment failed.");
        return;
      }
      setSuccess(true);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Simulate payment failed.");
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: "48px auto", padding: 24, textAlign: "center" }}>
        <p>Loading payment…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div style={{ maxWidth: 480, margin: "48px auto", padding: 24 }}>
        <p style={{ color: "#c00", marginBottom: 16 }}>{error || "Payment not found"}</p>
        <Link href="/client/documents/hunt-contract" style={{ color: "var(--client-accent, #1a472a)", fontWeight: 600 }}>
          ← Back to Hunt Contract
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ maxWidth: 480, margin: "48px auto", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: "#2e7d32" }}>Payment complete</h2>
        <p style={{ color: "#666", marginBottom: 24 }}>Thank you. Your payment has been processed.</p>
        <Link
          href="/client/documents/hunt-contract"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "var(--client-accent, #1a472a)",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Back to Hunt Contract
        </Link>
      </div>
    );
  }

  const alreadyPaid = item.status === "paid" || item.balance_due_cents <= 0;

  return (
    <div style={{ maxWidth: 480, margin: "48px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/client/documents/hunt-contract" style={{ color: "var(--client-accent, #1a472a)", fontSize: 14, fontWeight: 500 }}>
          ← Back to Hunt Contract
        </Link>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Pay guide fee</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>{item.description}</p>
      <div style={{ marginBottom: 24, fontSize: 28, fontWeight: 700, color: "var(--client-accent, #1a472a)" }}>
        ${(item.balance_due_cents / 100).toLocaleString()}
      </div>

      {alreadyPaid ? (
        <p style={{ color: "#2e7d32", fontWeight: 500 }}>This item is already paid.</p>
      ) : (
        <>
          <div
            ref={cardElRef}
            style={{
              padding: 12,
              border: "1px solid #ccc",
              borderRadius: 8,
              marginBottom: 16,
              background: "#fff",
            }}
          />
          {payError && (
            <p style={{ color: "#c00", marginBottom: 16, fontSize: 14 }}>{payError}</p>
          )}
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || simulating}
            style={{
              width: "100%",
              padding: 14,
              background: paying || simulating ? "#999" : "var(--client-accent, #1a472a)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: paying || simulating ? "not-allowed" : "pointer",
            }}
          >
            {paying ? "Processing…" : "Pay with card"}
          </button>
          {allowSimulate && (
            <button
              type="button"
              onClick={handleSimulatePay}
              disabled={paying || simulating}
              style={{
                width: "100%",
                marginTop: 12,
                padding: 12,
                background: "white",
                color: "#e65100",
                border: "2px solid #e65100",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: paying || simulating ? "not-allowed" : "pointer",
              }}
            >
              {simulating ? "Simulating…" : "Simulate payment (testing)"}
            </button>
          )}
        </>
      )}

      <p style={{ marginTop: 24, fontSize: 13, color: "#666" }}>
        Payments are processed securely. Contact your outfitter if you prefer to pay by check or other method.
      </p>
    </div>
  );
}
