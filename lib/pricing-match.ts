/**
 * Match pricing items to a hunt by species, weapon, and number of days.
 * Used when auto-generating the bill section of a contract.
 */

import type { PricingItem } from "@/lib/types/pricing";

/** Normalize calendar weapon (e.g. Bow) to tag-type label (Archery) for matching. */
export function normalizeWeaponForPricing(weapon: string | null | undefined): string | null {
  if (!weapon?.trim()) return null;
  const w = weapon.trim();
  if (w === "Bow") return "Archery";
  if (["Rifle", "Archery", "Muzzleloader"].includes(w)) return w;
  return w;
}

/**
 * Compute hunt days from start and end timestamps (inclusive).
 * Returns null if either date is missing or invalid.
 */
export function huntDaysFromRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number | null {
  if (!startTime || !endTime) return null;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  const days = Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
  return days >= 1 ? days : null;
}

/**
 * Returns true if this pricing item applies to the given hunt (species, weapon, days).
 * - Empty species/weapons on item = applies to all.
 * - included_days null on item = any day count; otherwise must match.
 */
export function pricingItemMatchesHunt(
  item: PricingItem,
  huntSpecies: string | null | undefined,
  huntWeapon: string | null | undefined,
  huntDays: number | null
): boolean {
  const speciesList = item.species?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const weaponList = item.weapons?.split(",").map((w) => w.trim()).filter(Boolean) ?? [];

  if (speciesList.length > 0 && huntSpecies) {
    const huntSpeciesNorm = huntSpecies.trim();
    if (!speciesList.some((s) => s.toLowerCase() === huntSpeciesNorm.toLowerCase())) return false;
  }

  if (weaponList.length > 0 && huntWeapon) {
    const norm = normalizeWeaponForPricing(huntWeapon);
    if (!norm || !weaponList.some((w) => w.toLowerCase() === norm.toLowerCase())) return false;
  }

  if (item.included_days != null && huntDays != null) {
    if (item.included_days !== huntDays) return false;
  }

  return true;
}

/**
 * Filter pricing items to those that apply to the given hunt.
 * Optionally sort by category then title.
 */
export function matchPricingForHunt(
  items: PricingItem[],
  huntSpecies: string | null | undefined,
  huntWeapon: string | null | undefined,
  huntDays: number | null
): PricingItem[] {
  const matched = items.filter((item) =>
    pricingItemMatchesHunt(item, huntSpecies, huntWeapon, huntDays)
  );
  return matched.sort((a, b) => {
    const cat = (a.category || "").localeCompare(b.category || "");
    return cat !== 0 ? cat : (a.title || "").localeCompare(b.title || "");
  });
}
