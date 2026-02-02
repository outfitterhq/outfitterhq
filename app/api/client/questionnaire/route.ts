import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function GET() {
  console.log("🔵 GET /api/client/questionnaire called");
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log("🔵 Auth user:", userData?.user?.email, "Error:", userError?.message);
  
  if (userError || !userData.user) {
    console.log("❌ Not authenticated");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;
  console.log("🔵 Looking for client with email:", userEmail);

  // Get client record
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  console.log("🔵 Client lookup result:", client, "Error:", clientError?.message);

  if (clientError || !client) {
    console.log("❌ Client not found for email:", userEmail);
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

  // Get existing questionnaire
  const { data: questionnaire, error: questError } = await supabase
    .from("client_questionnaires")
    .select("*")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .single();

  if (questError && questError.code !== "PGRST116") {
    // PGRST116 = no rows found, which is fine
    console.error("Questionnaire error:", questError);
    return NextResponse.json({ error: "Failed to load questionnaire" }, { status: 500 });
  }

  return NextResponse.json({
    questionnaire: questionnaire || null,
  });
}

export async function POST(request: Request) {
  console.log("🔵 POST /api/client/questionnaire called");
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;
  const body = await request.json();

  // Validate required fields
  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!body.contact_phone?.trim()) {
    return NextResponse.json({ error: "Contact phone is required" }, { status: 400 });
  }
  if (!body.email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Get client record
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (clientError || !client) {
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

  // Upsert questionnaire (insert or update if exists)
  const questionnaireData = {
    client_id: client.id,
    outfitter_id: outfitterId,
    full_name: body.full_name?.trim() || "",
    mailing_address: body.mailing_address?.trim() || "",
    contact_phone: body.contact_phone?.trim() || "",
    email: body.email?.trim() || "",
    dob: body.dob || null,
    emergency_contact_name: body.emergency_contact_name?.trim() || "",
    emergency_contact_phone: body.emergency_contact_phone?.trim() || "",
    global_rescue_member_number: body.global_rescue_member_number?.trim() || "",
    food_allergies: body.food_allergies?.trim() || "",
    food_preferences: body.food_preferences?.trim() || "",
    drink_preferences: body.drink_preferences?.trim() || "",
    specific_accommodation: body.specific_accommodation?.trim() || "",
    physical_limitations: body.physical_limitations?.trim() || "",
    health_concerns: body.health_concerns?.trim() || "",
    general_notes: body.general_notes?.trim() || "",
    submitted_at: new Date().toISOString(),
  };

  console.log("📝 Saving questionnaire for client:", client.id, "outfitter:", outfitterId);
  console.log("📝 Questionnaire data:", JSON.stringify(questionnaireData, null, 2));

  const { data: questionnaire, error: upsertError } = await supabase
    .from("client_questionnaires")
    .upsert(questionnaireData, {
      onConflict: "client_id,outfitter_id",
    })
    .select()
    .single();

  if (upsertError) {
    console.error("❌ Upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to save questionnaire: " + upsertError.message }, { status: 500 });
  }

  console.log("✅ Questionnaire saved successfully:", questionnaire?.id);

  return NextResponse.json({
    success: true,
    questionnaire,
  });
}
