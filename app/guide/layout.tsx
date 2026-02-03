import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabasePage } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import GuideShell from "./components/GuideShell";

export default async function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // CRITICAL FIX: Check for accept-invite page using middleware header
  // This MUST happen before any Supabase calls to prevent redirect loops
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  
  // If this is accept-invite page, skip ALL auth checks and return immediately
  // The client-side page handles its own token verification
  if (pathname.includes("accept-invite")) {
    return <>{children}</>;
  }
  
  // For all other pages, do normal auth checks
  const supabase = await supabasePage();

  // For all other pages, check auth
  const { data: userRes } = await supabase.auth.getUser();

  // If no user, allow through - needed for other public guide pages
  if (!userRes.user) {
    return <>{children}</>;
  }

  // Verify user is a guide and get outfitter_id
  const { data: guide } = await supabase
    .from("guides")
    .select("name, email, username, outfitter_id")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!guide) {
    // Check if user has an "invited" guide membership (they're in the process of accepting invite)
    const { data: invitedMembership } = await supabase
      .from("outfitter_memberships")
      .select("role, status")
      .eq("user_id", userRes.user.id)
      .eq("role", "guide")
      .eq("status", "invited")
      .maybeSingle();
    
    // If user has invited status, allow them through (they're accepting invite)
    if (invitedMembership) {
      return <>{children}</>;
    }
    
    // Check if user is admin/owner (they shouldn't be here)
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (membership) {
      redirect("/dashboard");
    }

    // Not a guide and not admin - redirect to login
    redirect("/login");
  }

  // Set outfitter cookie if not already set (for API endpoints that require it)
  const cookieStore = await cookies();
  if (!cookieStore.get(OUTFITTER_COOKIE)?.value && guide.outfitter_id) {
    cookieStore.set(OUTFITTER_COOKIE, guide.outfitter_id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return (
    <GuideShell guideName={guide.name || undefined} guideEmail={guide.email || undefined}>
      {children}
    </GuideShell>
  );
}
