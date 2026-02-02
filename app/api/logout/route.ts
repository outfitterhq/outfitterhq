import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

const ROLE_COOKIE = "hc_role";

export async function POST() {
  const supabase = await supabaseRoute();
  await supabase.auth.signOut();
  
  // Clear all custom cookies
  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });
  
  // Clear outfitter and role cookies
  response.cookies.delete(OUTFITTER_COOKIE);
  response.cookies.delete(ROLE_COOKIE);
  
  return response;
}
