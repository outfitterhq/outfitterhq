import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseRoute();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url));
}
