import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * PATCH: Update hunt tag status (admin only)
 * This is the TRIGGER for contract generation:
 * - Setting tag_status to 'drawn' (for draw hunts)
 * - Setting tag_status to 'confirmed' (for private land hunts)
 * 
 * The database trigger will automatically generate a hunt contract
 * when the tag_status changes to one of these values.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const { tag_status } = body;

    if (!tag_status) {
      return NextResponse.json({ error: "tag_status is required" }, { status: 400 });
    }

    const validStatuses = ["pending", "applied", "drawn", "unsuccessful", "confirmed"];
    if (!validStatuses.includes(tag_status)) {
      return NextResponse.json(
        { error: `Invalid tag_status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Get current hunt to verify it exists and has a client
    const { data: hunt, error: fetchErr } = await supabase
      .from("calendar_events")
      .select("id, client_email, hunt_type, tag_status, contract_generated_at")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (fetchErr || !hunt) {
      return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
    }

    // Warn if no client assigned and trying to trigger contract generation
    if (!hunt.client_email && ["drawn", "confirmed"].includes(tag_status)) {
      return NextResponse.json(
        { 
          error: "Cannot mark tag as drawn/confirmed without a client assigned to the hunt",
          hint: "Assign a client to this hunt first"
        },
        { status: 400 }
      );
    }

    // Update tag status (this triggers the database function for contract generation)
    const { data, error } = await supabase
      .from("calendar_events")
      .update({ tag_status })
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if contract was generated
    const { data: contract } = await supabase
      .from("hunt_contracts")
      .select("id, status")
      .eq("hunt_id", id)
      .single();

    const response: any = {
      hunt: data,
      tag_status_updated: true,
    };

    if (contract) {
      response.contract_generated = true;
      response.contract = contract;
    } else if (["drawn", "confirmed"].includes(tag_status)) {
      response.contract_generated = false;
      response.hint = "Contract was not generated. Ensure a contract template exists for this outfitter.";
    }

    return NextResponse.json(response, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * GET: Get current tag status and contract state for a hunt
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get hunt with tag info (calendar_events uses start_time/end_time)
    const { data: hunt, error: huntErr } = await supabase
      .from("calendar_events")
      .select("id, title, client_email, guide_username, hunt_type, tag_status, contract_generated_at, species, unit, hunt_code, start_time, end_time")
      .eq("id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (huntErr || !hunt) {
      return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
    }

    // Get associated contract if exists
    const { data: contract } = await supabase
      .from("hunt_contracts")
      .select("id, status, client_completed_at, docusign_status, client_signed_at, admin_signed_at")
      .eq("hunt_id", id)
      .single();

    return NextResponse.json({
      hunt,
      contract: contract || null,
      workflow_state: getWorkflowState(hunt, contract),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * Helper: Determine the current workflow state
 */
function getWorkflowState(hunt: any, contract: any) {
  if (!hunt.client_email) {
    return {
      step: 0,
      label: "No Client",
      description: "Assign a client to this hunt to proceed",
      next_action: "assign_client",
    };
  }

  if (hunt.tag_status === "pending" || hunt.tag_status === "applied") {
    return {
      step: 1,
      label: "Awaiting Tag",
      description: hunt.hunt_type === "draw" 
        ? "Waiting for draw results" 
        : "Waiting for private land tag confirmation",
      next_action: hunt.hunt_type === "draw" ? "mark_drawn" : "mark_confirmed",
    };
  }

  if (hunt.tag_status === "unsuccessful") {
    return {
      step: -1,
      label: "Unsuccessful Draw",
      description: "Client did not draw a tag",
      next_action: null,
    };
  }

  if (!contract) {
    if (hunt.hunt_type === "private_land") {
      return {
        step: 2,
        label: "Generate contract",
        description: "Client purchased tag. Set hunt code and dates, then generate the hunt contract.",
        next_action: "generate_contract",
      };
    }
    return {
      step: 2,
      label: "Contract Pending",
      description: "Tag confirmed but contract not generated. Check template.",
      next_action: "create_template",
    };
  }

  if (contract.status === "pending_client_completion") {
    return {
      step: 3,
      label: "Awaiting Client",
      description: "Contract sent to client for completion",
      next_action: "wait_for_client",
    };
  }

  if (contract.status === "ready_for_signature") {
    return {
      step: 4,
      label: "Ready for DocuSign",
      description: "Client completed contract, ready to send for signatures",
      next_action: "send_docusign",
    };
  }

  if (contract.status === "sent_to_docusign" || contract.status === "client_signed") {
    return {
      step: 5,
      label: "Awaiting Signatures",
      description: `DocuSign status: ${contract.docusign_status}`,
      next_action: "wait_for_signatures",
    };
  }

  if (contract.status === "fully_executed") {
    return {
      step: 6,
      label: "Complete",
      description: "Contract fully executed",
      next_action: null,
    };
  }

  return {
    step: null,
    label: contract.status,
    description: "Unknown state",
    next_action: null,
  };
}
