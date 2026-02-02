// Pricing types matching iOS G3PricingItem model

/** When category is Add-ons, type of add-on for matching and BILL line items. */
export type AddonType = "extra_days" | "non_hunter" | "spotter" | null;

export interface PricingItem {
  id: string; // UUID
  outfitter_id: string; // UUID
  title: string;
  description: string;
  amount_usd: number;
  category: string;
  /** When category is Add-ons: extra_days, non_hunter, spotter, or null (Other). */
  addon_type?: AddonType;
  /** Number of hunt days included (e.g. 5 for 5-day guided hunt). Used to validate client-selected date range. */
  included_days?: number | null;
  /** Comma-separated species this price applies to (e.g. Elk,Deer). Empty = all species. */
  species?: string | null;
  /** Comma-separated weapons (Rifle,Archery,Muzzleloader). Empty = all. */
  weapons?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PricingItemInput {
  title: string;
  description: string;
  amount_usd: number;
  category: string;
  addon_type?: AddonType;
  included_days?: number | null;
  species?: string | null;
  weapons?: string | null;
}
