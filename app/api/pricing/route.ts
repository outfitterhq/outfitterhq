import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";
import type { PricingItemInput } from "@/lib/types/pricing";

// GET: List pricing items
export async function GET(req: Request) {
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

    const { data, error } = await supabase
      .from("pricing_items")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .order("category", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Create pricing item
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

    const body: PricingItemInput = await req.json();

    if (!body.title || body.amount_usd === undefined) {
      return NextResponse.json({ error: "title and amount_usd are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("pricing_items")
      .insert({
        outfitter_id: outfitterId,
        title: body.title,
        description: body.description || "",
        amount_usd: body.amount_usd,
        category: body.category || "General",
        addon_type: body.addon_type ?? null,
        included_days: body.included_days ?? null,
        species: body.species?.trim() || null,
        weapons: body.weapons?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
