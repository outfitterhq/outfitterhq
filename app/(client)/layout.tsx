import { redirect } from "next/navigation";
import { supabasePage } from "@/lib/supabase/server";
import ClientShell from "./components/ClientShell";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabasePage();

  // Get authenticated user
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  const user = userRes?.user;

  console.log("🟢 Client Layout - User:", user?.email, "Error:", userError?.message);

  if (!user) {
    console.log("🔴 No user, redirecting to login");
    redirect("/login");
  }

  // First get the client record
  const { data: clientRecord, error: clientError } = await supabase
    .from("clients")
    .select("id, email, first_name, last_name, phone")
    .eq("email", user.email)
    .single();

  console.log("🟢 Client Record:", clientRecord?.id, "Error:", clientError?.message);

  // If no client record exists, check if they're staff, otherwise redirect to enter code
  if (clientError || !clientRecord) {
    console.log("🔴 No client record found for user:", user.email);
    // Check if they're an admin/owner - if so, redirect to admin dashboard
    const { data: memberships } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (memberships && memberships.length > 0) {
      // User is a staff member, redirect to admin
      console.log("🔴 User is staff, redirecting to dashboard");
      redirect("/dashboard");
    }

    // User has no client record and no staff access - show enter code page
    console.log("🔴 Redirecting to enter-code");
    redirect("/client/enter-code");
  }

  // Check if user is linked to any outfitters as a client
  // CRITICAL: Must filter by client_id, not just is_active!
  const { data: clientLinks, error: linkError } = await supabase
    .from("client_outfitter_links")
    .select(`
      id,
      outfitter_id,
      is_active,
      outfitters:outfitters(id, name)
    `)
    .eq("client_id", clientRecord.id)
    .eq("is_active", true);

  console.log("🟢 Client Links:", clientLinks?.length, "Error:", linkError?.message);

  if (linkError || !clientLinks || clientLinks.length === 0) {
    console.log("🔴 No client links found for user:", user.email);
    // User is not linked to any outfitter as a client
    // Check if they're an admin/owner - if so, redirect to admin dashboard
    const { data: memberships } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active");

    console.log("🟢 Memberships check:", memberships?.length);

    if (memberships && memberships.length > 0) {
      // User is a staff member, redirect to admin
      console.log("🔴 User is staff, redirecting to dashboard");
      redirect("/dashboard");
    }

    // Client exists but not linked to any outfitter - show enter code page
    console.log("🔴 Redirecting to enter-code");
    redirect("/client/enter-code");
  }

  // For now, use the first linked outfitter
  // TODO: Add outfitter switcher if client is linked to multiple
  const currentLink = clientLinks[0] as any;
  const outfitterId = currentLink.outfitter_id;
  const outfitterName = currentLink.outfitters?.name ?? "Outfitter";

  // Fetch outfitter branding settings
  const { data: outfitterData } = await supabase
    .from("outfitters")
    .select("client_portal_logo_url, client_portal_background_type, client_portal_background_color, client_portal_background_image_url, client_portal_per_page_backgrounds, client_portal_header_color")
    .eq("id", outfitterId)
    .single();

  return (
    <ClientShell
      userEmail={user.email ?? ""}
      userName={clientRecord ? `${clientRecord.first_name ?? ""} ${clientRecord.last_name ?? ""}`.trim() || (user.email ?? "") : (user.email ?? "")}
      clientId={clientRecord?.id}
      outfitterId={outfitterId}
      outfitterName={outfitterName}
      linkedOutfitters={clientLinks.map((l: any) => ({
        outfitter_id: l.outfitter_id,
        outfitter_name: l.outfitters?.name ?? "Outfitter",
      }))}
      logoUrl={outfitterData?.client_portal_logo_url || undefined}
      backgroundType={outfitterData?.client_portal_background_type || "color"}
      backgroundColor={outfitterData?.client_portal_background_color || "#f5f5f5"}
      backgroundImageUrl={outfitterData?.client_portal_background_image_url || undefined}
      perPageBackgrounds={outfitterData?.client_portal_per_page_backgrounds || {}}
      headerColor={outfitterData?.client_portal_header_color || "#1a472a"}
    >
      {children}
    </ClientShell>
  );
}
