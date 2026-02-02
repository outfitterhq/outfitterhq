import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * POST: Assign a contract to a calendar event (or create new event from contract)
 * Body: { contract_id: string, hunt_id?: string (optional - if creating new event, omit this) }
 * If hunt_id is provided, links contract to existing event
 * If hunt_id is not provided, creates new calendar event from contract data
 */
export async function POST(req: Request) {
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

    // Verify admin role
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("outfitter_id", outfitterId)
      .eq("user_id", userRes.user.id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { contract_id, hunt_id } = body;

    if (!contract_id) {
      return NextResponse.json({ error: "contract_id is required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Get contract details
    const { data: contract, error: contractError } = await admin
      .from("hunt_contracts")
      .select("id, client_email, client_completion_data, content, status, outfitter_id")
      .eq("id", contract_id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (contractError || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Get client name
    let clientName: string | null = null;
    if (contract.client_email) {
      const { data: clientData } = await admin
        .from("clients")
        .select("first_name, last_name")
        .eq("email", contract.client_email)
        .maybeSingle();
      if (clientData?.first_name || clientData?.last_name) {
        clientName = [clientData.first_name, clientData.last_name].filter(Boolean).join(" ") || null;
      }
    }

    const completionData = (contract.client_completion_data as any) || {};
    const species = completionData.species || null;
    const unit = completionData.unit || null;
    const weapon = completionData.weapon || null;
    const huntCode = completionData.hunt_code || null;
    const camp = completionData.camp_name || null;
    const clientStart = completionData.client_start_date as string | undefined;
    const clientEnd = completionData.client_end_date as string | undefined;

    // Determine dates
    let startTime: string;
    let endTime: string;
    if (clientStart && clientEnd) {
      startTime = new Date(clientStart + "T00:00:00Z").toISOString();
      endTime = new Date(clientEnd + "T23:59:59Z").toISOString();
    } else {
      // Default: start today, end in 7 days
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      startTime = today.toISOString();
      endTime = end.toISOString();
    }

    // Determine title
    let title = "Guided Hunt";
    if (species) {
      title = `${species} Hunt`;
    } else if (huntCode) {
      title = `Hunt ${huntCode}`;
    }

    if (hunt_id) {
      // Link contract to existing calendar event
      const { error: updateError } = await admin
        .from("hunt_contracts")
        .update({ hunt_id })
        .eq("id", contract_id)
        .eq("outfitter_id", outfitterId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Update calendar event with contract data
      const updateData: any = {
        client_email: contract.client_email,
        species: species,
        unit: unit,
        weapon: weapon,
        hunt_code: huntCode,
        camp_name: camp,
        start_time: startTime,
        end_time: endTime,
        status: "Pending", // Admin needs to assign guide
        audience: "internalOnly", // Only visible to admin until guide assigned
      };

      if (clientName) {
        updateData.notes = `Client: ${clientName}\nEmail: ${contract.client_email}${species ? `\nSpecies: ${species}` : ""}${weapon ? `\nWeapon: ${weapon}` : ""}${camp ? `\nCamp: ${camp}` : ""}`;
      }

      const { error: eventUpdateError } = await admin
        .from("calendar_events")
        .update(updateData)
        .eq("id", hunt_id)
        .eq("outfitter_id", outfitterId);

      if (eventUpdateError) {
        return NextResponse.json({ error: eventUpdateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Contract linked to calendar event",
        contract_id: contract_id,
        hunt_id: hunt_id,
      });
    } else {
      // Create new calendar event from contract
      const { data: newEvent, error: insertError } = await admin
        .from("calendar_events")
        .insert({
          outfitter_id: outfitterId,
          title,
          species: species,
          unit: unit,
          weapon: weapon,
          hunt_code: huntCode,
          camp_name: camp,
          client_email: contract.client_email,
          start_time: startTime,
          end_time: endTime,
          status: "Pending", // Admin needs to assign guide
          audience: "internalOnly", // Only visible to admin until guide assigned
          tag_status: "confirmed",
          notes: clientName 
            ? `Client: ${clientName}\nEmail: ${contract.client_email}${species ? `\nSpecies: ${species}` : ""}${weapon ? `\nWeapon: ${weapon}` : ""}${camp ? `\nCamp: ${camp}` : ""}`
            : `Email: ${contract.client_email}${species ? `\nSpecies: ${species}` : ""}${weapon ? `\nWeapon: ${weapon}` : ""}${camp ? `\nCamp: ${camp}` : ""}`,
        })
        .select("id")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Link contract to new calendar event
      const { error: linkError } = await admin
        .from("hunt_contracts")
        .update({ hunt_id: newEvent.id })
        .eq("id", contract_id)
        .eq("outfitter_id", outfitterId);

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Calendar event created and linked to contract",
        contract_id: contract_id,
        hunt_id: newEvent.id,
      });
    }
  } catch (e: any) {
    console.error("Assign contract to calendar error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
