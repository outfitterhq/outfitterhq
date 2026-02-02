// Tags for Sale types (Private Land or Unit Wide)

export type TagSpecies = "Elk" | "Deer" | "Antelope" | "Oryx" | "Ibex" | "Bighorn Sheep" | "Aoudad";
export type Weapon = "Archery" | "Rifle" | "Muzzleloader";

/** private_land = private land tag; unit_wide = unit-wide tag. Optional, default private_land. */
export type TagType = "private_land" | "unit_wide";

export interface PrivateLandTag {
  id: string; // UUID
  state: string; // e.g. "NM"
  species: TagSpecies;
  unit?: string | null;
  tag_name: string;
  hunt_code?: string | null; // single code for private_land
  /** Unit-wide only: comma-separated hunt codes (e.g. ELK-1-294,ELK-2-294,ELK-3-294). Client chooses one at purchase. */
  hunt_code_options?: string | null;
  tag_type?: TagType | null; // Private Land or Unit Wide
  price?: number | null;
  is_available: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  client_email?: string | null; // set when sold (purchased by client)
  /** When tag is sold, the hunt (calendar event) created from this purchase (from API ?include_hunts=1) */
  hunt_id?: string | null;
  hunt_title?: string | null;
  hunt_start_time?: string | null;
  hunt_status?: string | null;
}

export interface PrivateLandTagInput {
  state: string;
  species: TagSpecies;
  unit?: string | null;
  tag_name: string;
  hunt_code?: string | null;
  hunt_code_options?: string | null;
  tag_type?: TagType | null;
  price?: number | null;
  is_available?: boolean;
  notes?: string | null;
}

export const SPECIES_OPTIONS: TagSpecies[] = [
  "Elk",
  "Deer",
  "Antelope",
  "Oryx",
  "Ibex",
  "Bighorn Sheep",
  "Aoudad",
];

export const WEAPON_OPTIONS: Weapon[] = ["Archery", "Rifle", "Muzzleloader"];
