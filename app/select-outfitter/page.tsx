"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SelectOutfitterPage() {
  const router = useRouter();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load memberships on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tenant/list");
        if (res.ok) {
          const data = await res.json();
          setMemberships(data.memberships || []);
        } else {
          setErrMsg("Failed to load memberships");
        }
      } catch (e) {
        setErrMsg(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function selectOutfitter(outfitterId: string) {
    setErrMsg(null);
    try {
      const formData = new FormData();
      formData.set("outfitter_id", outfitterId);

      const res = await fetch("/api/tenant/select", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrMsg(data.error || "Failed to select outfitter");
        return;
      }

      // Cookie is set in response, now redirect client-side
      // Small delay to ensure cookie is set
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setErrMsg(String(e));
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: "32px auto", padding: 16 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>Select outfitter</h1>

      {errMsg ? (
        <p style={{ background: "#fee", padding: 12, borderRadius: 10 }}>{errMsg}</p>
      ) : null}

      {memberships.length === 0 ? (
        <p>You don't have access to any outfitters yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {memberships.map((m) => (
            <button
              key={m.outfitter_id}
              onClick={() => selectOutfitter(m.outfitter_id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700 }}>{m.outfitter_id}</div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                Role: {m.role} • Status: {m.status}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
