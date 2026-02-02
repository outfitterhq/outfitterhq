import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Get clients assigned to a camp
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify camp belongs to outfitter
    const { data: camp } = await supabase
      .from("camps")
      .select("id, max_clients")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // Get assigned clients
    const { data: assignments, error } = await supabase
      .from("camp_client_assignments")
      .select(`
        *,
        client:clients(
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq("camp_id", id)
      .order("assigned_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      clients: assignments?.map((a) => a.client) || [],
      assigned_count: assignments?.length || 0,
      max_clients: camp.max_clients,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Assign clients to a camp
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify admin access
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { client_ids } = body;

    if (!Array.isArray(client_ids)) {
      return NextResponse.json({ error: "client_ids must be an array" }, { status: 400 });
    }

    // Verify camp belongs to outfitter and check capacity
    const { data: camp } = await supabase
      .from("camps")
      .select("id, max_clients")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // Get current assignments
    const { data: existing } = await supabase
      .from("camp_client_assignments")
      .select("client_id")
      .eq("camp_id", id);

    const existingIds = new Set((existing || []).map((e) => e.client_id));
    const newClientIds = client_ids.filter((cid: string) => !existingIds.has(cid));

    // Check capacity
    const totalAfterAdd = (existing?.length || 0) + newClientIds.length;
    if (camp.max_clients && totalAfterAdd > camp.max_clients) {
      return NextResponse.json(
        { error: `Camp capacity exceeded. Max: ${camp.max_clients}, Attempting: ${totalAfterAdd}` },
        { status: 400 }
      );
    }

    // Insert new assignments
    if (newClientIds.length > 0) {
      const assignments = newClientIds.map((clientId: string) => ({
        camp_id: id,
        client_id: clientId,
        assigned_by: userRes.user.id,
      }));

      const { error: insertError } = await supabase
        .from("camp_client_assignments")
        .insert(assignments);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, added: newClientIds.length });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE: Remove a client from a camp
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify admin access
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json({ error: "client_id query parameter required" }, { status: 400 });
    }

    // Verify camp belongs to outfitter
    const { data: camp } = await supabase
      .from("camps")
      .select("id")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("camp_client_assignments")
      .delete()
      .eq("camp_id", id)
      .eq("client_id", clientId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
