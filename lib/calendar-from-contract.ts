import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create or update a calendar event when a hunt contract is fully executed (both parties signed).
 * This ensures the hunt appears in both client and admin calendars.
 */
export async function createOrUpdateCalendarEventFromContract(
  supabase: SupabaseClient<any>,
  contractId: string,
  outfitterId: string
) {
  try {
    console.log(`📅 Creating/updating calendar event for contract ${contractId}`);
    
    // Get the contract with all needed details
    const { data: contract, error: contractError } = await supabase
      .from("hunt_contracts")
      .select(`
        id,
        hunt_id,
        client_email,
        client_completion_data,
        content,
        status,
        client_signed_at,
        admin_signed_at
      `)
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("❌ Failed to fetch contract for calendar event:", contractError);
      return;
    }
    
    console.log(`📅 Contract status: ${contract.status}, hunt_id: ${contract.hunt_id || 'none'}`);
    
    // Also check if contract has both signatures (even if status isn't fully_executed yet)
    const { data: contractWithSignatures } = await supabase
      .from("hunt_contracts")
      .select("client_signed_at, admin_signed_at")
      .eq("id", contractId)
      .single();
    
    const bothSigned = contractWithSignatures?.client_signed_at && contractWithSignatures?.admin_signed_at;
    console.log(`📅 Both signatures present: ${bothSigned}`);
    
    // Create event if contract is fully_executed OR if both parties have signed
    if (contract.status !== "fully_executed" && !bothSigned) {
      console.log(`⚠️ Contract not fully executed and both parties haven't signed. Skipping calendar event.`);
      return;
    }
    
    if (bothSigned && contract.status !== "fully_executed") {
      console.log(`📅 Both parties signed but status is ${contract.status}. Creating calendar event anyway.`);
    }

    // Get client completion data to extract dates and details
    const completionData = (contract.client_completion_data as any) || {};
    const clientStart = completionData.client_start_date as string | undefined;
    const clientEnd = completionData.client_end_date as string | undefined;
    const completionSpecies = completionData.species as string | undefined;
    const completionWeapon = completionData.weapon as string | undefined;
    const completionUnit = completionData.unit as string | undefined;
    const completionHuntCode = completionData.hunt_code as string | undefined;
    const completionCamp = completionData.camp_name as string | undefined;
    
    // Also try to get dates from hunt if they exist in the database
    let huntStart: string | undefined = clientStart;
    let huntEnd: string | undefined = clientEnd;
    
    // Try to get dates from linked hunt event
    if (contract.hunt_id) {
      const { data: huntEvent } = await supabase
        .from("calendar_events")
        .select("start_time, end_time, species, unit, weapon, hunt_code, camp_name")
        .eq("id", contract.hunt_id)
        .single();
      if (huntEvent?.start_time && huntEvent?.end_time) {
        huntStart = huntStart || new Date(huntEvent.start_time).toISOString().slice(0, 10);
        huntEnd = huntEnd || new Date(huntEvent.end_time).toISOString().slice(0, 10);
        console.log(`📅 Found dates from hunt event: ${huntStart} to ${huntEnd}`);
      }
    }
    
    // If still no dates, try extracting from contract content
    if (!huntStart || !huntEnd) {
      const dateMatch = contract.content?.match(/Dates?:\s*([^\n]+)/i);
      if (dateMatch) {
        const dateStr = dateMatch[1].trim();
        // Try to parse date range like "Jan 15, 2024 – Jan 20, 2024" or "2024-01-15 to 2024-01-20"
        const rangeMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})[^\d]*(\d{4}-\d{2}-\d{2})/);
        if (rangeMatch) {
          huntStart = rangeMatch[1];
          huntEnd = rangeMatch[2];
          console.log(`📅 Extracted dates from contract content: ${huntStart} to ${huntEnd}`);
        }
      }
    }

    // If contract has hunt_id, update existing calendar event
    if (contract.hunt_id) {
      const { data: existingEvent, error: eventError } = await supabase
        .from("calendar_events")
        .select("id, title, species, unit, weapon, camp_name, hunt_code, client_email, start_time, end_time")
        .eq("id", contract.hunt_id)
        .single();

      if (existingEvent && !eventError) {
        console.log(`📅 Updating existing calendar event ${contract.hunt_id}`);
        console.log(`   Current: client_email=${existingEvent.client_email}, status=${(existingEvent as any).status}`);
        
        // Get client name from clients table
        let clientName: string | null = null;
        if (contract.client_email) {
          const { data: clientData } = await supabase
            .from("clients")
            .select("first_name, last_name")
            .eq("email", contract.client_email)
            .maybeSingle();
          if (clientData?.first_name || clientData?.last_name) {
            clientName = [clientData.first_name, clientData.last_name].filter(Boolean).join(" ") || null;
          }
        }

        // Update existing event with dates from contract
        // If event doesn't have guide assigned yet, keep status as "Pending"
        const needsSetup = !existingEvent.guide_username;
        const updateData: any = {
          client_email: contract.client_email, // Ensure client_email is set
          tag_status: "confirmed", // Mark as confirmed when contract is signed
          status: needsSetup ? "Pending" : "Booked", // Keep as "Pending" if guide not assigned
          audience: needsSetup ? "internalOnly" : "all", // Only show to admin until setup complete
        };

        // Update notes with client info
        if (clientName) {
          updateData.notes = existingEvent.notes 
            ? `${existingEvent.notes}\n\nClient: ${clientName}\nEmail: ${contract.client_email}`
            : `Client: ${clientName}\nEmail: ${contract.client_email}`;
        }

        // Update dates if provided in completion data or from hunt
        if (huntStart && huntEnd) {
          const startTimeIso = new Date(huntStart + "T00:00:00Z").toISOString();
          const endTimeIso = new Date(huntEnd + "T23:59:59Z").toISOString();
          updateData.start_time = startTimeIso;
          updateData.end_time = endTimeIso;
          console.log(`   Updating dates: ${huntStart} to ${huntEnd}`);
        } else if (existingEvent.start_time && existingEvent.end_time) {
          // Keep existing dates if no new dates provided
          console.log(`   Keeping existing dates: ${existingEvent.start_time} to ${existingEvent.end_time}`);
        }

        const { error: updateError } = await supabase
          .from("calendar_events")
          .update(updateData)
          .eq("id", contract.hunt_id);

        if (updateError) {
          console.error("❌ Failed to update calendar event:", updateError);
        } else {
          console.log(`✅ Updated calendar event ${contract.hunt_id} from contract ${contractId}`);
          console.log(`   - Client: ${contract.client_email}`);
          console.log(`   - Dates: ${huntStart} to ${huntEnd}`);
          console.log(`   - Status: Booked`);
        }
        return;
      }
    }

    // If no hunt_id or event doesn't exist, create new calendar event
    // Extract hunt details from contract content AND completion_data (completion_data takes priority)
    const content = contract.content || "";
    
    // Prefer completion_data over content parsing
    const species = completionSpecies || content.match(/Species:\s*([^\n]+)/i)?.[1]?.trim() || null;
    const unit = completionUnit || content.match(/Unit:\s*([^\n]+)/i)?.[1]?.trim() || null;
    const weapon = completionWeapon || content.match(/Weapon:\s*([^\n]+)/i)?.[1]?.trim() || null;
    const huntCode = completionHuntCode || content.match(/Hunt Code:\s*([A-Za-z0-9-]+)/i)?.[1] || null;
    const camp = completionCamp || content.match(/Camp:\s*([^\n]+)/i)?.[1]?.trim() || null;

    // Determine title
    let title = "Guided Hunt";
    if (species) {
      title = `${species} Hunt`;
    } else if (huntCode) {
      title = `Hunt ${huntCode}`;
    }

    // Use dates from completion data, hunt, or default to today + 7 days
    let startTime: string;
    let endTime: string;
    if (huntStart && huntEnd) {
      startTime = new Date(huntStart + "T00:00:00Z").toISOString();
      endTime = new Date(huntEnd + "T23:59:59Z").toISOString();
    } else {
      // Default: start today, end in 7 days
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      startTime = today.toISOString();
      endTime = end.toISOString();
    }

    // Get client name from clients table
    let clientName: string | null = null;
    if (contract.client_email) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("first_name, last_name")
        .eq("email", contract.client_email)
        .maybeSingle();
      if (clientData?.first_name || clientData?.last_name) {
        clientName = [clientData.first_name, clientData.last_name].filter(Boolean).join(" ") || null;
      }
    }

    // Create new calendar event with status "Pending" - admin needs to fill in guide, cook, etc.
    // Client can only see it when status is "Booked" and all required fields are filled
    const { data: newEvent, error: insertError } = await supabase
      .from("calendar_events")
      .insert({
        outfitter_id: outfitterId,
        title: title || "Guided Hunt",
        species: species,
        unit: unit,
        weapon: weapon,
        hunt_code: huntCode,
        camp_name: camp,
        client_email: contract.client_email,
        start_time: startTime,
        end_time: endTime,
        tag_status: "confirmed",
        status: "Pending", // Start as "Pending" - admin needs to complete setup (assign guide, cook, etc.)
        audience: "internalOnly", // Only visible to admin until setup is complete
        notes: clientName 
          ? `Client: ${clientName}\nEmail: ${contract.client_email}${species ? `\nSpecies: ${species}` : ""}${weapon ? `\nWeapon: ${weapon}` : ""}${camp ? `\nCamp: ${camp}` : ""}`
          : `Email: ${contract.client_email}${species ? `\nSpecies: ${species}` : ""}${weapon ? `\nWeapon: ${weapon}` : ""}${camp ? `\nCamp: ${camp}` : ""}`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Failed to create calendar event:", insertError);
      return;
    }

    // Link the new event to the contract
    await supabase
      .from("hunt_contracts")
      .update({ hunt_id: newEvent.id })
      .eq("id", contractId);

    console.log(`✅ Created calendar event ${newEvent.id} from contract ${contractId}`);
    console.log(`   - Title: ${title}`);
    console.log(`   - Client: ${contract.client_email}${clientName ? ` (${clientName})` : ""}`);
    console.log(`   - Dates: ${huntStart} to ${huntEnd}`);
    console.log(`   - Species: ${speciesMatch ? speciesMatch[1].trim() : "Not set"}`);
    console.log(`   - Weapon: ${weaponMatch ? weaponMatch[1].trim() : "Not set"}`);
    console.log(`   - Camp: ${campMatch ? campMatch[1].trim() : "Not set"}`);
    console.log(`   - Status: Pending (admin needs to assign guide/cook)`);
    console.log(`   - Audience: internalOnly (only visible to admin until setup complete)`);
  } catch (error) {
    console.error("Error creating/updating calendar event from contract:", error);
  }
}
