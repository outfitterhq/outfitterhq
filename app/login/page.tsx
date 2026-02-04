"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

function LoginContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const errFromUrl = sp.get("e");
  const messageFromUrl = sp.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(errFromUrl);

  // Check if this is an invite link and redirect to accept-invite
  useEffect(() => {
    async function checkInviteAndRedirect() {
      // First, check URL hash for Supabase auth tokens (invite links often have tokens in hash)
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const type = hashParams.get("type");
        const token = hashParams.get("token_hash") || hashParams.get("token");
        const accessToken = hashParams.get("access_token");
        
        // If we have invite tokens in hash, try to set session first, then redirect
        if ((type === "invite" && token) || accessToken) {
          // Try to extract outfitter_id from URL params or hash
          const outfitterId = sp.get("outfitter_id") || hashParams.get("outfitter_id") || "";
          
          // If we have access_token, set the session
          if (accessToken && hashParams.get("refresh_token")) {
            try {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: hashParams.get("refresh_token")!,
              });
            } catch (e) {
              console.warn("Failed to set session from hash:", e);
            }
          }
          
          // Check if user has invited membership (after setting session)
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: memberships } = await supabase
              .from("outfitter_memberships")
              .select("role, outfitter_id, status")
              .eq("user_id", user.id)
              .in("status", ["invited", "active"]);

            const invitedGuide = memberships?.find((m) => m.role === "guide" && m.status === "invited");
            const invitedCook = memberships?.find((m) => m.role === "cook" && m.status === "invited");
            
            if (invitedGuide) {
              const url = `/guide/accept-invite${invitedGuide.outfitter_id || outfitterId ? `?outfitter_id=${invitedGuide.outfitter_id || outfitterId}` : ""}`;
              router.replace(url);
              return;
            }
            
            if (invitedCook) {
              const url = `/cook/accept-invite${invitedCook.outfitter_id || outfitterId ? `?outfitter_id=${invitedCook.outfitter_id || outfitterId}` : ""}`;
              router.replace(url);
              return;
            }
          }
          
          // If we have type=invite but no session yet, redirect to accept-invite with outfitter_id
          if (type === "invite" && outfitterId) {
            // Try to determine role from URL or default to guide
            const role = hashParams.get("role") || sp.get("role") || "guide";
            const url = `/${role}/accept-invite?outfitter_id=${outfitterId}`;
            router.replace(url);
            return;
          }
        }
      }
      
      // Also check if user already has a session with invited membership
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: memberships } = await supabase
          .from("outfitter_memberships")
          .select("role, outfitter_id, status")
          .eq("user_id", user.id)
          .in("status", ["invited", "active"]);

        const invitedGuide = memberships?.find((m) => m.role === "guide" && m.status === "invited");
        if (invitedGuide) {
          const url = `/guide/accept-invite${invitedGuide.outfitter_id ? `?outfitter_id=${invitedGuide.outfitter_id}` : ""}`;
          router.replace(url);
          return;
        }

        const invitedCook = memberships?.find((m) => m.role === "cook" && m.status === "invited");
        if (invitedCook) {
          const url = `/cook/accept-invite${invitedCook.outfitter_id ? `?outfitter_id=${invitedCook.outfitter_id}` : ""}`;
          router.replace(url);
          return;
        }
      }
    }

    checkInviteAndRedirect();
  }, [supabase, router, sp]);

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
        
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <Link
            href="/forgot-password"
            style={{
              color: "#1a472a",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Forgot password?
          </Link>
        </div>
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
