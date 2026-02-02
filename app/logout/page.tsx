"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const supabase = useMemo(() => createClient(), []);
  const [msg, setMsg] = useState("Signing out…");

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      } finally {
        setMsg("Signed out. Redirecting to login…");
        window.location.replace("/login");
      }
    })();
  }, [supabase]);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Logout</h1>
      <p>{msg}</p>
    </main>
  );
}
