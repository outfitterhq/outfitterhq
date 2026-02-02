import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET: Get meal information for all clients in a camp
 * Accessible by cooks assigned to the camp
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campId: string }> }
) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { campId } = await params;

    // Verify cook is assigned to this camp
    // First, find cook profile by email or user_id
    const { data: cookProfile } = await supabase
      .from("cook_profiles")
      .select("id, outfitter_id")
      .or(`contact_email.eq.${userRes.user.email}`)
      .maybeSingle();

    if (!cookProfile) {
      return NextResponse.json({ error: "Cook profile not found" }, { status: 404 });
    }

    // Check if cook is assigned to this camp
    const { data: assignment } = await supabase
      .from("cook_camp_assignments")
      .select("camp_id")
      .eq("cook_id", cookProfile.id)
      .eq("camp_id", campId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: "Not assigned to this camp" }, { status: 403 });
    }

    // Get camp info
    const { data: camp } = await supabase
      .from("camps")
      .select("id, name, start_date, end_date")
      .eq("id", campId)
      .single();

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // Get all clients assigned to this camp
    const { data: clientAssignments } = await supabase
      .from("camp_client_assignments")
      .select(`
        client:clients(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("camp_id", campId);

    const clientIds = (clientAssignments || [])
      .map((ca) => (Array.isArray(ca.client) ? ca.client[0]?.id : (ca.client as { id?: string } | null)?.id))
      .filter(Boolean) as string[];

    if (clientIds.length === 0) {
      return NextResponse.json({
        camp,
        clients: [],
        meal_info: [],
      });
    }

    // Get questionnaires for these clients (meal sections only)
    const { data: questionnaires } = await supabase
      .from("client_questionnaires")
      .select(`
        id,
        client_id,
        full_name,
        email,
        food_allergies,
        food_preferences,
        general_notes
      `)
      .in("client_id", clientIds);

    // Map to meal info format
    const mealInfo = (questionnaires || []).map((q) => ({
      client_id: q.client_id,
      client_name: q.full_name || q.email || "Unknown",
      email: q.email,
      food_allergies: q.food_allergies || "None",
      food_preferences: q.food_preferences || "None",
      notes: q.general_notes || "",
    }));

    return NextResponse.json({
      camp: {
        id: camp.id,
        name: camp.name,
        start_date: camp.start_date,
        end_date: camp.end_date,
      },
      clients: (clientAssignments || []).map((ca) => ca.client),
      meal_info: mealInfo,
      total_clients: clientIds.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
