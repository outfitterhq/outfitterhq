import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export interface HuntCodeOption {
  code: string;
  species: string;
  unit_description: string;
  season_text: string;
  start_date: string | null;
  end_date: string | null;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (ch === "," || ch === "\n" || ch === "\r")) {
      row.push(field.trim());
      field = "";
      if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) {
        rows.push(row);
        row = [];
      }
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

/**
 * GET /api/hunt-codes
 * Returns the NMDGF-style hunt code list (species, hunt_code, unit_description, season_text, dates).
 * ?code=ELK-1-294 returns a single code's details (for date picker bounds).
 * CSV is read from public/data — update that file each year when NMDGF publishes new codes.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const codeParam = searchParams.get("code")?.trim();
    if (codeParam) {
      const { getHuntCodeByCode } = await import("@/lib/hunt-codes-server");
      const one = getHuntCodeByCode(codeParam);
      if (!one) {
        return NextResponse.json(
          { error: `Hunt code not found: ${codeParam}` },
          { status: 404 }
        );
      }
      return NextResponse.json(one);
    }
    const publicData = path.join(process.cwd(), "public", "data");
    // Prefer canonical name so you can replace the file yearly without code changes
    const candidates = [
      path.join(publicData, "hunt-codes.csv"),
      path.join(publicData, "NMHuntCodes_2025_clean.csv"),
      path.join(publicData, "NMHuntCodes_2026_clean.csv"),
    ];
    let csvPath: string | null = null;
    for (const p of candidates) {
      if (existsSync(p)) {
        csvPath = p;
        break;
      }
    }
    if (!csvPath) {
      return NextResponse.json(
        { error: "Hunt codes CSV not found. Add public/data/hunt-codes.csv (or NMHuntCodes_*_clean.csv)." },
        { status: 404 }
      );
    }

    const raw = readFileSync(csvPath, "utf-8");
    const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rows = parseCSV(normalized);
    if (rows.length < 2) {
      return NextResponse.json({ codes: [], yearNote: "CSV has no data rows." });
    }

    const header = rows[0].map((h) => h.toLowerCase().trim());
    const codeIdx = header.findIndex((h) => ["hunt_code", "huntcode", "code"].includes(h));
    const speciesIdx = header.findIndex((h) => h === "species");
    const unitIdx = header.findIndex((h) => ["unit_description", "unitdescription", "unit"].includes(h));
    const seasonIdx = header.findIndex((h) => ["season_text", "seasontext", "season"].includes(h));
    const startIdx = header.findIndex((h) => ["start_date", "startdate"].includes(h));
    const endIdx = header.findIndex((h) => ["end_date", "enddate"].includes(h));

    if (codeIdx === -1) {
      return NextResponse.json(
        { error: "CSV must have a hunt_code (or code) column." },
        { status: 400 }
      );
    }

    const codes: HuntCodeOption[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const code = row[codeIdx]?.trim();
      if (!code) continue;
      codes.push({
        code,
        species: speciesIdx >= 0 ? (row[speciesIdx] ?? "").trim() : "",
        unit_description: unitIdx >= 0 ? (row[unitIdx] ?? "").trim() : "",
        season_text: seasonIdx >= 0 ? (row[seasonIdx] ?? "").trim() : "",
        start_date: startIdx >= 0 && row[startIdx] ? (row[startIdx] ?? "").trim() || null : null,
        end_date: endIdx >= 0 && row[endIdx] ? (row[endIdx] ?? "").trim() || null : null,
      });
    }

    return NextResponse.json({
      codes,
      yearNote: "Update public/data/hunt-codes.csv (or NMHuntCodes_*_clean.csv) each year when NMDGF publishes new codes.",
    });
  } catch (e) {
    console.error("hunt-codes API error:", e);
    return NextResponse.json({ error: "Failed to load hunt codes." }, { status: 500 });
  }
}
