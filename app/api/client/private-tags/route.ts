import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";

/** Same pattern as hunt-contract: session first, then getUser, then Bearer (for iOS). */
async function getClientEmail(supabase: Awaited<ReturnType<typeof supabaseRoute>>): Promise<string | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  let email: string | null = null;
  if (!error && session?.user?.email) email = session.user.email;
  if (!email) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) email = user.email;
  }
  if (!email) {
    const h = await headers();
    const auth = h.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && user?.email) email = user.email;
    }
  }
  return email ? (email as string).toLowerCase().trim() : null;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return local[0] + "***" + domain;
  return local[0] + "***" + local[local.length - 1] + domain;
}

export async function GET(req: Request) {
  const supabase = await supabaseRoute();
  const userEmailNorm = await getClientEmail(supabase);
  if (!userEmailNorm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .ilike("email", userEmailNorm)
    .limit(1)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({
      error: "Client record not found",
      ...(debug ? { debug: { email_mask: maskEmail(userEmailNorm), client_found: false } } : {}),
    }, { status: 404 });
  }

  const { data: links } = await admin
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true);

  if (!links || links.length === 0) {
    return NextResponse.json({
      error: "Not linked to any outfitter",
      ...(debug ? { debug: { email_mask: maskEmail(userEmailNorm), client_found: true, link_count: 0 } } : {}),
    }, { status: 403 });
  }

  const outfitterIds = links.map((l: { outfitter_id: string }) => l.outfitter_id);

  // Use select("*") so we work with any schema (created_at, ranch_name, etc. may not exist in all DBs)
  // Order by id (created_at may not exist on private_land_tags)
  const { data: rows, error: tagsError } = await admin
    .from("private_land_tags")
    .select("*")
    .in("outfitter_id", outfitterIds)
    .not("client_email", "is", null)
    .order("id", { ascending: false });

  if (tagsError) {
    console.error("Tags error:", tagsError);
    const detail = tagsError.message ?? String(tagsError);
    return NextResponse.json(
      {
        error: "Failed to load tags",
        ...(process.env.NODE_ENV !== "production" || debug ? { detail } : {}),
        ...(debug ? { debug: { tags_error: detail } } : {}),
      },
      { status: 500 }
    );
  }

  const rawCount = (rows || []).length;
  const myTags = (rows || []).filter(
    (t: { client_email?: string | null }) => {
      if (t.client_email == null) return false;
      const tagEmail = (t.client_email.trim?.() ?? t.client_email).toString().toLowerCase().trim();
      return tagEmail === userEmailNorm;
    }
  );

  // Whitelist keys for response (omit client_email, outfitter_id); ranch_name not used
  const allowedKeys = ["id", "tag_name", "species", "unit", "weapon", "season_dates", "status", "notes", "price", "is_available", "hunt_code", "hunt_code_options", "tag_type", "state", "created_at"];
  const tags = myTags.map((t: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const k of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(t, k)) out[k] = t[k];
    }
    return out;
  });

  return NextResponse.json({
    tags,
    ...(debug ? {
      debug: {
        email_mask: maskEmail(userEmailNorm),
        client_found: true,
        link_count: links.length,
        outfitter_ids_count: outfitterIds.length,
        tags_raw_count: rawCount,
        tags_after_email_filter: tags.length,
      },
    } : {}),
  });
}
