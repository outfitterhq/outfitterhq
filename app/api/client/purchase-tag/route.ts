import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { createHuntContractIfNeeded } from "@/lib/generate-hunt-contract";

/** Same pattern as private-tags / hunt-contract: session first, then getUser, then Bearer (for iOS). */
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

/**
 * POST: Purchase a private land or unit-wide tag (simulated)
 *
 * Per-hunt workflow: each purchase creates one independent hunt.
 * 1. Mark the tag as unavailable
 * 2. Create a calendar event (hunt) with status Pending Admin Review
 * 3. Private Land: hunt_code from tag (locked). Unit-Wide: hunt_code null until admin sets it
 * 4. No contract yet; admin reviews this hunt, sets unit/hunt code if needed, then generates contract
 */
export async function POST(req: Request) {
  const supabase = await supabaseRoute();

  const userEmailNorm = await getClientEmail(supabase);
  if (!userEmailNorm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userEmailNorm;
  const body = await req.json();
  const { tag_id, client_start_date, client_end_date, selected_hunt_code } = body;

  if (!tag_id) {
    return NextResponse.json({ error: "tag_id is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Get client record (case-insensitive email so web and iOS match)
  const { data: client } = await admin
    .from("clients")
    .select("id, first_name, last_name")
    .ilike("email", userEmailNorm)
    .limit(1)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter
  const { data: links } = await admin
    .from("client_outfitter_links")
    .select("outfitter_id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .limit(1);

  if (!links || links.length === 0) {
    return NextResponse.json({ error: "Not linked to any outfitter" }, { status: 403 });
  }

  const outfitterId = links[0].outfitter_id;

  // Get the tag (use admin so we find it even if outfitter_id was null or RLS would hide it)
  const { data: tag, error: tagError } = await admin
    .from("private_land_tags")
    .select("*")
    .eq("id", tag_id)
    .single();

  if (tagError || !tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  if (!tag.is_available) {
    return NextResponse.json({ error: "This tag is no longer available" }, { status: 400 });
  }

  // Use service-role for writes; admin already declared above for tag fetch
  // Mark tag as unavailable (sold) and set outfitter + client_email so "my tags" shows it
  const { error: updateTagError } = await admin
    .from("private_land_tags")
    .update({
      is_available: false,
      client_email: (userEmail || "").trim(),
      outfitter_id: outfitterId,
    })
    .eq("id", tag_id);

  if (updateTagError) {
    console.error("Update tag error:", updateTagError);
    return NextResponse.json({ error: "Failed to reserve tag" }, { status: 500 });
  }

  // DO NOT create calendar event here - admin will create/assign it from calendar page
  // Just mark tag as sold and create contract (contract will be linked to calendar event later by admin)
  
  // Create hunt contract directly (without calendar event) - admin will assign to calendar later
  // Contract needs: client_email, outfitter_id, tag info
  const clientName = client.first_name && client.last_name
    ? `${client.first_name} ${client.last_name}`
    : userEmail;

  const isPrivateLand = tag.tag_type === "private_land";
  const isUnitWide = tag.tag_type === "unit_wide";
  const options = (tag.hunt_code_options || "").split(",").map((c: string) => c.trim()).filter(Boolean);
  let huntCode: string | null;
  if (isUnitWide && options.length > 0) {
    if (!selected_hunt_code || !options.includes(selected_hunt_code)) {
      return NextResponse.json(
        { error: "Unit-wide tag: please choose one of the hunt code options. Valid: " + options.join(", ") },
        { status: 400 }
      );
    }
    huntCode = selected_hunt_code;
  } else {
    huntCode = isPrivateLand ? (tag.hunt_code || null) : (tag.hunt_code || null);
  }

  // Get hunt window dates if hunt code exists
  let huntWindowStart: string | null = null;
  let huntWindowEnd: string | null = null;
  if (huntCode) {
    const { getHuntCodeByCode } = await import("@/lib/hunt-codes-server");
    const codeRow = getHuntCodeByCode(huntCode);
    if (codeRow?.start_date && codeRow?.end_date) {
      huntWindowStart = new Date(codeRow.start_date + "T00:00:00Z").toISOString();
      huntWindowEnd = new Date(codeRow.end_date + "T23:59:59Z").toISOString();
    }
  }

  // Determine dates from client input or hunt window
  let startTimeIso: string | null = null;
  let endTimeIso: string | null = null;
  if (client_start_date && client_end_date) {
    startTimeIso = new Date(client_start_date + "T00:00:00Z").toISOString();
    endTimeIso = new Date(client_end_date + "T23:59:59Z").toISOString();
  } else if (huntWindowStart && huntWindowEnd) {
    startTimeIso = huntWindowStart;
    endTimeIso = huntWindowEnd;
  }

  // Create contract directly (no calendar event yet - admin will create/assign from calendar)
  const contractContent = `HUNT CONTRACT\n\n` +
    `Client: ${clientName}\n` +
    `Email: ${userEmail}\n\n` +
    `Tag: ${tag.tag_name}\n` +
    `Species: ${tag.species || "Not specified"}\n` +
    `Unit: ${tag.unit || "Not specified"}\n` +
    `${huntCode ? `Hunt Code: ${huntCode}\n` : ""}` +
    `${startTimeIso ? `Start Date: ${new Date(startTimeIso).toISOString().slice(0, 10)}\n` : ""}` +
    `${endTimeIso ? `End Date: ${new Date(endTimeIso).toISOString().slice(0, 10)}\n` : ""}\n` +
    `This contract is for a private land tag hunt. Complete your booking to add guide fees and dates, then sign the contract.\n\n` +
    `Generated: ${new Date().toISOString().slice(0, 10)}`;

  const clientCompletionData: Record<string, unknown> = {
    tag_id: tag_id,
    tag_name: tag.tag_name,
    species: tag.species,
    unit: tag.unit,
    hunt_code: huntCode,
    private_land_tag_id: tag_id,
  };
  if (startTimeIso) clientCompletionData.client_start_date = new Date(startTimeIso).toISOString().slice(0, 10);
  if (endTimeIso) clientCompletionData.client_end_date = new Date(endTimeIso).toISOString().slice(0, 10);
  if (huntWindowStart) clientCompletionData.hunt_window_start = huntWindowStart;
  if (huntWindowEnd) clientCompletionData.hunt_window_end = huntWindowEnd;

  const { data: contract, error: contractError } = await admin
    .from("hunt_contracts")
    .insert({
      outfitter_id: outfitterId,
      hunt_id: null, // No calendar event yet - admin will assign from calendar page
      client_email: userEmail,
      client_name: clientName,
      content: contractContent,
      status: "pending_client_completion",
      client_completion_data: clientCompletionData,
    })
    .select("id, status")
    .single();

  if (contractError) {
    console.error("Contract creation error:", contractError);
    await admin
      .from("private_land_tags")
      .update({ is_available: true, client_email: null })
      .eq("id", tag_id);
    return NextResponse.json(
      {
        error: "Failed to create hunt contract",
        details: contractError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Tag purchased successfully! Complete your booking (guide fee, add-ons, dates) on the next page, then open Documents → Hunt Contract to sign.",
    purchase: {
      tag: {
        id: tag.id,
        species: tag.species,
        unit: tag.unit,
        tag_name: tag.tag_name,
        price: tag.price,
      },
      contract: {
        id: contract.id,
        status: contract.status,
      },
      note: "Your outfitter will assign this hunt to the calendar. Complete your booking to add guide fees and dates.",
    },
    note: "This is a simulated purchase. No actual payment was processed.",
  });
}
