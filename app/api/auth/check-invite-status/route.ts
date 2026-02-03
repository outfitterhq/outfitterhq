import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    
    if (!userRes?.user) {
      return NextResponse.json({ isInvited: false });
    }

    // Check if user has an "invited" membership
    const { data: memberships } = await supabase
      .from("outfitter_memberships")
      .select("role, outfitter_id, status")
      .eq("user_id", userRes.user.id)
      .eq("status", "invited");

    const invited = (memberships ?? []) as { role?: string; outfitter_id?: string }[];
    
    if (invited.length > 0) {
      const firstInvite = invited[0];
      return NextResponse.json({
        isInvited: true,
        role: firstInvite.role,
        outfitter_id: firstInvite.outfitter_id,
      });
    }

    return NextResponse.json({ isInvited: false });
  } catch (e: any) {
    return NextResponse.json({ isInvited: false, error: String(e) });
  }
}
