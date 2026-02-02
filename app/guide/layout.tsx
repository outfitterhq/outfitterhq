import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabasePage } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import GuideShell from "./components/GuideShell";

export default async function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabasePage();
  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes.user) {
    redirect("/login?redirect=/guide");
  }

  // Verify user is a guide and get outfitter_id
  const { data: guide } = await supabase
    .from("guides")
    .select("name, email, username, outfitter_id")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!guide) {
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
