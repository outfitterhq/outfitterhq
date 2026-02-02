import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: List outfitter codes for the current outfitter
export async function GET() {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const { data: codes, error } = await supabase
      .from("outfitter_codes")
      .select("id, code, single_use, expires_at, is_active, notes, created_at")
      .eq("outfitter_id", outfitterId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ codes: codes || [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Create a new outfitter code
export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    const body = await req.json();
    const { code, single_use, expires_at, notes } = body;

    if (!code || code.trim().length < 3) {
      return NextResponse.json({ error: "Code must be at least 3 characters" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("outfitter_codes")
      .insert({
        outfitter_id: outfitterId,
        code: code.trim().toUpperCase(),
        single_use: single_use || false,
        expires_at: expires_at || null,
        notes: notes || null,
        created_by: userRes.user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        return NextResponse.json({ error: "This code already exists. Please choose a different code." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ code: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
