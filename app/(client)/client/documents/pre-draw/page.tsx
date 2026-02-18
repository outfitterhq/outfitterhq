"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InAppSigningFlow from "@/app/(client)/components/InAppSigningFlow";

interface SpeciesChoice {
  species: string;
  weapon: string;
  codeOrUnit: string;
  dates: string;
  choiceIndex: number;
}

// Hunt code row from NMHuntCodes_2025_clean.csv (same as iOS loadHuntRowsFromBundle)
interface HuntRow {
  codeOrUnit: string; // hunt_code lowercased for filtering
  dates: string;      // unit_description + season for display
  species: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(field.trim());
      field = "";
    } else if (ch !== "\n" || inQuotes) {
      field += ch;
    }
  }
  result.push(field.trim());
  return result;
}

function codePrefix(speciesKey: string): string {
  const k = speciesKey.toLowerCase();
  if (k.includes("elk")) return "elk-";
  if (k.includes("deer")) return "der-";
  if (k.includes("antelope") || k.includes("pronghorn")) return "ant-";
  if (k.includes("ibex")) return "ibx-";
  if (k.includes("barbary") || k.includes("bby")) return "bby-";
  if (k.includes("oryx")) return "orx-";
  if (k.includes("bighorn") || k.includes("big horn")) return "bhs-";
  return "";
}

function groupForWeapon(weapon: string): string {
  const w = weapon.toLowerCase();
  if (w === "bow") return "2";
  if (w === "muzzleloader") return "3";
  return "1"; // Any / Rifle
}

async function loadHuntRowsFromCSV(): Promise<HuntRow[]> {
  try {
    const res = await fetch("/data/NMHuntCodes_2025_clean.csv");
    if (!res.ok) return [];
    const raw = await res.text();
    const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n").filter((l) => l.trim());
    if (!lines.length) return [];
    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const speciesIdx = idx("species");
    const codeIdx = idx("hunt_code");
    const unitIdx = idx("unit_description");
    const seasonIdx = idx("season_text");
    const startIdx = idx("start_date");
    const endIdx = idx("end_date");
    if (speciesIdx < 0 || codeIdx < 0 || unitIdx < 0 || seasonIdx < 0 || startIdx < 0 || endIdx < 0) return [];
    const rows: HuntRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const maxI = Math.max(speciesIdx, codeIdx, unitIdx, seasonIdx, startIdx, endIdx);
      if (maxI >= cols.length) continue;
      const species = cols[speciesIdx].trim();
      const rawCode = cols[codeIdx].trim();
      const unit = cols[unitIdx].trim();
      const season = cols[seasonIdx].trim();
      const start = cols[startIdx].trim();
      const end = cols[endIdx].trim();
      let displayDates = season || (start && end ? `${start} – ${end}` : "") || "";
      let desc = unit ? (displayDates ? `${unit} ${displayDates}` : unit) : displayDates;
      const codeForFilter = rawCode.toLowerCase();
      rows.push({ species, codeOrUnit: codeForFilter, dates: desc });
    }
    return rows;
  } catch (e) {
    console.error("Failed to load hunt codes CSV:", e);
    return [];
  }
}

function filterHuntRows(rows: HuntRow[], speciesKey: string, weapon: string): HuntRow[] {
  const prefix = codePrefix(speciesKey);
  if (!prefix) return [];
  const grp = groupForWeapon(weapon);
  return rows.filter((row) => {
    const c = row.codeOrUnit.replace(/\s/g, "");
    return c.startsWith(`${prefix}${grp}`) || c.includes(`${prefix}${grp}-`);
  });
}

// Per-species preference when "Let G3 select my hunts" is on (matches iOS HuntPreference)
export type SpeciesPreference = "none" | "quality" | "high_odds" | "standard";

export const SPECIES_PREFERENCE_OPTIONS: { value: SpeciesPreference; label: string }[] = [
  { value: "none", label: "None" },
  { value: "quality", label: "Quality" },
  { value: "high_odds", label: "High draw odds" },
  { value: "standard", label: "Standard" },
];

export const PREFERENCE_SPECIES_KEYS = [
  "elk",
  "deer",
  "antelope",
  "ibex",
  "barbary_sheep",
  "oryx",
  "bighorn_sheep",
] as const;

export type SpeciesPreferenceKey = (typeof PREFERENCE_SPECIES_KEYS)[number];

export const PREFERENCE_SPECIES_LABELS: Record<SpeciesPreferenceKey, string> = {
  elk: "Elk",
  deer: "Mule / Coues Deer",
  antelope: "Antelope",
  ibex: "Ibex",
  barbary_sheep: "Barbary Sheep",
  oryx: "Oryx",
  bighorn_sheep: "Bighorn Sheep",
};

interface PreDrawData {
  // NMDGF & License Info
  nmdgf_username: string;
  height: string;
  weight: string;
  eye_color: string;
  hair_color: string;
  dob: string;
  drivers_license_number: string;
  drivers_license_state: string;
  ssn_last4: string;
  passport_number: string;
  
  // Payment authorization
  credit_card_last4: string;
  exp_mm: string;
  exp_yyyy: string;
  
  // Comments
  elk_comments: string;
  deer_comments: string;
  antelope_comments: string;
  
  // Submission choice
  submit_choice: "authorize_g3" | "submit_myself";
  acknowledged_contract: boolean;
  
  // "Let G3 select my hunts" (iOS parity)
  allow_g3_to_select: boolean;
  species_preferences: Record<SpeciesPreferenceKey, SpeciesPreference>;
  
  // Species selections (stored separately)
  selections: SpeciesChoice[];
}

// Species options (match iOS: Elk, Deer, Antelope, Ibex, Barbary Sheep, Oryx, Bighorn Sheep)
const DEFAULT_SPECIES_OPTIONS = [
  "Elk",
  "Deer",
  "Antelope",
  "Oryx",
  "Ibex",
  "Barbary Sheep",
  "Bighorn Sheep",
];
// Same 7 species get 3 hunt-code choices each (1st, 2nd, 3rd) like iOS
const SPECIES_FOR_CHOICES = [
  "Elk",
  "Deer",
  "Antelope",
  "Ibex",
  "Barbary Sheep",
  "Oryx",
  "Bighorn Sheep",
];
const CHOICES_PER_SPECIES = 3;
const WEAPON_OPTIONS = ["Any", "Rifle", "Bow", "Muzzleloader"];

function buildDefaultSelections(): SpeciesChoice[] {
  return SPECIES_FOR_CHOICES.flatMap((species) =>
    [1, 2, 3].map((choiceIndex) => ({
      species,
      weapon: "Any",
      codeOrUnit: "",
      dates: "",
      choiceIndex,
    }))
  );
}
const EYE_COLORS = ["Brown", "Blue", "Green", "Hazel", "Gray"];
const HAIR_COLORS = ["Black", "Brown", "Blonde", "Red", "Gray", "White"];

const defaultSpeciesPreferences: Record<SpeciesPreferenceKey, SpeciesPreference> = {
  elk: "none",
  deer: "none",
  antelope: "none",
  ibex: "none",
  barbary_sheep: "none",
  oryx: "none",
  bighorn_sheep: "none",
};

const PREDRAW_CONTRACT_TEXT = `By submitting this Pre-Draw Contract, you agree to the following terms and conditions for New Mexico Game & Fish draw applications:

• You authorize the outfitter to use the information provided to submit applications on your behalf (if you selected that option), and you understand that a $75.00 application handling fee may apply.

• You agree to the refund policy for draw applications as stated by the outfitter and NMDGF.

• You certify that all information provided (license, identity, payment) is accurate and current.

• You understand that hunt codes and dates are subject to NMDGF rules and availability.

• Once this form is submitted to G3 (or your outfitter), no changes can be made. Please review everything before submitting.

Please ensure your Client License Information (Step 2) is complete and accurate before signing.`;

const defaultData: PreDrawData = {
  nmdgf_username: "",
  height: "",
  weight: "",
  eye_color: "",
  hair_color: "",
  dob: "",
  drivers_license_number: "",
  drivers_license_state: "",
  ssn_last4: "",
  passport_number: "",
  credit_card_last4: "",
  exp_mm: "",
  exp_yyyy: "",
  elk_comments: "",
  deer_comments: "",
  antelope_comments: "",
  submit_choice: "authorize_g3",
  acknowledged_contract: false,
  allow_g3_to_select: false,
  species_preferences: { ...defaultSpeciesPreferences },
  selections: buildDefaultSelections(),
};

export default function PreDrawPage() {
  const router = useRouter();
  const [data, setData] = useState<PreDrawData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [step, setStep] = useState(1);
  const [speciesOptions, setSpeciesOptions] = useState<string[]>(DEFAULT_SPECIES_OPTIONS);
  const [predrawSignedAt, setPredrawSignedAt] = useState<string | null>(null);
  const [clientProfile, setClientProfile] = useState<{
    full_name?: string;
    email?: string;
    phone?: string;
    mailing_address?: string;
  } | null>(null);
  const [huntRows, setHuntRows] = useState<HuntRow[]>([]);

  useEffect(() => {
    loadExisting();
    loadSpecies();
    loadHuntRowsFromCSV().then(setHuntRows);
  }, []);

  async function loadSpecies() {
    try {
      const res = await fetch("/api/outfitter/species");
      if (res.ok) {
        const data = await res.json();
        const fromApi = data.species || [];
        setSpeciesOptions([...new Set([...DEFAULT_SPECIES_OPTIONS, ...fromApi])]);
      }
    } catch (e) {
      console.error("Failed to load species", e);
    }
  }

  async function loadExisting() {
    try {
      const res = await fetch("/api/client/predraw");
      let merged: PreDrawData = { ...defaultData };
      if (res.ok) {
        const json = await res.json();
        if (json.predraw) {
          const pred = json.predraw as { client_signed_at?: string | null; allow_g3_to_select?: boolean; species_preferences?: Record<string, string>; [key: string]: unknown };
          setPredrawSignedAt(pred.client_signed_at ?? null);
          const loadedSelections = json.selections || [];
          const slots = buildDefaultSelections();
          for (const row of loadedSelections) {
            const species = row.species || "";
            const choiceIndex = typeof row.choice_index === "number" ? row.choice_index : parseInt(row.choice_index, 10) || 1;
            const idx = SPECIES_FOR_CHOICES.indexOf(species) * CHOICES_PER_SPECIES + (choiceIndex - 1);
            if (idx >= 0 && idx < slots.length) {
              slots[idx] = {
                species,
                weapon: row.weapon || "Any",
                codeOrUnit: row.code_or_unit || row.codeOrUnit || "",
                dates: row.dates || "",
                choiceIndex,
              };
            }
          }
          merged = {
            ...defaultData,
            ...pred,
            allow_g3_to_select: pred.allow_g3_to_select ?? false,
            species_preferences: { ...defaultSpeciesPreferences, ...(pred.species_preferences || {}) },
            selections: slots,
          };
          setIsExisting(true);
        }
      }
      // Auto-fill empty fields from client profile (like iOS applyProfileIfNeeded)
      const profileRes = await fetch("/api/client/profile");
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setClientProfile(profile);
        if (!merged.dob && profile.date_of_birth) merged.dob = profile.date_of_birth;
      }
      setData(merged);
    } catch (e) {
      console.error("Failed to load existing pre-draw:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof PreDrawData, value: any) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function getSelectionIndex(species: string, choiceIndex: number): number {
    return SPECIES_FOR_CHOICES.indexOf(species) * CHOICES_PER_SPECIES + (choiceIndex - 1);
  }

  function updateSelectionBySpecies(
    species: string,
    choiceIndex: number,
    field: keyof SpeciesChoice,
    value: string | number
  ) {
    const index = getSelectionIndex(species, choiceIndex);
    if (index < 0 || index >= data.selections.length) return;
    setData((prev) => {
      const newSelections = [...prev.selections];
      newSelections[index] = { ...newSelections[index], [field]: value };
      return { ...prev, selections: newSelections };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const hasSelections = data.allow_g3_to_select
      ? PREFERENCE_SPECIES_KEYS.some((k) => (data.species_preferences[k] ?? "none") !== "none")
      : data.selections.some((s) => (s.codeOrUnit || "").trim() !== "");
    if (!hasSelections) {
      setError(
        data.allow_g3_to_select
          ? "Please set at least one species preference (or turn off 'Let outfitter select my hunts' and add hunt choices)."
          : "Please add at least one species choice or turn on 'Let outfitter select my hunts' and set species preferences."
      );
      return;
    }
    if (!data.acknowledged_contract) {
      setError("You must acknowledge the contract terms");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/client/predraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          allow_g3_to_select: data.allow_g3_to_select,
          species_preferences: data.species_preferences,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save pre-draw");
      }

      setSuccess(true);
      setIsExisting(true);
      
      setTimeout(() => {
        router.push("/client/documents");
      }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/documents"
          style={{ color: "#1a472a", textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Documents
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Pre-Draw Contract
        </h1>
        <p style={{ color: "#666" }}>
          Complete this form to authorize your draw applications. This information is required
          for New Mexico Game & Fish application submissions.
        </p>
        {isExisting && (
          <p style={{ color: "#1a472a", fontWeight: 500, marginTop: 8 }}>
            You've already submitted this form for {new Date().getFullYear()}. You can update your information below.
          </p>
        )}
      </div>

      {/* Client Information (matches iOS clientInfoBlock) */}
      {clientProfile && (
        <FormSection title="Client Information">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>Client Name</label>
              <div style={{ padding: "10px 14px", fontSize: 15, background: "#f5f5f5", borderRadius: 6 }}>{clientProfile.full_name || "—"}</div>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>Email</label>
              <div style={{ padding: "10px 14px", fontSize: 15, background: "#f5f5f5", borderRadius: 6 }}>{clientProfile.email || "—"}</div>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>Phone</label>
              <div style={{ padding: "10px 14px", fontSize: 15, background: "#f5f5f5", borderRadius: 6 }}>{clientProfile.phone || "—"}</div>
            </div>
          </div>
          {clientProfile.mailing_address && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>Address</label>
              <div style={{ padding: "10px 14px", fontSize: 15, background: "#f5f5f5", borderRadius: 6, whiteSpace: "pre-wrap" }}>{clientProfile.mailing_address}</div>
            </div>
          )}
        </FormSection>
      )}

      {success && (
        <div
          style={{
            background: "#e8f5e9",
            color: "#2e7d32",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          Pre-draw contract saved successfully! Redirecting...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {/* Step Indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {[1, 2, 3, 4].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: step === s ? "#1a472a" : "white",
              color: step === s ? "white" : "#666",
              border: "1px solid #ddd",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: step === s ? 600 : 400,
            }}
          >
            {s === 1 && "Species"}
            {s === 2 && "License Info"}
            {s === 3 && "Payment"}
            {s === 4 && "Review"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Species Selections */}
        {step === 1 && (
          <FormSection title="Species Selections">
            <p style={{ color: "#666", marginBottom: 20 }}>
              Add your species preferences for the draw. You can let your outfitter select hunts for you, or specify hunt codes yourself.
            </p>

            {/* "Let G3 select my hunts" toggle (iOS parity) */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={data.allow_g3_to_select}
                  onChange={(e) => handleChange("allow_g3_to_select", e.target.checked)}
                  style={{ width: 20, height: 20 }}
                />
                <span style={{ fontWeight: 500 }}>I would like my outfitter to select my hunts for me.</span>
              </label>
              {data.allow_g3_to_select && (
                <p style={{ fontSize: 14, color: "#666", marginTop: 8, marginLeft: 32 }}>
                  When this is on, your outfitter will select hunt codes for you. Use the per-species preferences below to indicate Quality, High draw odds, or Standard for each species. Choose &quot;None&quot; for any species you do not want to apply for.
                </p>
              )}
            </div>

            {data.allow_g3_to_select ? (
              /* Per-species preference (None / Quality / High odds / Standard) */
              <div style={{ marginBottom: 24 }}>
                {PREFERENCE_SPECIES_KEYS.map((key) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
                      {PREFERENCE_SPECIES_LABELS[key]}
                    </label>
                    <select
                      value={data.species_preferences[key] ?? "none"}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          species_preferences: { ...prev.species_preferences, [key]: e.target.value as SpeciesPreference },
                        }))
                      }
                      style={{
                        width: "100%",
                        maxWidth: 320,
                        padding: "10px 14px",
                        fontSize: 15,
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        background: "white",
                      }}
                    >
                      {SPECIES_PREFERENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Three choices per species (1st, 2nd, 3rd) — same as iOS */}
                {SPECIES_FOR_CHOICES.map((species) => {
                  const baseIdx = getSelectionIndex(species, 1);
                  const sel1 = data.selections[baseIdx] ?? { species, weapon: "Any", codeOrUnit: "", dates: "", choiceIndex: 1 };
                  const sel2 = data.selections[baseIdx + 1] ?? { species, weapon: "Any", codeOrUnit: "", dates: "", choiceIndex: 2 };
                  const sel3 = data.selections[baseIdx + 2] ?? { species, weapon: "Any", codeOrUnit: "", dates: "", choiceIndex: 3 };
                  return (
                    <FormSection key={species} title={species}>
                      <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
                        Select up to 3 hunt codes for {species}. Choose weapon type, then pick from the hunt code list.
                      </p>
                      {[
                        { label: "1st Choice", sel: sel1, choiceIndex: 1 },
                        { label: "2nd Choice", sel: sel2, choiceIndex: 2 },
                        { label: "3rd Choice", sel: sel3, choiceIndex: 3 },
                      ].map(({ label, sel: slot, choiceIndex }) => {
                        // Codes already chosen in the other two slots (same species) — cannot select twice
                        const otherSlots = [sel1, sel2, sel3].filter((s) => s !== slot);
                        const alreadySelectedCodes = otherSlots.map((s) => s.codeOrUnit).filter(Boolean);
                        const huntOptions = filterHuntRows(huntRows, species, slot.weapon).filter(
                          (row) => !alreadySelectedCodes.includes(row.codeOrUnit) || row.codeOrUnit === slot.codeOrUnit
                        );
                        return (
                        <div
                          key={choiceIndex}
                          style={{
                            background: "#f9f9f9",
                            border: "1px solid #eee",
                            borderRadius: 8,
                            padding: 16,
                            marginBottom: 12,
                          }}
                        >
                          <strong style={{ display: "block", marginBottom: 12 }}>{label}</strong>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                            <SelectField
                              label="Weapon"
                              value={slot.weapon}
                              options={WEAPON_OPTIONS}
                              onChange={(v) => updateSelectionBySpecies(species, choiceIndex, "weapon", v)}
                            />
                            <div>
                              <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
                                Hunt Code / Dates
                              </label>
                              <select
                                value={(() => {
                                  const filtered = filterHuntRows(huntRows, species, slot.weapon);
                                  const found = filtered.find(
                                    (r) => r.codeOrUnit === slot.codeOrUnit && r.dates === slot.dates
                                  );
                                  return found ? `${slot.codeOrUnit}\x1E${slot.dates}` : "";
                                })()}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (!v) {
                                    updateSelectionBySpecies(species, choiceIndex, "codeOrUnit", "");
                                    updateSelectionBySpecies(species, choiceIndex, "dates", "");
                                    return;
                                  }
                                  const sep = v.indexOf("\x1E");
                                  const code = sep >= 0 ? v.slice(0, sep) : v;
                                  const dates = sep >= 0 ? v.slice(sep + 1) : "";
                                  updateSelectionBySpecies(species, choiceIndex, "codeOrUnit", code);
                                  updateSelectionBySpecies(species, choiceIndex, "dates", dates);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "10px 14px",
                                  fontSize: 15,
                                  border: "1px solid #ddd",
                                  borderRadius: 6,
                                  background: "white",
                                }}
                              >
                                <option value="">Select…</option>
                                {huntOptions.map((row) => (
                                  <option key={row.codeOrUnit + "|" + row.dates} value={`${row.codeOrUnit}\x1E${row.dates}`}>
                                    {row.codeOrUnit} — {row.dates}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {huntRows.length === 0 && choiceIndex === 1 && (
                            <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Loading hunt codes…</p>
                          )}
                        </div>
                      );
                      })}
                    </FormSection>
                  );
                })}
              </>
            )}

            {/* Application Submission (with $75 fee note for iOS parity) */}
            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>
                Application Handling
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={data.submit_choice === "authorize_g3"}
                    onChange={() => handleChange("submit_choice", "authorize_g3")}
                  />
                  I authorize my outfitter to submit my applications
                </label>
                {data.submit_choice === "authorize_g3" && (
                  <p style={{ fontSize: 14, color: "#c62828", marginLeft: 28 }}>
                    A $75.00 application handling fee will be applied for this service. Make sure your License Information (Step 2) is complete and accurate before submission.
                  </p>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={data.submit_choice === "submit_myself"}
                    onChange={() => handleChange("submit_choice", "submit_myself")}
                  />
                  I will submit my own applications
                </label>
                {data.submit_choice === "submit_myself" && (
                  <p style={{ fontSize: 14, color: "#666", marginLeft: 28 }}>
                    We&apos;ll keep your hunt codes and details here for convenience.
                  </p>
                )}
              </div>
            </div>

            {/* Comments */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Additional Comments</h4>
              <TextAreaField
                label="Elk Comments"
                value={data.elk_comments}
                onChange={(v) => handleChange("elk_comments", v)}
                placeholder="Any specific preferences for elk hunts..."
              />
              <TextAreaField
                label="Deer Comments"
                value={data.deer_comments}
                onChange={(v) => handleChange("deer_comments", v)}
                placeholder="Any specific preferences for deer hunts..."
              />
              <TextAreaField
                label="Antelope Comments"
                value={data.antelope_comments}
                onChange={(v) => handleChange("antelope_comments", v)}
                placeholder="Any specific preferences for antelope hunts..."
              />
            </div>
          </FormSection>
        )}

        {/* Step 2: License Info */}
        {step === 2 && (
          <FormSection title="License Information">
            <p style={{ color: "#666", marginBottom: 20 }}>
              This information is required for your New Mexico Game & Fish application.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              <InputField
                label="NMDGF Username"
                value={data.nmdgf_username}
                onChange={(v) => handleChange("nmdgf_username", v)}
                placeholder="Your online account username"
              />
              <InputField
                label="Date of Birth"
                type="date"
                value={data.dob}
                onChange={(v) => handleChange("dob", v)}
              />
              <InputField
                label="Height"
                value={data.height}
                onChange={(v) => handleChange("height", v)}
                placeholder={`e.g., 5'10"`}
              />
              <InputField
                label="Weight"
                value={data.weight}
                onChange={(v) => handleChange("weight", v)}
                placeholder="e.g., 180 lbs"
              />
              <SelectField
                label="Eye Color"
                value={data.eye_color}
                options={EYE_COLORS}
                onChange={(v) => handleChange("eye_color", v)}
              />
              <SelectField
                label="Hair Color"
                value={data.hair_color}
                options={HAIR_COLORS}
                onChange={(v) => handleChange("hair_color", v)}
              />
              <InputField
                label="Driver's License Number"
                value={data.drivers_license_number}
                onChange={(v) => handleChange("drivers_license_number", v)}
              />
              <InputField
                label="License State"
                value={data.drivers_license_state}
                onChange={(v) => handleChange("drivers_license_state", v)}
                placeholder="e.g., NM"
              />
              <InputField
                label="SSN (Last 4 digits)"
                value={data.ssn_last4}
                onChange={(v) => handleChange("ssn_last4", v)}
                maxLength={4}
                placeholder="XXXX"
              />
              <InputField
                label="Passport Number (optional)"
                value={data.passport_number}
                onChange={(v) => handleChange("passport_number", v)}
              />
            </div>
          </FormSection>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <FormSection title="Payment Authorization">
            <p style={{ color: "#666", marginBottom: 20 }}>
              Provide payment information for draw application fees.
              Your card will only be charged if you are drawn.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <InputField
                label="Credit Card (Last 4 digits)"
                value={data.credit_card_last4}
                onChange={(v) => handleChange("credit_card_last4", v)}
                maxLength={4}
                placeholder="XXXX"
              />
              <InputField
                label="Expiration Month"
                value={data.exp_mm}
                onChange={(v) => handleChange("exp_mm", v)}
                maxLength={2}
                placeholder="MM"
              />
              <InputField
                label="Expiration Year"
                value={data.exp_yyyy}
                onChange={(v) => handleChange("exp_yyyy", v)}
                maxLength={4}
                placeholder="YYYY"
              />
            </div>
            <p style={{ fontSize: 14, color: "#666", marginTop: 16 }}>
              Note: Full credit card details are collected securely during the application process.
              Only the last 4 digits are stored here for reference.
            </p>
          </FormSection>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <FormSection title="Review & Submit">
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 8 }}>
                {data.allow_g3_to_select ? "Species Preferences (Outfitter will select hunts)" : "Species Selections (3 choices per species)"}
              </h4>
              {data.allow_g3_to_select ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {PREFERENCE_SPECIES_KEYS.map((key) => {
                    const pref = data.species_preferences[key] ?? "none";
                    if (pref === "none") return null;
                    return (
                      <li key={key}>
                        {PREFERENCE_SPECIES_LABELS[key]}: {pref.replace("_", " ")}
                      </li>
                    );
                  })}
                </ul>
              ) : (() => {
                const filled = data.selections.filter((s) => (s.codeOrUnit || "").trim() !== "");
                if (filled.length === 0) return <p style={{ color: "#666" }}>No hunt codes selected</p>;
                return (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {SPECIES_FOR_CHOICES.map((species) => {
                      const baseIdx = getSelectionIndex(species, 1);
                      const choices = [1, 2, 3]
                        .map((ci) => data.selections[baseIdx + ci - 1])
                        .filter((s) => s && (s.codeOrUnit || "").trim() !== "");
                      if (choices.length === 0) return null;
                      return (
                        <li key={species} style={{ marginBottom: 6 }}>
                          <strong>{species}:</strong>{" "}
                          {choices.map((s, i) => (
                            <span key={i}>
                              {i > 0 && "; "}
                              {s.codeOrUnit} — {s.dates || "—"}
                            </span>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 8 }}>Submission Choice</h4>
              <p>
                {data.submit_choice === "authorize_g3"
                  ? "Your outfitter will submit applications on your behalf"
                  : "You will submit your own applications"}
              </p>
            </div>

            {/* Contract Text & Acknowledgment (matches iOS contractTextAndAck) */}
            <div
              style={{
                background: "#f9f9f9",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <h4 style={{ marginBottom: 12 }}>Contract Text & Acknowledgment</h4>
              <div
                style={{
                  fontSize: 14,
                  color: "#555",
                  lineHeight: 1.6,
                  maxHeight: 220,
                  overflowY: "auto",
                  marginBottom: 16,
                  padding: 12,
                  background: "white",
                  border: "1px solid #eee",
                  borderRadius: 6,
                }}
              >
                <p style={{ marginBottom: 8 }}>
                  By submitting this Pre-Draw Contract, you agree to the following terms and conditions for New Mexico Game & Fish draw applications:
                </p>
                <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                  <li>You authorize the outfitter to use the information provided to submit applications on your behalf (if you selected that option), and you understand that a $75.00 application handling fee may apply.</li>
                  <li>You agree to the refund policy for draw applications as stated by the outfitter and NMDGF.</li>
                  <li>You certify that all information provided (license, identity, payment) is accurate and current.</li>
                  <li>You understand that hunt codes and dates are subject to NMDGF rules and availability.</li>
                  <li><strong>Once this form is submitted to G3 (or your outfitter), no changes can be made.</strong> Please review everything before submitting.</li>
                </ul>
                <p style={{ marginTop: 12 }}>
                  Please ensure your Client License Information (Step 2) is complete and accurate before signing.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={data.acknowledged_contract}
                  onChange={(e) => handleChange("acknowledged_contract", e.target.checked)}
                  style={{ width: 20, height: 20 }}
                />
                <span style={{ fontWeight: 500 }}>
                  I have read and agree to the contract language above.
                </span>
              </label>
            </div>

            {/* Sign pre-draw contract (unified in-app flow) */}
            <div style={{ marginTop: 24, marginBottom: 16 }}>
              {predrawSignedAt ? (
                <div
                  style={{
                    padding: 16,
                    background: "#e8f5e9",
                    border: "1px solid #81c784",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "#2e7d32",
                  }}
                >
                  <strong>Pre-draw contract signed</strong> on {new Date(predrawSignedAt).toLocaleDateString()}.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
                    Sign the pre-draw contract below. Submit the form first if you haven&apos;t already.
                  </p>
                  <InAppSigningFlow
                    documentTitle="Pre-Draw Contract"
                    documentContent={PREDRAW_CONTRACT_TEXT}
                    clientEmail={clientProfile?.email ?? ""}
                    onSign={async ({ typedName }) => {
                      const res = await fetch("/api/client/predraw/sign", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ typed_name: typedName }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "Failed to sign");
                      setPredrawSignedAt(new Date().toISOString());
                    }}
                    backHref="/client/documents"
                    backLabel="← Back to Documents"
                  />
                </>
              )}
            </div>
          </FormSection>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={{
                padding: "14px 24px",
                background: "white",
                color: "#666",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              ← Previous
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              style={{
                padding: "14px 24px",
                background: "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Next →
            </button>
          ) : (
            (() => {
              const hasValidSelections = data.allow_g3_to_select
                ? PREFERENCE_SPECIES_KEYS.some((k) => (data.species_preferences[k] ?? "none") !== "none")
                : data.selections.some((s) => (s.codeOrUnit || "").trim() !== "");
              const canSubmit = data.acknowledged_contract && hasValidSelections;
              return (
                <button
                  type="submit"
                  disabled={saving || !canSubmit}
                  style={{
                    padding: "14px 32px",
                    background: saving || !canSubmit ? "#ccc" : "#1a472a",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: saving || !canSubmit ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {saving ? "Saving..." : "Submit Pre-Draw Contract"}
                </button>
              );
            })()
          )}
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "#1a472a" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: 15,
          border: "1px solid #ddd",
          borderRadius: 6,
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: 15,
          border: "1px solid #ddd",
          borderRadius: 6,
          background: "white",
        }}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: 15,
          border: "1px solid #ddd",
          borderRadius: 6,
          resize: "vertical",
        }}
      />
    </div>
  );
}
