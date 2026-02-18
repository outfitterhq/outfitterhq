import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * POST /api/client/predraw/sign
 * In-app signing for pre-draw contract. Accepts typed_name in body.
 */
export async function POST(req: Request) {
  const supabase = await supabaseRoute();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  let body: { typed_name?: string } = {};
  try {
    body = await req.json();
  } catch { /* optional */ }
  const typed_name = body.typed_name;

  if (typeof typed_name !== "string" || !typed_name.trim()) {
    return NextResponse.json({ error: "typed_name is required" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  const { data: links } = await supabase
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .limit(1);

  if (!links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  const outfitterId = links[0].outfitter_id;
  const currentYear = new Date().getFullYear();

  const { data: predraw, error: fetchErr } = await supabase
    .from("client_predraw_submissions")
    .select("id")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .eq("year", currentYear)
    .single();

  if (fetchErr || !predraw) {
    return NextResponse.json(
      { error: "No pre-draw submission found for this year. Please submit the form first." },
      { status: 404 }
    );
  }

  const { error: updateErr } = await supabase
    .from("client_predraw_submissions")
    .update({
      client_signed_at: new Date().toISOString(),
      docusign_status: "signed",
    })
    .eq("id", predraw.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    signing_method: "in_app",
    message: "Pre-draw contract signed successfully.",
  });
}
