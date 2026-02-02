import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: List contract templates for the outfitter
 */
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

    // Parse query params
    const url = new URL(req.url);
    const templateType = url.searchParams.get("type");

    let query = supabase
      .from("contract_templates")
      .select("*")
      .eq("outfitter_id", outfitterId)
      .order("created_at", { ascending: false });

    if (templateType) {
      query = query.eq("template_type", templateType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Create a new contract template
 */
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

    // Verify admin role
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("outfitter_id", outfitterId)
      .eq("user_id", userRes.user.id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, content, template_type, is_active } = body;

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const validTypes = ["hunt_contract", "waiver", "pre_draw_agreement"];
    const type = template_type || "hunt_contract";
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid template_type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // If this template is active, deactivate other templates of same type
    if (is_active !== false) {
      await supabase
        .from("contract_templates")
        .update({ is_active: false })
        .eq("outfitter_id", outfitterId)
        .eq("template_type", type);
    }

    const { data, error } = await supabase
      .from("contract_templates")
      .insert({
        outfitter_id: outfitterId,
        name: name || "Default Hunt Contract",
        description,
        content,
        template_type: type,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
