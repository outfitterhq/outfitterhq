// Calendar types matching iOS G3CalendarEvent model
import type { HuntType, TagStatus } from "./hunt-contracts";

export type CalendarAudience = "all" | "client" | "guide" | "internalOnly";
export type HuntStatus = "Inquiry" | "Pending" | "Booked" | "In Progress" | "Completed" | "Pending Closeout" | "Closed" | "Cancelled";

export interface CalendarEvent {
  id: string; // UUID
  outfitter_id: string; // UUID
  title: string;
  notes?: string | null;
  start_date: string; // ISO 8601
  end_date: string; // ISO 8601
  camp_name?: string | null;
  client_email?: string | null;
  guide_username?: string | null;
  audience: CalendarAudience;
  // Hunt-specific fields
  species?: string | null;
  unit?: string | null;
  weapon?: string | null;
  status?: HuntStatus;
  hunt_code?: string | null; // State hunt code (e.g., ELK-1-294)
  // Hunt workflow fields
  hunt_type?: HuntType;
  tag_status?: TagStatus;
  questionnaire_locked?: boolean;
  contract_generated_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEventInput {
  title: string;
  notes?: string | null;
  start_date: string;
  end_date: string;
  camp_name?: string | null;
  client_email?: string | null;
  guide_username?: string | null;
  audience?: CalendarAudience;
  species?: string | null;
  unit?: string | null;
  weapon?: string | null;
  status?: HuntStatus;
  hunt_code?: string | null;
  hunt_type?: HuntType;
  tag_status?: TagStatus;
}

export const AUDIENCE_LABELS: Record<CalendarAudience, string> = {
  all: "Everyone",
  client: "Client",
  guide: "Guide",
  internalOnly: "Admin Only",
};
