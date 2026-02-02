// Types for Hunt Closeout & Success Archive System

export interface HuntCloseout {
  id: string; // UUID
  hunt_id: string; // UUID
  outfitter_id: string; // UUID
  guide_username: string;
  client_email?: string | null;
  
  // Success Details
  harvested: boolean;
  species?: string | null;
  weapon?: "Rifle" | "Muzzleloader" | "Bow" | "Any Legal" | null;
  unit?: string | null;
  state?: string | null;
  hunt_dates?: string | null; // JSON array: ["2025-09-15", "2025-09-16"]
  
  // Optional Notes
  success_summary?: string | null;
  weather_conditions?: string | null;
  animal_quality_notes?: string | null;
  
  // Status
  submitted_at: string; // ISO 8601
  submitted_by?: string | null;
  is_locked: boolean;
  unlocked_by?: string | null;
  unlocked_at?: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface HuntPhoto {
  id: string; // UUID
  closeout_id: string; // UUID
  hunt_id: string; // UUID
  outfitter_id: string; // UUID
  
  // Photo Metadata
  storage_path: string;
  file_name: string;
  file_size?: number | null;
  content_type?: string | null;
  
  // Categories
  category?: "Harvest" | "Landscape" | "Camp" | "Client + Guide" | "Other" | null;
  
  // Marketing Permission
  approved_for_marketing: boolean;
  is_private: boolean;
  
  // Auto-tags
  species?: string | null;
  weapon?: string | null;
  unit?: string | null;
  state?: string | null;
  season_year?: number | null;
  guide_username?: string | null;
  
  // Ordering
  display_order: number;
  
  uploaded_at: string;
  uploaded_by?: string | null;
  
  created_at: string;
}

export interface HuntCloseoutInput {
  hunt_id: string;
  harvested: boolean;
  species?: string | null;
  weapon?: "Rifle" | "Muzzleloader" | "Bow" | "Any Legal" | null;
  unit?: string | null;
  state?: string | null;
  hunt_dates?: string[] | null; // Array of date strings
  success_summary?: string | null;
  weather_conditions?: string | null;
  animal_quality_notes?: string | null;
  photos?: HuntPhotoInput[]; // Photos to upload
}

export interface HuntPhotoInput {
  file: File; // The actual file to upload
  category?: "Harvest" | "Landscape" | "Camp" | "Client + Guide" | "Other" | null;
  approved_for_marketing?: boolean;
  is_private?: boolean;
  display_order?: number;
}

export interface SuccessRecord {
  closeout_id: string;
  hunt_id: string;
  outfitter_id: string;
  hunt_title: string;
  guide_username: string;
  client_email?: string | null;
  harvested: boolean;
  species?: string | null;
  weapon?: string | null;
  unit?: string | null;
  state?: string | null;
  hunt_dates?: string | null;
  success_summary?: string | null;
  weather_conditions?: string | null;
  animal_quality_notes?: string | null;
  submitted_at: string;
  season_year?: number | null;
  total_photos: number;
  marketing_photos: number;
  /** Signed URL for first/primary photo (for display in success library) */
  primary_photo_url?: string | null;
  hunt_code?: string | null;
  hunt_type?: string | null;
}

export interface PendingCloseoutHunt {
  hunt_id: string;
  hunt_title: string;
  client_email?: string | null;
  species?: string | null;
  unit?: string | null;
  weapon?: string | null;
  start_time: string;
  end_time: string;
  days_pending: number;
}

export const PHOTO_CATEGORIES = [
  "Harvest",
  "Landscape",
  "Camp",
  "Client + Guide",
  "Other"
] as const;

export const WEAPON_TYPES = [
  "Rifle",
  "Muzzleloader",
  "Bow",
  "Any Legal"
] as const;
