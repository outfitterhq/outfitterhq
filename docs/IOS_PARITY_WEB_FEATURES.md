# iOS Parity with Web Features

Use this checklist when testing the iOS app so it matches web behavior. These APIs and fields are implemented on web; iOS should use the same endpoints and display the same data.

---

## 1. Client: Success History (photos + hunt details)

**Web:** Client Success History shows success records with **primary photo**, **hunt code**, and **hunt type** (Private Land / Unit Wide).

- **API:** `GET /api/success-records` (same for web and iOS; auth by session).
- **Response:** Each record includes:
  - `primary_photo_url` – signed URL for the primary image (clients see marketing-approved when available).
  - `hunt_code` – from the calendar event.
  - `hunt_type` – `"private_land"` or `"unit_wide"` (or null).
  - `marketing_photos` – count of marketing-approved photos (clients only see records with `marketing_photos > 0`).

**iOS:** Ensure the client success/history screen:
- Calls the same `GET /api/success-records` (with auth).
- Renders `primary_photo_url` when present (same as web).
- Shows `hunt_code` and `hunt_type` (Private Land / Unit Wide) on each card.

---

## 2. Client: “My Tags” (purchased tags)

**Web:** Client sees purchased tags with hunt code and type (Private Land / Unit Wide).

- **API:** `GET /api/client/private-tags` – returns tags for the linked outfitter where `client_email` matches or tag is available.
- **Fields:** `hunt_code`, `tag_type` (`"private_land"` | `"unit_wide"`).

**iOS:** Use the same API and show hunt code and tag type on “My Tags” (or equivalent) screen.

---

## 3. Client: Tag purchase → hunt/contract

**Web:** When a client purchases a tag:
- Tag is marked unavailable and linked to client + outfitter.
- A **calendar event (hunt)** is created with:
  - `hunt_type: "private_land"`, `tag_status: "confirmed"`.
  - **`hunt_code`** copied from the tag so admin doesn’t have to re-enter it.
- Admin sees the new hunt in Calendar (event is created ~30 days out). **Tip:** Navigate to the next month in the calendar to find the new hunt; hunt code is already set from the tag. Admin opens the event, sees “Generate contract” (hunt code already set), and generates/sends the contract.

**iOS:** After purchase, the same flow applies: no separate “create hunt” step; the backend creates the calendar event with hunt code. Client can be told “Your outfitter will generate the hunt contract” (same as web).

---

## 4. Admin: Calendar – hunt code and contract workflow

**Web:**
- Calendar event has **Hunt & contract details** with **Hunt code** (optional).
- For private-land tag purchases, the event is created **with hunt_code from the tag**.
- Admin opens event → sees workflow state → **Generate hunt contract** (can adjust hunt code/dates) → then Send to DocuSign, etc.

**API:** 
- `GET /api/calendar/[id]/tag-status` – returns `hunt` with `hunt_code`, `start_time`, `end_time`, `tag_status`, `hunt_type`, and `workflow_state`.
- `POST /api/calendar/[id]/generate-contract` – body can include `hunt_code`, `start_time`, `end_time`.

**iOS:** Admin calendar (or hunt-detail) screen should:
- Show and edit hunt code when present (pre-filled for tag purchases).
- Use the same tag-status and generate-contract APIs so the contract workflow matches web.

---

## 5. Summary table

| Feature                     | Web behavior / API                    | iOS parity |
|----------------------------|----------------------------------------|------------|
| Client success photo       | `primary_photo_url` from success-records | Show same image |
| Client success hunt code/type | `hunt_code`, `hunt_type` on cards    | Show on cards |
| Client My Tags             | hunt_code, tag_type                    | Show on My Tags |
| Tag purchase → hunt        | Backend creates event with hunt_code   | Same; no extra step |
| Admin calendar hunt code  | Pre-filled from tag; editable          | Same fields/APIs |
| Admin generate contract   | From calendar event (tag-status + generate-contract) | Same APIs |

---

**Last updated:** January 2026 – aligned with web client/admin and tag purchase flow.
