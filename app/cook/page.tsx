"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CookDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tenant/current");
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.needs_selection || !data.outfitter_id) {
          router.push("/select-outfitter");
          return;
        }
      } catch {
        router.push("/select-outfitter");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <main style={{ maxWidth: 600, margin: "50px auto", padding: 20 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "50px auto", padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>Cook Dashboard</h1>
      <p>You&apos;re logged in as a cook.</p>
      <p>You can view your assigned camps and meal information when an admin assigns you to a camp.</p>
      <p style={{ fontSize: 14, color: "#888" }}>
        Camp meals and client dietary info are available in the admin app once you&apos;re assigned.
      </p>
    </main>
  );
}
