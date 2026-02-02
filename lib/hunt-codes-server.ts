/**
 * Server-only: load hunt codes from CSV and look up by code.
 * Used by purchase-tag (to set hunt window) and by hunt-codes API for ?code= param.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";

export interface HuntCodeRow {
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

function loadAllCodes(): HuntCodeRow[] {
  const publicData = path.join(process.cwd(), "public", "data");
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
  if (!csvPath) return [];

  const raw = readFileSync(csvPath, "utf-8");
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = parseCSV(normalized);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const codeIdx = header.findIndex((h) => ["hunt_code", "huntcode", "code"].includes(h));
  const speciesIdx = header.findIndex((h) => h === "species");
  const unitIdx = header.findIndex((h) => ["unit_description", "unitdescription", "unit"].includes(h));
  const seasonIdx = header.findIndex((h) => ["season_text", "seasontext", "season"].includes(h));
  const startIdx = header.findIndex((h) => ["start_date", "startdate"].includes(h));
  const endIdx = header.findIndex((h) => ["end_date", "enddate"].includes(h));
  if (codeIdx === -1) return [];

  const codes: HuntCodeRow[] = [];
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
  return codes;
}

/** Get a single hunt code's dates by code (e.g. ELK-1-294). Case-insensitive match. */
export function getHuntCodeByCode(code: string): HuntCodeRow | null {
  if (!code || !code.trim()) return null;
  const codes = loadAllCodes();
  const normalized = code.trim();
  return codes.find((c) => c.code.toUpperCase() === normalized.toUpperCase()) ?? null;
}
