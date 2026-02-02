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
        status
      `)
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("❌ Failed to fetch contract for calendar event:", contractError);
      return;
    }
    
    console.log(`📅 Contract status: ${contract.status}, hunt_id: ${contract.hunt_id || 'none'}`);

    // Get client completion data to extract dates and details
    const completionData = (contract.client_completion_data as any) || {};
    const clientStart = completionData.client_start_date as string | undefined;
    const clientEnd = completionData.client_end_date as string | undefined;
    
    // Also try to get dates from hunt if they exist in the database
    let huntStart: string | undefined = clientStart;
    let huntEnd: string | undefined = clientEnd;
    
    if (contract.hunt_id && (!huntStart || !huntEnd)) {
      const { data: huntEvent } = await supabase
        .from("calendar_events")
        .select("start_time, end_time")
        .eq("id", contract.hunt_id)
        .single();
      if (huntEvent?.start_time && huntEvent?.end_time) {
        huntStart = huntStart || new Date(huntEvent.start_time).toISOString().slice(0, 10);
        huntEnd = huntEnd || new Date(huntEvent.end_time).toISOString().slice(0, 10);
      }
    }

    // If contract has hunt_id, update existing calendar event
    if (contract.hunt_id) {
      const { data: existingEvent, error: eventError } = await supabase
        .from("calendar_events")
        .select("id, title, species, unit, weapon, camp_name, hunt_code")
        .eq("id", contract.hunt_id)
        .single();

      if (existingEvent && !eventError) {
        // Update existing event with dates from contract
        const updateData: any = {
          client_email: contract.client_email,
          tag_status: "confirmed", // Mark as confirmed when contract is signed
        };

        // Update dates if provided in completion data or from hunt
        if (huntStart && huntEnd) {
          const startTimeIso = new Date(huntStart + "T00:00:00Z").toISOString();
          const endTimeIso = new Date(huntEnd + "T23:59:59Z").toISOString();
          updateData.start_time = startTimeIso;
          updateData.end_time = endTimeIso;
        }
        
        // Ensure status is "Booked" when contract is fully executed
        updateData.status = "Booked";

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
    // Extract hunt details from contract content
    const content = contract.content || "";
    const speciesMatch = content.match(/Species:\s*([^\n]+)/i);
    const unitMatch = content.match(/Unit:\s*([^\n]+)/i);
    const weaponMatch = content.match(/Weapon:\s*([^\n]+)/i);
    const huntCodeMatch = content.match(/Hunt Code:\s*([A-Za-z0-9-]+)/i);
    const campMatch = content.match(/Camp:\s*([^\n]+)/i);

    // Determine title
    let title = "Guided Hunt";
    if (speciesMatch) {
      title = `${speciesMatch[1].trim()} Hunt`;
    } else if (huntCodeMatch) {
      title = `Hunt ${huntCodeMatch[1]}`;
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

    // Create new calendar event
    const { data: newEvent, error: insertError } = await supabase
      .from("calendar_events")
      .insert({
        outfitter_id: outfitterId,
        title,
        species: speciesMatch ? speciesMatch[1].trim() : null,
        unit: unitMatch ? unitMatch[1].trim() : null,
        weapon: weaponMatch ? weaponMatch[1].trim() : null,
        hunt_code: huntCodeMatch ? huntCodeMatch[1] : null,
        camp_name: campMatch ? campMatch[1].trim() : null,
        client_email: contract.client_email,
        start_time: startTime,
        end_time: endTime,
        tag_status: "confirmed",
        status: "Booked",
        audience: "all", // Visible to both client and admin
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
    console.log(`   - Client: ${contract.client_email}`);
    console.log(`   - Dates: ${huntStart} to ${huntEnd}`);
    console.log(`   - Status: Booked`);
    console.log(`   - Audience: all (visible to client and admin)`);
  } catch (error) {
    console.error("Error creating/updating calendar event from contract:", error);
  }
}
