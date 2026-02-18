import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// CSV helper functions
function csvEscape(field: string): string {
  let f = field || "";
  let needsQuotes = false;
  if (f.includes('"')) {
    needsQuotes = true;
    f = f.replace(/"/g, '""');
  }
  if (f.includes(",") || f.includes("\n") || f.includes("\r")) {
    needsQuotes = true;
  }
  return needsQuotes ? `"${f}"` : f;
}

function makeCSV(headers: string[], rows: string[][]): string {
  const csv = "\u{FEFF}"; // Excel UTF-8 BOM
  return csv + headers.join(",") + "\n" + rows.map(row => row.map(csvEscape).join(",")).join("\n");
}

// GET: Export year snapshot
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    
    if (isNaN(year)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Get outfitter_id from user membership
    const { data: userData } = await admin.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await admin
      .from("outfitter_memberships")
      .select("outfitter_id")
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const outfitterId = membership.outfitter_id;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    // 1. Export Clients
    const { data: clients } = await admin
      .from("clients")
      .select("id, first_name, last_name, email, phone")
      .eq("outfitter_id", outfitterId);

    const clientsCSV = makeCSV(
      ["id", "firstName", "lastName", "email", "phone"],
      (clients || []).map(c => [
        c.id || "",
        c.first_name || "",
        c.last_name || "",
        c.email || "",
        c.phone || ""
      ])
    );

    // 2. Export Guides
    const { data: guides } = await admin
      .from("guides")
      .select("id, name, email, phone")
      .eq("outfitter_id", outfitterId)
      .eq("is_active", true);

    const guidesCSV = makeCSV(
      ["id", "firstName", "lastName", "email", "phone"],
      (guides || []).map(g => {
        const nameParts = (g.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        return [
          g.id || "",
          firstName,
          lastName,
          g.email || "",
          g.phone || ""
        ];
      })
    );

    // 3. Export Pre-Draw Contracts
    const { data: predraws } = await admin
      .from("client_predraw_submissions")
      .select(`
        *,
        client:clients!client_id(id, first_name, last_name, email, phone),
        selections:predraw_species_selections(*)
      `)
      .eq("outfitter_id", outfitterId)
      .eq("year", year);

    const contractsRows: string[][] = [];
    for (const p of predraws || []) {
      const client = p.client as any;
      const selections = p.selections || [];
      
      // Group selections by species
      const elkCodes: string[] = [];
      const deerCodes: string[] = [];
      const antelopeCodes: string[] = [];
      const ibexCodes: string[] = [];
      const oryxCodes: string[] = [];
      const barbaryCodes: string[] = [];
      const sheepCodes: string[] = [];

      for (const sel of selections) {
        const code = sel.code_or_unit || "";
        const species = (sel.species || "").toLowerCase();
        if (species.includes("elk")) elkCodes.push(code);
        else if (species.includes("deer")) deerCodes.push(code);
        else if (species.includes("antelope") || species.includes("pronghorn")) antelopeCodes.push(code);
        else if (species.includes("ibex")) ibexCodes.push(code);
        else if (species.includes("oryx")) oryxCodes.push(code);
        else if (species.includes("barbary") || species.includes("bby")) barbaryCodes.push(code);
        else if (species.includes("bighorn") || species.includes("sheep")) sheepCodes.push(code);
      }

      const handling = p.submit_choice || "";
      const fee = handling.toLowerCase().includes("g3") ? "75.00" : "";

      contractsRows.push([
        client?.first_name || "",
        client?.last_name || "",
        client?.email || "",
        client?.phone || "",
        handling,
        fee,
        p.nmdgf_username || "",
        "", // password not stored
        p.height || "",
        p.weight || "",
        p.eye_color || "",
        p.hair_color || "",
        p.dob || "",
        p.drivers_license_number || "",
        p.drivers_license_state || "",
        p.ssn_last4 || "",
        p.passport_number || "",
        p.credit_card_last4 || "",
        p.exp_mm || "",
        p.exp_yyyy || "",
        "", // CVV not stored
        elkCodes.join(";"),
        deerCodes.join(";"),
        antelopeCodes.join(";"),
        ibexCodes.join(";"),
        oryxCodes.join(";"),
        barbaryCodes.join(";"),
        sheepCodes.join(";"),
        p.submitted_at || p.created_at || ""
      ]);
    }

    const contractsCSV = makeCSV(
      [
        "firstName", "lastName", "email", "phone",
        "applicationHandling", "feeUSD",
        "nmdgfUsername", "nmdgfPassword",
        "height", "weight", "eyeColor", "hairColor", "birthdate",
        "driversLicenseNumber", "driversLicenseState", "last4SSN", "passportNumber",
        "cardLast4", "cardExpMM", "cardExpYYYY", "cvv",
        "elkCodes", "deerCodes", "antelopeCodes", "ibexCodes", "oryxCodes", "barbaryCodes", "sheepCodes",
        "createdAt"
      ],
      contractsRows
    );

    // 4. Create snapshot JSON
    const snapshot = {
      year,
      exportedAt: new Date().toISOString(),
      clientsCount: clients?.length || 0,
      guidesCount: guides?.length || 0,
      contractsCount: predraws?.length || 0
    };

    // Return all files as base64 encoded strings
    return NextResponse.json({
      success: true,
      files: {
        clients: {
          filename: `Clients_${year}_${timestamp}.csv`,
          content: Buffer.from(clientsCSV).toString("base64"),
          mimeType: "text/csv"
        },
        guides: {
          filename: `Guides_${year}_${timestamp}.csv`,
          content: Buffer.from(guidesCSV).toString("base64"),
          mimeType: "text/csv"
        },
        contracts: {
          filename: `Contracts_${year}_${timestamp}.csv`,
          content: Buffer.from(contractsCSV).toString("base64"),
          mimeType: "text/csv"
        },
        snapshot: {
          filename: `Snapshot_${year}_${timestamp}.json`,
          content: Buffer.from(JSON.stringify(snapshot, null, 2)).toString("base64"),
          mimeType: "application/json"
        }
      }
    });
  } catch (error: any) {
    console.error("Year closeout export error:", error);
    return NextResponse.json({ error: error.message || "Export failed" }, { status: 500 });
  }
}

// POST: Archive & Reset (clear documents)
export async function POST(req: Request) {
  try {
    const { year } = await req.json();
    
    if (!year || isNaN(parseInt(year))) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Get outfitter_id from user membership
    const { data: userData } = await admin.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await admin
      .from("outfitter_memberships")
      .select("outfitter_id")
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const outfitterId = membership.outfitter_id;

    // First export (same as GET)
    const exportRes = await GET(new Request(`${req.url.split("?")[0]}?year=${year}`));
    const exportData = await exportRes.json();

    if (!exportData.success) {
      return NextResponse.json({ error: "Export failed before reset" }, { status: 500 });
    }

    // Clear client documents (set status to archived or delete)
    // Note: We'll mark documents as archived rather than deleting them
    await admin
      .from("documents")
      .update({ status: "archived" })
      .eq("outfitter_id", outfitterId)
      .in("document_type", ["contract", "waiver", "questionnaire", "predraw"]);

    // Clear guide documents (if stored in documents table with linked_type = 'guide')
    await admin
      .from("documents")
      .update({ status: "archived" })
      .eq("outfitter_id", outfitterId)
      .eq("linked_type", "guide");

    return NextResponse.json({
      success: true,
      message: "Year closed out and documents archived",
      files: exportData.files
    });
  } catch (error: any) {
    console.error("Year closeout reset error:", error);
    return NextResponse.json({ error: error.message || "Reset failed" }, { status: 500 });
  }
}
