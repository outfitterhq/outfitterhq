"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function parseHash(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
  };
}

function ConfirmContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Confirming sign-in…");

  useEffect(() => {
    const run = async () => {
      // some flows may include ?outfitter_id=...
      const outfitter_id = sp.get("outfitter_id");

      const { access_token, refresh_token } = parseHash(window.location.hash);

      if (!access_token || !refresh_token) {
        setMsg("Missing tokens in URL. Please reopen the invite link.");
        return;
      }

      const r = await fetch("/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setMsg(`Failed to set session: ${j.error || "unknown error"}`);
        return;
      }

      // remove tokens from URL bar
      window.history.replaceState({}, document.title, window.location.pathname + (outfitter_id ? `?outfitter_id=${encodeURIComponent(outfitter_id)}` : ""));

      router.replace("/select-outfitter");
    };

    run();
  }, [router, sp]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Confirm</h1>
      <p>{msg}</p>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <main style={{ padding: 24 }}>
        <h1>Confirm</h1>
        <p>Loading…</p>
      </main>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
