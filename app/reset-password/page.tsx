"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering since we need to read URL hash
export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a valid reset token in the URL hash or query params
    async function checkResetToken() {
      if (typeof window === "undefined") return;

      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let type: string | null = null;

      // Check URL hash first (Supabase default)
      if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        accessToken = hashParams.get("access_token");
        refreshToken = hashParams.get("refresh_token");
        type = hashParams.get("type");
      }

      // Also check query params (fallback if Supabase redirects differently)
      if (!accessToken && window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);
        accessToken = searchParams.get("access_token");
        refreshToken = searchParams.get("refresh_token");
        type = searchParams.get("type");
      }

      // If we have a password recovery token, set the session
      if (type === "recovery" && accessToken && refreshToken) {
        try {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("Failed to set session from reset token:", sessionError);
            setError("Invalid or expired reset link. Please request a new one.");
            return;
          }

          // Clear the URL hash/query params after setting session
          if (window.history.replaceState) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (e) {
          console.error("Failed to set session from reset token:", e);
          setError("Invalid or expired reset link. Please request a new one.");
        }
      } else if (window.location.hash || window.location.search) {
        // We have hash/query params but they're not valid recovery tokens
        // This might mean the user was redirected here but the token is missing
        console.warn("Reset password page loaded with URL params but no valid recovery token");
      }
    }
    checkResetToken();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setBusy(true);

    try {
      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setBusy(false);
        return;
      }

      setSuccess(true);
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login?message=Password reset successful. Please sign in with your new password.");
      }, 2000);
    } catch (e: any) {
      setError(String(e?.message ?? e));
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
      
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Set New Password</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Enter your new password below.
      </p>

      {success ? (
        <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Password reset successful!</p>
          <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
            Redirecting to login...
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <input
            name="password"
            placeholder="New Password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 16 }}
          />
          <input
            name="confirmPassword"
            placeholder="Confirm New Password"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy}
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 16 }}
          />

          <button type="submit" disabled={busy} style={{ padding: 12, background: "#1a472a", color: "white", border: "none", borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Resetting…" : "Reset Password"}
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
