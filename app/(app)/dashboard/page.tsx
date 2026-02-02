import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabasePage } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import QuickCard from "./QuickCard";
import QuickLink from "./QuickLink";

export default async function DashboardPage() {
  try {
    const supabase = await supabasePage();
    const { data: userRes, error: userError } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (userError) {
      console.error("Auth error:", userError);
      return (
        <div>
          <section style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Authentication Error</h1>
            <p style={{ color: "#d32f2f", fontSize: 16, marginBottom: 16 }}>
              Failed to authenticate. Please try logging in again.
            </p>
            <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify({ error: userError.message, code: userError.status }, null, 2)}
            </pre>
          </section>
        </div>
      );
    }

    if (!user) redirect("/login");

    const { data: memberships, error: memError } = await supabase
      .from("outfitter_memberships")
      .select("outfitter_id, role, status, outfitters:outfitters(id,name)")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (memError) {
      console.error("Membership query error:", memError);
      return (
        <div>
          <section style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Database Error</h1>
            <p style={{ color: "#d32f2f", fontSize: 16, marginBottom: 16 }}>
              Failed to load outfitter memberships. Check your Supabase connection.
            </p>
            <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify({ error: memError.message, code: memError.code, hint: memError.hint }, null, 2)}
            </pre>
          </section>
        </div>
      );
    }

  const active: any[] = (memberships as any[]) ?? [];
  if (active.length === 0) {
    return (
      <div>
        <section style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Welcome</h1>
          <p style={{ color: "#666", fontSize: 16 }}>No active outfitter membership found.</p>
        </section>
      </div>
    );
  }

  const currentOutfitterId = (await cookies()).get(OUTFITTER_COOKIE)?.value;

  if (active.length > 1 && !currentOutfitterId) redirect("/select-outfitter");

  const current = currentOutfitterId ? active.find((m) => m.outfitter_id === currentOutfitterId) : active[0];

  if (!current) redirect("/select-outfitter");

  const outfitterName = current.outfitters?.name || "Outfitter HQ";
  const userName = user.email || "Admin";

  return (
    <div>
      {/* Welcome Section */}
      <section style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Welcome, {userName}!
        </h1>
        <p style={{ color: "#666", fontSize: 16 }}>
          Manage your outfitting business for {outfitterName}. View clients, schedule hunts, manage guides, and more.
        </p>
      </section>

      {/* Quick Actions */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <QuickCard
            title="Clients"
            description="View and manage all client accounts, documents, and information"
            href="/clients"
            icon="👥"
          />
          <QuickCard
            title="Hunt Calendar"
            description="Schedule hunts, assign guides, and manage your calendar"
            href="/calendar"
            icon="📅"
          />
          <QuickCard
            title="Guides"
            description="Manage guide accounts, documents, and assignments"
            href="/guides"
            icon="🎯"
          />
          <QuickCard
            title="Documents"
            description="View contracts, waivers, questionnaires, and other documents"
            href="/documents"
            icon="📄"
          />
        </div>
      </section>

      {/* Quick Links */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>More Tools</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <QuickLink href="/pricing" icon="💰" label="Pricing" />
          <QuickLink href="/private-land-tags" icon="🏷️" label="Tags for Sale" />
          <QuickLink href="/draw-results" icon="🎲" label="Draw Results" />
          <QuickLink href="/payments" icon="💳" label="Payments" />
          <QuickLink href="/settings" icon="⚙️" label="Settings" />
        </div>
      </section>

      {/* Account Info */}
      <section>
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Account Information</h3>
          <div style={{ display: "grid", gap: 8, color: "#666", fontSize: 14 }}>
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Outfitter:</strong> {outfitterName}</div>
            <div><strong>Role:</strong> {current.role}</div>
          </div>
        </div>
      </section>
    </div>
  );
  } catch (error: any) {
    console.error("Dashboard error:", error);
    const isEnvError = error?.message?.includes("Missing NEXT_PUBLIC_SUPABASE");
    
    return (
      <div>
        <section style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Configuration Error</h1>
          {isEnvError ? (
            <>
              <p style={{ color: "#d32f2f", fontSize: 16, marginBottom: 16 }}>
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
            <p style={{ color: "#d32f2f", fontSize: 16, marginBottom: 16 }}>
              {error?.message || "An unexpected error occurred"}
            </p>
          )}
          <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
            {JSON.stringify({ error: error?.message, stack: error?.stack }, null, 2)}
          </pre>
        </section>
      </div>
    );
  }
}

