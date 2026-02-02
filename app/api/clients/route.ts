import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

// GET: List clients for the current outfitter
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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    // Get clients directly associated with this outfitter
    let directQuery = supabase
      .from("clients")
      .select("*")
      .eq("outfitter_id", outfitterId);

    if (search) {
      directQuery = directQuery.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data: directClients, error: directError } = await directQuery;

    if (directError) {
      console.error("Direct clients error:", directError);
    }

    // Get clients linked via client_outfitter_links (many-to-many)
    const { data: linkedData, error: linkedError } = await supabase
      .from("client_outfitter_links")
      .select(`
        client_id,
        clients:client_id(id, email, first_name, last_name, phone, address_line1, city, state, postal_code, outfitter_id)
      `)
      .eq("outfitter_id", outfitterId)
      .eq("is_active", true);

    if (linkedError) {
      console.error("Linked clients error:", linkedError);
    }

    // Extract linked clients
    const linkedClients = (linkedData || [])
      .map((link: any) => link.clients)
      .filter(Boolean);

    // Combine and deduplicate by email
    const clientMap = new Map<string, any>();

    // Add direct clients
    for (const client of directClients || []) {
      if (client.email) {
        clientMap.set(client.email.toLowerCase(), { ...client, source: "database" });
      }
    }

    // Add linked clients (won't overwrite if already exists)
    for (const client of linkedClients) {
      if (client.email && !clientMap.has(client.email.toLowerCase())) {
        clientMap.set(client.email.toLowerCase(), { ...client, source: "linked" });
      }
    }

    // Also get unique client emails from calendar events
    const { data: calendarData } = await supabase
      .from("calendar_events")
      .select("client_email")
      .eq("outfitter_id", outfitterId)
      .not("client_email", "is", null);

    // Add calendar clients that don't exist in clientMap
    for (const event of calendarData || []) {
      const email = event.client_email?.toLowerCase();
      if (email && !clientMap.has(email)) {
        // Filter by search if provided
        if (search && !email.includes(search.toLowerCase())) {
          continue;
        }
        clientMap.set(email, {
          id: `calendar-${email}`,
          email: event.client_email,
          first_name: null,
          last_name: null,
          phone: null,
          address_line1: null,
          city: null,
          state: null,
          postal_code: null,
          source: "calendar",
        });
      }
    }

    // Convert to array and filter by search if needed
    let allClients = Array.from(clientMap.values());

    if (search) {
      const searchLower = search.toLowerCase();
      allClients = allClients.filter((c: any) => {
        const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower);
      });
    }

    // Sort by name or email
    allClients.sort((a: any, b: any) => {
      const aName = `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email || "";
      const bName = `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.email || "";
      return aName.localeCompare(bName);
    });

    return NextResponse.json({ clients: allClients }, { status: 200 });
  } catch (e: any) {
    console.error("Clients API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
