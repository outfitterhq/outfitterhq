import { NextResponse } from "next/server";
import { supabaseRoute, supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseRoute();

  // Use getSession() to avoid "permission denied for table users" (RLS on clients/links can reference auth.users)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = (session.user.email || "").toLowerCase().trim();
  const admin = supabaseAdmin();

  // Get client record (case-insensitive email so Client@Example.com matches client@example.com)
  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id")
    .ilike("email", userEmail)
    .limit(1)
    .maybeSingle();

  if (clientError || !client) {
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
  const currentYear = new Date().getFullYear();

  // Get questionnaire status
  const { data: questionnaire } = await admin
    .from("client_questionnaires")
    .select("id, submitted_at")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .single();

  // Get pre-draw status
  const { data: predraw } = await admin
    .from("client_predraw_submissions")
    .select("id, docusign_status, submitted_at")
    .eq("client_id", client.id)
    .eq("outfitter_id", outfitterId)
    .eq("year", currentYear)
    .single();

  // Get waiver status from documents table
  const { data: waiverDoc } = await admin
    .from("documents")
    .select("id, status, client_signed_at")
    .eq("linked_id", userEmail)
    .eq("outfitter_id", outfitterId)
    .eq("document_type", "waiver")
    .single();

  // Get contract status from documents table
  const { data: contractDoc } = await admin
    .from("documents")
    .select("id, status, client_signed_at")
    .eq("linked_id", userEmail)
    .eq("outfitter_id", outfitterId)
    .eq("document_type", "contract")
    .single();

  // Per-hunt: list each hunt contract for this client (admin + explicit hunt fetch so all statuses show after admin approval)
  const { data: contractRows } = await admin
    .from("hunt_contracts")
    .select("id, status, client_email, client_signed_at, admin_signed_at, hunt_id")
    .eq("outfitter_id", outfitterId)
    .order("created_at", { ascending: false });

  const rawList = (contractRows || []).filter(
    (c: { client_email?: string | null }) =>
      c.client_email != null && (c.client_email as string).toLowerCase().trim() === userEmail
  );
  const huntIds = [...new Set(rawList.map((c: { hunt_id?: string | null }) => c.hunt_id).filter(Boolean) as string[])];

  type HuntRow = { id: string; title?: string; species?: string; unit?: string; hunt_code?: string; start_time?: string; end_time?: string };
  let huntById = new Map<string, HuntRow>();
  if (huntIds.length > 0) {
    const { data: huntRows } = await admin
      .from("calendar_events")
      .select("id, title, species, unit, hunt_code, start_time, end_time")
      .in("id", huntIds);
    huntById = new Map((huntRows || []).map((h: HuntRow & { id: string }) => [h.id, h]));
  }

  const huntContracts = rawList.map((c: { id: string; status: string; client_signed_at?: string | null; admin_signed_at?: string | null; hunt_id?: string | null }) => {
    const ev = c.hunt_id ? huntById.get(c.hunt_id) : undefined;
    const hunt_title = ev?.title ?? (c.hunt_id ? undefined : "Draw hunt (dates TBD)");
    return {
      id: c.id,
      status: c.status,
      client_signed_at: c.client_signed_at,
      admin_signed_at: c.admin_signed_at,
      hunt_title,
      species: ev?.species,
      unit: ev?.unit,
      hunt_code: ev?.hunt_code,
      start_time: ev?.start_time,
      end_time: ev?.end_time,
    };
  });

  // Eligibility: has any hunt contract or has purchased tags / pending hunts (no contract yet)
  const userEmailLower = userEmail;
  const { data: privateTags } = await admin
    .from("private_land_tags")
    .select("id")
    .eq("outfitter_id", outfitterId)
    .or(`client_email.ilike.${userEmailLower},client_email.eq.${userEmail}`)
    .limit(1);

  const { data: pendingHunts } = await admin
    .from("calendar_events")
    .select("id")
    .eq("outfitter_id", outfitterId)
    .or(`client_email.ilike.${userEmailLower},client_email.eq.${userEmail}`)
    .in("status", ["Pending", "Booked"])
    .limit(1);

  const isEligibleForContract =
    huntContracts.length > 0 || (privateTags && privateTags.length > 0) || (pendingHunts && pendingHunts.length > 0);

  // Single huntContract for backwards compat (first contract or aggregate status)
  const firstContract = huntContracts[0];
  const huntContractStatus =
    firstContract?.status ||
    (contractDoc?.status ?? (isEligibleForContract ? "not_started" : "not_available"));
  const huntContractSignedAt = firstContract?.admin_signed_at ?? firstContract?.client_signed_at ?? contractDoc?.client_signed_at;

  return NextResponse.json(
    {
    questionnaire: {
      status: questionnaire ? "completed" : "not_started",
      submitted_at: questionnaire?.submitted_at,
    },
    predraw: {
      status: predraw
        ? predraw.docusign_status === "completed"
          ? "completed"
          : "in_progress"
        : "not_started",
      docusign_status: predraw?.docusign_status,
      submitted_at: predraw?.submitted_at,
    },
    waiver: {
      status: waiverDoc?.status || "not_started",
      signed_at: waiverDoc?.client_signed_at,
    },
    huntContract: {
      status: huntContractStatus,
      eligible: isEligibleForContract,
      signed_at: huntContractSignedAt,
    },
    huntContracts,
  },
  {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  }
  );
}
