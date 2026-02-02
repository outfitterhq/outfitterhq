# Tag for Sale → Contract → Scheduling (Per-Hunt Workflow)

**One-sentence rule:** A client can have many hunts, but every hunt must independently pass admin review, contract generation, dual DocuSign (client then admin), and only then become schedulable.

---

## Principle: Everything is per-hunt, not per-client

- Each client can have multiple hunts.
- Each hunt moves **independently** through: Approval → Contract → DocuSign → Scheduling.
- No global or bulk approval; no single “pending” for the whole client.

---

## 1. Admin creates a tag for sale

- **Tags for Sale** → New Tag.
- Fields: Title, Description, Species, State, Weapon type(s).
- **Tag type (required):**
  - **Private Land:** Hunt code and unit are fixed; no post-purchase selection.
  - **Unit-Wide:** Unit is defined; hunt code is **not** set yet. Description should list available hunt codes/options for the client.

## 2. Admin posts tag → visible to clients

- Published tags appear in Client Marketplace (Available Tags).
- Client sees description and whether it’s private land vs unit-wide.

## 3. Client purchases tag

- A **new hunt** (calendar event) is created.
- **Status:** `Pending` (Pending Admin Review).
- **Private Land:** `hunt_code` is set from the tag.
- **Unit-Wide:** `hunt_code` is null until admin sets it.
- No contract yet; nothing is auto-approved.

## 4. Admin reviews that hunt (per-hunt)

- Admin opens **that hunt** (Calendar → event), not “the client.”
- For **Unit-Wide:** Admin sets unit and specific hunt code.
- For **Private Land:** Unit and hunt code are already set.
- This approval applies **only** to this one hunt.

## 5. Contract generation (per hunt)

- After admin finalizes unit + hunt code, admin clicks **Generate contract** for that hunt.
- One hunt = one contract. Contract is linked to that hunt (and client).

## 6. Client: My Contracts / Documents

- **Each contract is listed individually** with its own status, e.g.:
  - Elk Archery – Unit 15 → Pending Client Signature
  - Deer Rifle – Unit 34 → Pending Client Signature
  - Antelope – Private Land → Complete
- Client dashboard Documents page shows one row/card per hunt contract.

## 7. Admin sends contract to DocuSign (per hunt)

- Admin clicks **Send Contract** for that hunt’s contract.
- Status becomes **Pending Client Signature**. No other hunts/contracts are affected.

## 8. Client signs (DocuSign)

- Client signs that hunt’s contract. Status becomes **Pending Admin Signature**.

## 9. Admin signs (DocuSign)

- Admin signs the same contract. Status becomes **Fully executed**.

## 10. Hunt moves to scheduling queue

- **Only after** contract status = `fully_executed`:
  - `scheduling_blocked` is set to `false` for that hunt.
  - Admin can assign camp, guides, and place the hunt on the calendar.
- Hunts without a fully executed contract **cannot** be scheduled (DB trigger enforces this).

---

## What this fixes

| Before (broken) | After (correct) |
|-----------------|------------------|
| Approving one hunt could affect others | Approval is per hunt |
| Client saw one “pending” for all | Each contract listed with its own status |
| Contracts not enforced | Contract generation and DocuSign are per hunt |
| Scheduling without signed agreements | Scheduling only when contract is fully executed |

---

## Implementation notes

- **Tag purchase:** `app/api/client/purchase-tag/route.ts` creates hunt with `status: "Pending"`, `hunt_code` only for private_land.
- **Client documents:** `app/api/client/documents/route.ts` returns `huntContracts[]`; Documents page shows one card per contract.
- **Scheduling:** Migration `053_scheduling_only_after_fully_executed.sql` restricts scheduling to `hunt_contracts.status = 'fully_executed'`.

Last updated: January 2026.
