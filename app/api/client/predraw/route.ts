import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;

  // Get client record
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter
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

  // Get existing pre-draw submission
  const { data: predraw } = await supabase
    .from("client_predraw_submissions")
    .select("*")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .eq("year", currentYear)
    .single();

  // Get selections if predraw exists
  let selections: any[] = [];
  if (predraw) {
    const { data: sels } = await supabase
      .from("predraw_species_selections")
      .select("*")
      .eq("submission_id", predraw.id)
      .order("choice_index", { ascending: true });
    selections = sels || [];
  }

  return NextResponse.json({
    predraw: predraw || null,
    selections,
  });
}

export async function POST(request: Request) {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;
  const body = await request.json();

  // Get client record
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  // Get linked outfitter
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

  // Prepare predraw data (allow_g3_to_select + species_preferences for iOS parity)
  const predrawData = {
    client_id: client.id,
    outfitter_id: outfitterId,
    year: currentYear,
    nmdgf_username: body.nmdgf_username?.trim() || "",
    height: body.height?.trim() || "",
    weight: body.weight?.trim() || "",
    eye_color: body.eye_color || "",
    hair_color: body.hair_color || "",
    dob: body.dob || "",
    drivers_license_number: body.drivers_license_number?.trim() || "",
    drivers_license_state: body.drivers_license_state?.trim() || "",
    ssn_last4: body.ssn_last4?.trim() || "",
    passport_number: body.passport_number?.trim() || "",
    credit_card_last4: body.credit_card_last4?.trim() || "",
    exp_mm: body.exp_mm?.trim() || "",
    exp_yyyy: body.exp_yyyy?.trim() || "",
    elk_comments: body.elk_comments?.trim() || "",
    deer_comments: body.deer_comments?.trim() || "",
    antelope_comments: body.antelope_comments?.trim() || "",
    submit_choice: body.submit_choice || "authorize_g3",
    acknowledged_contract: body.acknowledged_contract || false,
    allow_g3_to_select: body.allow_g3_to_select ?? false,
    species_preferences: body.species_preferences ?? {},
    submitted_at: new Date().toISOString(),
  };

  // Upsert predraw submission
  const { data: predraw, error: upsertError } = await supabase
    .from("client_predraw_submissions")
    .upsert(predrawData, {
      onConflict: "client_id,outfitter_id,year",
    })
    .select()
    .single();

  if (upsertError) {
    console.error("Upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to save pre-draw" }, { status: 500 });
  }

  // Delete existing selections and insert new ones
  await supabase
    .from("predraw_species_selections")
    .delete()
    .eq("submission_id", predraw.id);

  if (body.selections && body.selections.length > 0) {
    const filtered = body.selections.filter((sel: any) => (sel.codeOrUnit || "").trim() !== "");
    // Reject duplicate hunt codes within the same species (clients cannot choose the same hunt code twice)
    const codesBySpecies: Record<string, string[]> = {};
    for (const sel of filtered) {
      const species = (sel.species || "").trim();
      const code = (sel.codeOrUnit || "").trim();
      if (!species || !code) continue;
      codesBySpecies[species] = codesBySpecies[species] || [];
      if (codesBySpecies[species].includes(code)) {
        return NextResponse.json(
          { error: "Duplicate hunt code: you cannot select the same hunt code more than once per species." },
          { status: 400 }
        );
      }
      codesBySpecies[species].push(code);
    }

    const selectionsData = filtered.map((sel: any, idx: number) => ({
      submission_id: predraw.id,
      species: sel.species || "",
      weapon: sel.weapon || "Any",
      code_or_unit: sel.codeOrUnit || "",
      dates: sel.dates || "",
      choice_index: typeof sel.choiceIndex === "number" ? sel.choiceIndex : idx + 1,
    }));

    const { error: selectionsError } = await supabase
      .from("predraw_species_selections")
      .insert(selectionsData);

    if (selectionsError) {
      console.error("Selections error:", selectionsError);
      // Don't fail the whole request, just log
    }
  }

  return NextResponse.json({
    success: true,
    predraw,
  });
}
