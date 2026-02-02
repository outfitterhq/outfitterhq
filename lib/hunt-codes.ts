/**
 * Shared hunt code helpers for draw results and tags for sale.
 * NMDGF codes: middle digit = weapon (1 = any legal, 2 = bow, 3 = muzzleloader).
 */

export interface HuntCodeOption {
  code: string;
  species: string;
  unit_description: string;
  season_text: string;
  start_date: string | null;
  end_date: string | null;
}

// Form species label -> CSV species value(s) in NMHuntCodes file
export const speciesToCsvSpecies: { [key: string]: string[] } = {
  Elk: ["ELK"],
  Deer: ["DEER", "MULE DEER", "COUES DEER"],
  "Mule Deer": ["DEER", "MULE DEER"],
  "Coues Deer": ["DEER", "COUES DEER"],
  Antelope: ["PRONGHORN", "ANTELOPE"],
  Oryx: ["ORYX"],
  Ibex: ["IBEX"],
  "Barbary Sheep": ["BARBARY SHEEP", "AOUAD"],
  Aoudad: ["BARBARY SHEEP", "AOUAD"],
  "Bighorn Sheep": ["BIGHORN SHEEP"],
};

// Weapon (tag type) -> hunt code middle digit
export const weaponToDigit: { [key: string]: string } = {
  Rifle: "1",
  Archery: "2",
  Muzzleloader: "3",
};

export function weaponDigitToTagType(digit: string): "Rifle" | "Archery" | "Muzzleloader" {
  return digit === "2" ? "Archery" : digit === "3" ? "Muzzleloader" : "Rifle";
}

export function filterHuntCodesBySpeciesAndWeapon(
  options: HuntCodeOption[],
  species: string,
  weapon: string
): HuntCodeOption[] {
  if (!species) return [];
  const csvMatches = speciesToCsvSpecies[species];
  if (!csvMatches) return options;
  let filtered = options.filter((opt) => {
    const csvSpecies = (opt.species || "").trim().toUpperCase();
    return csvMatches.some((m) => csvSpecies === m || csvSpecies.includes(m));
  });
  if (filtered.length === 0) return options;
  const digit = weaponToDigit[weapon];
  if (digit) {
    filtered = filtered.filter((opt) => {
      const parts = opt.code.split("-");
      return parts.length >= 2 && parts[1] === digit;
    });
    if (filtered.length === 0) return options;
  }
  return [...filtered].sort((a, b) => a.code.localeCompare(b.code));
}
