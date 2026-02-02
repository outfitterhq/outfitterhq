"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function LoginContent() {
  const sp = useSearchParams();
  const errFromUrl = sp.get("e");
  const messageFromUrl = sp.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(errFromUrl);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("password", password);

      const r = await fetch("/api/auth/login", { method: "POST", body: fd });
      const text = await r.text();

      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {
        j = null;
      }

      if (!r.ok) {
        const msg =
          String(j?.error ?? "") ||
          `Login failed (HTTP ${r.status}). Response: ${text || "<empty>"}`;
        setErr(msg);
        return;
      }

      const to = String(j?.redirect ?? "/dashboard");
      window.location.replace(to);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
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
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Log In</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Sign in to your account</p>

      {messageFromUrl && (
        <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: 12, borderRadius: 6, marginBottom: 24 }}>
          {messageFromUrl}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <input
          name="email"
          placeholder="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          name="password"
          placeholder="Password"
          type="password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>

        {err && <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {err}</p>}
      </form>

      <div style={{ marginTop: 24, textAlign: "center", paddingTop: 24, borderTop: "1px solid #e0e0e0" }}>
        <p style={{ marginBottom: 12, color: "#666" }}>Need an account?</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/signup-client"
            style={{
              padding: "10px 20px",
              background: "white",
              color: "#1a472a",
              textDecoration: "none",
              borderRadius: 6,
              border: "1px solid #1a472a",
              fontWeight: 500,
            }}
          >
            Sign Up as Client
          </Link>
          <Link
            href="/signup-outfitter"
            style={{
              padding: "10px 20px",
              background: "#1a472a",
              color: "white",
              textDecoration: "none",
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            Sign Up as Outfitter
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main style={{ maxWidth: 520, margin: "32px auto", padding: 16 }}>
        <p>Loading...</p>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
