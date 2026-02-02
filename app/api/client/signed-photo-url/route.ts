import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/client/signed-photo-url?path=...
 * Returns a signed URL for a hunt-photos object. Client must be linked to the outfitter
 * that owns the path (first path segment = outfitter_id). Uses service role so RLS
 * does not block (fixes "new row violates row-level security policy" when iOS calls
 * createSignedURL from the client).
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData?.session?.user ?? null;
    if (!user) {
      const h = await headers();
      const auth = h.get("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: { user: u } } = await supabase.auth.getUser(auth.slice(7));
        user = u ?? null;
      }
    }
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    if (!path || path.trim() === "") {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    // Path format: {outfitter_id}/hunt-closeouts/...
    const firstSegment = path.split("/")[0]?.trim().toLowerCase();
    if (!firstSegment) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Ensure client is linked to this outfitter
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .ilike("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 403 });
    }

    const { data: links } = await supabase
      .from("client_outfitter_links")
      .select("outfitter_id")
      .eq("client_id", client.id)
      .eq("is_active", true);

    const allowedOutfitterIds = (links ?? []).map((l: { outfitter_id: string }) => l.outfitter_id.toLowerCase());
    if (!allowedOutfitterIds.includes(firstSegment)) {
      return NextResponse.json({ error: "Not allowed to access this path" }, { status: 403 });
    }

    const admin = supabaseAdmin();
    const { data: urlData, error } = await admin.storage
      .from("hunt-photos")
      .createSignedUrl(path, 3600);

    if (error || !urlData?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: urlData.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
