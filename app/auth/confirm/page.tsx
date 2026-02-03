"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function parseHash(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    type: params.get("type"), // invite, recovery, etc.
    token_hash: params.get("token_hash"),
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

      const hashData = parseHash(window.location.hash);
      const { access_token, refresh_token, type } = hashData;

      if (!access_token || !refresh_token) {
        setMsg("Missing tokens in URL. Please reopen the invite link.");
        return;
      }

      // If this is an invite type, we should redirect to accept-invite
      const isInviteFlow = type === "invite" || type === "recovery";

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

      // Check if this is an invite flow - if user has "invited" status, send to accept-invite
      // First, check if we have outfitter_id in URL (from invite link)
      if (outfitter_id && isInviteFlow) {
        // This is an invite - redirect to guide accept-invite with hash preserved
        const hash = window.location.hash;
        window.history.replaceState({}, document.title, `/guide/accept-invite?outfitter_id=${encodeURIComponent(outfitter_id)}${hash}`);
        router.replace(`/guide/accept-invite?outfitter_id=${encodeURIComponent(outfitter_id)}${hash}`);
        return;
      }

      // Check user's membership status to see if they're invited (after session is set)
      if (isInviteFlow) {
        const checkMembership = await fetch("/api/auth/check-invite-status");
        if (checkMembership.ok) {
          const membershipData = await checkMembership.json();
          if (membershipData.isInvited) {
            const hash = window.location.hash;
            const redirectPath = membershipData.role === "cook" 
              ? `/cook/accept-invite?outfitter_id=${encodeURIComponent(membershipData.outfitter_id)}${hash}`
              : `/guide/accept-invite?outfitter_id=${encodeURIComponent(membershipData.outfitter_id)}${hash}`;
            window.history.replaceState({}, document.title, redirectPath);
            router.replace(redirectPath);
            return;
          }
        }
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
