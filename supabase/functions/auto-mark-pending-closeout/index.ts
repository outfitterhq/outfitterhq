// Edge Function: Auto-mark hunts as "Pending Closeout" when they end
// This should be called via a cron job or scheduled task

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[auto-mark-pending-closeout] Starting check for ended hunts...");

    // Find all hunts that have ended but haven't been closed out
    const now = new Date().toISOString();
    
    const { data: endedHunts, error: queryError } = await supabase
      .from("calendar_events")
      .select("id, title, end_time, status, guide_username, outfitter_id")
      .in("status", ["Booked", "In Progress", "Completed"])
      .lt("end_time", now)
      .is("hunt_closeouts.hunt_id", null); // No closeout exists yet

    if (queryError) {
      console.error("[auto-mark-pending-closeout] Query error:", queryError);
      // Try alternative query without the join
      const { data: allEndedHunts, error: altError } = await supabase
        .from("calendar_events")
        .select("id, title, end_time, status, guide_username, outfitter_id")
        .in("status", ["Booked", "In Progress", "Completed"])
        .lt("end_time", now);

      if (altError) {
        throw altError;
      }

      // Filter out hunts that already have closeouts
      const { data: existingCloseouts } = await supabase
        .from("hunt_closeouts")
        .select("hunt_id");

      const closeoutHuntIds = new Set((existingCloseouts || []).map((c: any) => c.hunt_id));
      const endedHunts = (allEndedHunts || []).filter((h: any) => !closeoutHuntIds.has(h.id));
    }

    if (!endedHunts || endedHunts.length === 0) {
      console.log("[auto-mark-pending-closeout] No hunts need to be marked as pending closeout");
      return new Response(
        JSON.stringify({ 
          message: "No hunts need to be marked",
          checked: now,
          updated: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[auto-mark-pending-closeout] Found ${endedHunts.length} hunts that need closeout`);

    // Update each hunt to "Pending Closeout" status
    const huntIds = endedHunts.map((h: any) => h.id);
    
    const { data: updatedHunts, error: updateError } = await supabase
      .from("calendar_events")
      .update({ 
        status: "Pending Closeout",
        updated_at: now
      })
      .in("id", huntIds)
      .select("id, title");

    if (updateError) {
      console.error("[auto-mark-pending-closeout] Update error:", updateError);
      throw updateError;
    }

    console.log(`[auto-mark-pending-closeout] Successfully marked ${updatedHunts?.length || 0} hunts as pending closeout`);

    return new Response(
      JSON.stringify({
        message: `Marked ${updatedHunts?.length || 0} hunts as pending closeout`,
        checked: now,
        updated: updatedHunts?.length || 0,
        hunts: updatedHunts
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[auto-mark-pending-closeout] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
