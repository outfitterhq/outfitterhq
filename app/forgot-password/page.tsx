"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Call API route which uses server-side environment variables for production URL
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send reset email");
        setBusy(false);
        return;
      }

      setSent(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "32px auto", padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Link href="/" style={{ display: "inline-block", textDecoration: "none" }}>
          <Image
            src="/outfitterhq-logo.png"
            alt="Outfitter HQ"
            width={200}
            height={67}
            style={{ height: "auto", maxHeight: "60px", width: "auto" }}
            priority
          />
        </Link>
      </div>
      
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Reset Password</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {sent ? (
        <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Check your email</p>
          <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
            If an account exists for {email}, we've sent a password reset link. Please check your inbox and follow the instructions.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <input
            name="email"
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 16 }}
          />

          <button type="submit" disabled={busy} style={{ padding: 12, background: "#1a472a", color: "white", border: "none", borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Sending…" : "Send Reset Link"}
          </button>

          {error && <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>}
        </form>
      )}

      <div style={{ marginTop: 24, textAlign: "center", paddingTop: 24, borderTop: "1px solid #e0e0e0" }}>
        <Link
          href="/login"
          style={{
            color: "#1a472a",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back to login
        </Link>
      </div>
    </main>
  );
}
