"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnterCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/client/use-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to validate code");
      }

      if (data.success) {
        setSuccess(data.message || "Successfully linked to outfitter!");
        // Redirect to client portal after a moment
        setTimeout(() => {
          router.push("/client");
        }, 1500);
      } else {
        setError(data.message || "Invalid code");
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 40,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
          Enter Your Outfitter Code
        </h1>
        <p style={{ color: "#666", textAlign: "center", marginBottom: 32 }}>
          Your outfitter should have provided you with a code to access your client portal.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="code"
              style={{ display: "block", fontWeight: 500, marginBottom: 8 }}
            >
              Outfitter Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g., HUNT2025"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 18,
                fontWeight: 600,
                textAlign: "center",
                letterSpacing: 2,
                border: "2px solid #ddd",
                borderRadius: 8,
                outline: "none",
                textTransform: "uppercase",
              }}
              autoFocus
            />
          </div>

          {error && (
            <div
              style={{
                background: "#ffebee",
                color: "#c62828",
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: "#e8f5e9",
                color: "#2e7d32",
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              width: "100%",
              padding: "14px 24px",
              background: loading ? "#ccc" : "#1a472a",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Validating..." : "Continue"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "#666" }}>
          Don't have a code?{" "}
          <a href="mailto:support@outfitterhq.com" style={{ color: "#1a472a" }}>
            Contact your outfitter
          </a>
        </p>
      </div>
    </div>
  );
}
