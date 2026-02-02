import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabasePage } from "@/lib/supabase/server";
import AppShell from "@/app/components/AppShell";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await supabasePage();

    // Get user directly - Supabase will validate cookies automatically
    const { data: userRes, error: userError } = await supabase.auth.getUser();
    const user = userRes?.user;
    
    if (userError) {
      console.error("Layout auth error:", userError);
      return (
        <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
          <h1>Authentication Error</h1>
          <p style={{ color: "#d32f2f", marginBottom: 16 }}>
            Failed to authenticate. Please try logging in again.
          </p>
          <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
            {JSON.stringify({ error: userError.message, code: userError.status }, null, 2)}
          </pre>
        </main>
      );
    }
    
    // If no user, redirect to login
    if (!user) {
      redirect("/login");
    }

    const { data: memberships, error } = await supabase
      .from("outfitter_memberships")
      .select("outfitter_id, role, status, outfitters:outfitters(id,name)")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) {
      console.error("Layout membership query error:", error);
      return (
        <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
          <h1>Database Error</h1>
          <p style={{ color: "#d32f2f", marginBottom: 16 }}>
            Failed to load outfitter memberships. Check your Supabase connection and RLS policies.
          </p>
          <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
            {JSON.stringify({ error: error.message, code: error.code, hint: error.hint, details: error.details }, null, 2)}
          </pre>
        </main>
      );
    }

  const active = (memberships ?? []) as any[];
  if (active.length === 0) redirect("/select-outfitter");

  // Read cookie - try both methods to be sure
  const cookieStore = await cookies();
  let outfitterId = cookieStore.get(OUTFITTER_COOKIE)?.value ?? null;
  
  // If still no cookie, check if we should auto-select (only one membership)
  if (!outfitterId && active.length === 1) {
    // Redirect to API route to set cookie properly
    redirect(`/api/tenant/select?outfitter_id=${active[0].outfitter_id}`);
  }
  
  if (!outfitterId) redirect("/select-outfitter");

  const current = active.find((m) => m.outfitter_id === outfitterId);
  if (!current) redirect("/select-outfitter");

  const role = String(current.role ?? "");
  const isAdmin = role === "owner" || role === "admin";
  
  // If user is not admin/owner, redirect to guide portal
  if (!isAdmin) {
    redirect("/guide");
  }

  return (
    <AppShell
      userEmail={user.email ?? ""}
      memberships={active.map((m) => ({
        outfitter_id: m.outfitter_id,
        role: m.role,
        status: m.status,
        outfitter_name: m.outfitters?.name ?? "Outfitter",
      }))}
    >
      {children}
    </AppShell>
  );
  } catch (error: any) {
    console.error("Layout error:", error);
    const isEnvError = error?.message?.includes("Missing NEXT_PUBLIC_SUPABASE");
    
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <h1>Configuration Error</h1>
        {isEnvError ? (
          <>
            <p style={{ color: "#d32f2f", marginBottom: 16 }}>
              Missing required environment variables in Vercel.
            </p>
            <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Required Environment Variables:</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
                <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
              </ul>
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
                Go to Vercel Dashboard → Your Project → Settings → Environment Variables → Add these variables, then redeploy.
              </p>
            </div>
          </>
        ) : (
          <p style={{ color: "#d32f2f", marginBottom: 16 }}>
            {error?.message || "An unexpected error occurred"}
          </p>
        )}
        <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
          {JSON.stringify({ error: error?.message, stack: error?.stack }, null, 2)}
        </pre>
      </main>
    );
  }
}
