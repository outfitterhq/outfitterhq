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

  // Create a hunt (calendar event) for this tag – auto-fill from tag + hunt code so contract has full details
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

  let startTimeIso: string;
  let endTimeIso: string;
  let huntWindowStart: string | null = null;
  let huntWindowEnd: string | null = null;
  let weaponLabel: string | null = null; // Rifle, Archery, Muzzleloader for display

  if (huntCode) {
    const { getHuntCodeByCode } = await import("@/lib/hunt-codes-server");
    const { weaponDigitToTagType } = await import("@/lib/hunt-codes");
    const codeRow = getHuntCodeByCode(huntCode);
    if (codeRow?.start_date && codeRow?.end_date) {
      huntWindowStart = new Date(codeRow.start_date + "T00:00:00Z").toISOString();
      huntWindowEnd = new Date(codeRow.end_date + "T23:59:59Z").toISOString();
    }
    const parts = huntCode.trim().split("-");
    if (parts.length >= 2 && parts[1]) {
      weaponLabel = weaponDigitToTagType(parts[1]);
    }
  }

  if (client_start_date && client_end_date) {
    startTimeIso = new Date(client_start_date + "T00:00:00Z").toISOString();
    endTimeIso = new Date(client_end_date + "T23:59:59Z").toISOString();
  } else if (huntWindowStart && huntWindowEnd) {
    startTimeIso = huntWindowStart;
    endTimeIso = huntWindowEnd;
  } else {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);
    startTimeIso = startDate.toISOString();
    endTimeIso = endDate.toISOString();
  }

  const clientName = client.first_name && client.last_name
    ? `${client.first_name} ${client.last_name}`
    : userEmail;

  // Calendar weapon: DB uses Rifle, Muzzleloader, Bow (map Archery -> Bow)
  const calendarWeapon =
    weaponLabel === "Archery" ? "Bow" : weaponLabel === "Rifle" ? "Rifle" : weaponLabel === "Muzzleloader" ? "Muzzleloader" : null;

  const title = weaponLabel
    ? `${tag.species} Hunt - ${weaponLabel}`
    : `${tag.species} Hunt - ${clientName}`;

  const insertPayload: Record<string, unknown> = {
    outfitter_id: outfitterId,
    title,
    notes: `${isPrivateLand ? "Private land" : "Unit-wide"} tag purchase: ${tag.tag_name}\n${huntCode ? `Hunt Code: ${huntCode}` : "Hunt code to be set by admin"}`,
    start_time: startTimeIso,
    end_time: endTimeIso,
    client_email: userEmail,
    species: tag.species ?? null,
    unit: tag.unit ?? null,
    status: "Pending",
    audience: "all",
    hunt_type: "private_land",
    tag_status: "confirmed",
    hunt_code: huntCode,
    private_land_tag_id: tag_id,
  };
  if (calendarWeapon) (insertPayload as Record<string, unknown>).weapon = calendarWeapon;
  if (huntWindowStart) insertPayload.hunt_window_start = huntWindowStart;
  if (huntWindowEnd) insertPayload.hunt_window_end = huntWindowEnd;

  const { data: hunt, error: huntError } = await admin
    .from("calendar_events")
    .insert(insertPayload as Record<string, unknown>)
    .select()
    .single();

  if (huntError) {
    console.error("Hunt creation error:", huntError);
    await admin
      .from("private_land_tags")
      .update({ is_available: true, client_email: null })
      .eq("id", tag_id);
    return NextResponse.json(
      {
        error: "Failed to create hunt booking",
        details: huntError.message,
        code: huntError.code,
      },
      { status: 500 }
    );
  }

  // Create hunt contract immediately so client and admin see it (complete-booking will update dates/guide fee later)
  const { contractId, error: contractError } = await createHuntContractIfNeeded(admin, hunt.id);
  if (!contractId) {
    console.warn("[purchase-tag] createHuntContractIfNeeded did not create contract for hunt", hunt.id, contractError);
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
      hunt: {
        id: hunt.id,
        title: hunt.title,
        start_date: hunt.start_time,
        end_date: hunt.end_time,
      },
      contract_generated: Boolean(contractId),
      contract_error: contractError ?? undefined,
      note: contractId
        ? "Your contract is ready. Complete your booking on the next page, then sign it under Documents → Hunt Contract."
        : "Your outfitter will generate the hunt contract.",
    },
    note: "This is a simulated purchase. No actual payment was processed.",
  });
}
