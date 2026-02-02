import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  // Parse query parameters for date range filtering
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  // Get client record
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter(s)
  const { data: links, error: linkError } = await supabase
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true);

  if (linkError || !links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  // Get all outfitter IDs the client is linked to
  const outfitterIds = links.map((l) => l.outfitter_id);

  // Build query
  let query = supabase
    .from("calendar_events")
    .select(`
      id,
      title,
      start_time,
      end_time,
      camp_name,
      species,
      unit,
      weapon,
      status,
      guide_username,
      notes,
      outfitter_id
    `)
    .eq("client_email", userEmail)
    .in("outfitter_id", outfitterIds);

  // Apply date range filter if provided
  if (start) {
    query = query.gte("start_time", start);
  }
  if (end) {
    query = query.lte("end_time", end);
  }

  // Get all calendar events for this client across all linked outfitters
  const { data: events, error: eventsError } = await query.order("start_time", { ascending: true });

  if (eventsError) {
    console.error("Events error:", eventsError);
    console.error("Client email:", userEmail);
    console.error("Outfitter IDs:", outfitterIds);
    // If RLS is blocking, try using admin client as fallback (for debugging)
    if (eventsError.code === "42501" || eventsError.message?.includes("permission denied")) {
      console.warn("RLS permission denied - calendar events may not be visible to clients. Check RLS policies.");
    }
    return NextResponse.json({ error: "Failed to load events", details: eventsError.message }, { status: 500 });
  }
  
  console.log(`📅 Loaded ${events?.length || 0} calendar events for client ${userEmail}`);

  return NextResponse.json({
    events: events || [],
  });
}
