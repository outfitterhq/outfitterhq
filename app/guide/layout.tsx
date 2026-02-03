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
  // Check if this is the accept-invite page - it needs to handle auth itself
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
  const isAcceptInvitePage = pathname.includes("/guide/accept-invite") || 
                             (typeof window !== "undefined" && window.location.pathname.includes("/guide/accept-invite"));
  
  // For accept-invite page, skip auth checks - let the page handle it
  // We can't reliably detect pathname in server component, so we'll check if user exists
  // and if not, allow the page to render (it will handle the invite flow)
  const supabase = await supabasePage();
  const { data: userRes } = await supabase.auth.getUser();

  // If no user and this might be accept-invite, allow it through (client will handle)
  // We'll do a simple check: if no user, render children without GuideShell for accept-invite
  if (!userRes.user) {
    // Check if we can determine this is accept-invite from headers
    // Since we can't reliably get pathname in server component, we'll use a different approach:
    // Return children without GuideShell wrapper - the accept-invite page is client-side and handles its own UI
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
