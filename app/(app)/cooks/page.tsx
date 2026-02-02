import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabasePage } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import InviteCookCard from "@/app/(app)/cooks/InviteCookCard";
import CooksList from "@/app/(app)/cooks/CooksList";

export default async function CooksPage() {
  const supabase = await supabasePage();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) redirect("/login");

  const store = await cookies();
  let outfitterId = store.get(OUTFITTER_COOKIE)?.value;
  
  // If no cookie, try to auto-set if only one membership
  if (!outfitterId) {
    const { data: memberships } = await supabase
      .from("outfitter_memberships")
      .select("outfitter_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active");
    
    const active = (memberships ?? []) as any[];
    if (active.length === 1) {
      // Redirect to set cookie
      redirect(`/api/tenant/select?outfitter_id=${active[0].outfitter_id}`);
    } else {
      redirect("/select-outfitter");
    }
  }

  return (
    <main style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Cooks</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Invite cooks and manage access for this outfitter.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <InviteCookCard />
        <CooksList />
      </div>
    </main>
  );
}
