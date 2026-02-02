import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const access_token = String((body as any).access_token ?? "").trim();
    const refresh_token = String((body as any).refresh_token ?? "").trim();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "Missing access_token or refresh_token" }, { status: 400 });
    }

    const supabase = await supabaseRoute();

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error || !data.session) {
      return NextResponse.json({ error: error?.message ?? "Failed to set session" }, { status: 400 });
    }

    // Cookies are written by supabaseRoute() cookie adapter
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
