"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignupContent() {
  const sp = useSearchParams();
  const err = sp.get("e");

  return (
    <main style={{ maxWidth: 520, margin: "32px auto", padding: 16 }}>
      <h1>Outfitter Signup</h1>

      <form action="/api/auth/signup" method="post" style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <input name="outfitter_name" placeholder="Outfitter name" required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input name="first_name" placeholder="First name (optional)" />
          <input name="last_name" placeholder="Last name (optional)" />
        </div>
        <input name="email" placeholder="Email" type="email" required />
        <input name="password" placeholder="Password" type="password" minLength={6} required />

        <button type="submit">Create account</button>

        {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <main style={{ maxWidth: 520, margin: "32px auto", padding: 16 }}>
        <p>Loading...</p>
      </main>
    }>
      <SignupContent />
    </Suspense>
  );
}
