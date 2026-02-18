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

// GET: Export authorized G3 pre-draw applications
export async function GET(req: Request) {
  try {
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
    const currentYear = new Date().getFullYear();

    // Get all pre-draw submissions for this outfitter
    const { data: predraws } = await admin
      .from("client_predraw_submissions")
      .select(`
        *,
        client:clients!client_id(id, first_name, last_name, email, phone),
        selections:predraw_species_selections(*)
      `)
      .eq("outfitter_id", outfitterId)
      .eq("year", currentYear)
      .not("submitted_at", "is", null);

    // Filter to only authorized G3 submissions
    const authorized = (predraws || []).filter(p => {
      const handling = (p.submit_choice || "").toLowerCase();
      return handling.includes("authorizeg3") || 
             handling.includes("authorize g3") || 
             handling === "authorizeg3" || 
             handling === "authg3" ||
             handling.includes("g3");
    });

    // Build CSV
    const headers = [
      "firstName", "lastName", "email", "phone",
      "applicationHandling", "feeUSD",
      "nmdgfUsername", "nmdgfPassword",
      "height", "weight", "eyeColor", "hairColor", "birthdate",
      "driversLicenseNumber", "driversLicenseState", "last4SSN", "passportNumber",
      "cardLast4", "cardExpMM", "cardExpYYYY", "cvv",
      "elkCodes", "deerCodes", "antelopeCodes", "ibexCodes", "oryxCodes", "barbaryCodes", "sheepCodes",
      "createdAt"
    ];

    const rows: string[][] = [];
    const feeForG3 = "75.00";

    for (const p of authorized) {
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
      const fee = handling.toLowerCase().includes("g3") ? feeForG3 : "";

      rows.push([
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

    const csv = "\u{FEFF}"; // Excel UTF-8 BOM
    const csvContent = csv + headers.join(",") + "\n" + rows.map(row => row.map(csvEscape).join(",")).join("\n");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `G3_Authorized_Applications_${timestamp}.csv`;

    return NextResponse.json({
      success: true,
      count: authorized.length,
      file: {
        filename,
        content: Buffer.from(csvContent).toString("base64"),
        mimeType: "text/csv"
      }
    });
  } catch (error: any) {
    console.error("Pre-draw export error:", error);
    return NextResponse.json({ error: error.message || "Export failed" }, { status: 500 });
  }
}
