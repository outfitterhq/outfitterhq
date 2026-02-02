// Hunt Contract types for the contract workflow

export type HuntType = "draw" | "private_land";

export type TagStatus = "pending" | "applied" | "drawn" | "unsuccessful" | "confirmed";

export type ContractStatus =
  | "draft"
  | "pending_client_completion"
  | "ready_for_signature"
  | "sent_to_docusign"
  | "client_signed"
  | "fully_executed"
  | "cancelled";

export type DocuSignStatus =
  | "not_sent"
  | "sent"
  | "delivered"
  | "signed"
  | "completed"
  | "declined"
  | "voided";

export type ContractTemplateType = "hunt_contract" | "waiver" | "pre_draw_agreement";

// Contract Template (stored in contract_templates table)
export interface ContractTemplate {
  id: string;
  outfitter_id: string;
  name: string;
  description?: string | null;
  content: string; // Markdown/HTML with placeholders
  template_type: ContractTemplateType;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Hunt Contract (stored in hunt_contracts table)
export interface HuntContract {
  id: string;
  outfitter_id: string;
  hunt_id: string;
  template_id?: string | null;
  client_email: string;
  client_name?: string | null;
  content: string;
  status: ContractStatus;
  client_completed_at?: string | null;
  client_completion_data?: Record<string, any> | null;
  docusign_envelope_id?: string | null;
  docusign_status: DocuSignStatus;
  docusign_sent_at?: string | null;
  client_signed_at?: string | null;
  admin_signed_at?: string | null;
  signed_document_path?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined data
  hunt?: HuntSummary | null;
  template?: { id: string; name: string } | null;
}

// Hunt summary for contract display
export interface HuntSummary {
  id: string;
  title: string;
  species?: string | null;
  unit?: string | null;
  start_date: string;
  end_date: string;
  guide_username?: string | null;
  client_email?: string | null;
  hunt_type?: HuntType;
  tag_status?: TagStatus;
  camp_name?: string | null;
}

// Workflow state for admin UI
export interface WorkflowState {
  step: number | null;
  label: string;
  description: string;
  next_action: string | null;
}

// Tag status labels for UI
export const TAG_STATUS_LABELS: Record<TagStatus, string> = {
  pending: "Pending",
  applied: "Applied (Draw Pending)",
  drawn: "Drawn",
  unsuccessful: "Unsuccessful",
  confirmed: "Confirmed",
};

// Contract status labels for UI
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  pending_client_completion: "Pending Client",
  ready_for_signature: "Ready for Signature",
  sent_to_docusign: "Sent to DocuSign",
  client_signed: "Client Signed",
  fully_executed: "Complete",
  cancelled: "Cancelled",
};

// Hunt type labels for UI
export const HUNT_TYPE_LABELS: Record<HuntType, string> = {
  draw: "Draw Hunt",
  private_land: "Private Land",
};

// Placeholder definitions for contract templates
export const CONTRACT_PLACEHOLDERS = {
  "{{client_name}}": "Client's full name",
  "{{client_email}}": "Client's email address",
  "{{hunt_title}}": "Hunt title/name",
  "{{species}}": "Target species",
  "{{unit}}": "Hunt unit",
  "{{weapon}}": "Weapon type",
  "{{start_date}}": "Hunt start date",
  "{{end_date}}": "Hunt end date",
  "{{camp_name}}": "Camp name",
  "{{outfitter_name}}": "Outfitter business name",
  "{{outfitter_phone}}": "Outfitter contact phone",
  "{{outfitter_email}}": "Outfitter contact email",
} as const;

// Default contract template content
export const DEFAULT_CONTRACT_TEMPLATE = `# Hunt Contract Agreement

**Client:** {{client_name}}
**Email:** {{client_email}}

## Hunt Details

- **Hunt:** {{hunt_title}}
- **Species:** {{species}}
- **Unit:** {{unit}}
- **Weapon:** {{weapon}}
- **Dates:** {{start_date}} - {{end_date}}
- **Camp:** {{camp_name}}

## Terms and Conditions

1. **Deposit:** A non-refundable deposit is required to secure your hunt dates.

2. **Balance:** Full balance is due 60 days prior to hunt start date.

3. **Cancellation:** In the event of cancellation:
   - More than 90 days out: Deposit may be applied to future hunt
   - 60-90 days out: 50% refund of balance paid
   - Less than 60 days: No refund

4. **Weather/Conditions:** Hunts are conducted regardless of weather conditions. No refunds for weather-related issues.

5. **Tag/License:** Client is responsible for obtaining all required tags and licenses.

6. **Liability:** Client agrees to hold harmless the outfitter and guides from any liability.

## Acknowledgment

By signing below, I acknowledge that I have read, understand, and agree to all terms and conditions outlined in this contract.

**Client Signature:** _________________________ **Date:** _____________

**Outfitter Representative:** _________________________ **Date:** _____________
`;
