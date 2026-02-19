# Client Portal & Admin Customization — One Build Summary

Single summary of all customization-related planning (from recent planning chats). **Web app only;** no iOS changes.

---

## 1. Client portal branding (new)

**Goal:** Let admins further customize how the client portal looks.

- **Accent color**
  - Add `client_portal_accent_color` on `outfitters` (migration).
  - Expose as CSS variable (e.g. `--client-accent`) in ClientShell.
  - Settings: color picker + hex input.
  - Replace hardcoded `#1a472a` across client pages with `var(--client-accent)`.

- **Background photos (optional)**
  - Keep existing: one global image or per-page image.
  - Add optional **rotating slideshow:** new field `client_portal_background_image_urls` (array of URLs). When set, ClientShell shows a slideshow (e.g. crossfade every 8–10s). Settings: “Single image” vs “Slideshow” + list of URLs when background type is “image”.

- **Optional later:** Custom footer text, nav label override, nav tab visibility (Phase 2).

**Implementation order:** Migration (accent + background_image_urls) → API GET/PUT → ClientShell (CSS var + slideshow) → Settings UI → replace `#1a472a` in client pages.

---

## 2. Remove hunt showcase and testimonials

**Goal:** Past Success replaces hunt showcase; testimonials are built into Past Success. Remove from Settings and client dashboard.

- **Settings:** Remove state, load, and save for `dashboard_hunt_showcases` and `dashboard_testimonials`. Remove the “Hunt Showcases” and “Client Testimonials” sections from `DashboardCustomizationForm`.
- **Client dashboard:** Remove `huntShowcases` and `testimonials` from the customization type and remove the two render blocks (Our Hunts grid, Client Testimonials grid).
- **API:** Optionally remove these fields from dashboard API response and client type. DB columns can stay (no migration).

**Files:** `app/(app)/settings/page.tsx`, `app/(client)/client/page.tsx`, optionally `app/api/client/dashboard/route.ts`.

---

## 3. Contract, waiver, pre-draw — no changes

**Goal:** Do not change hunt contract, waiver, or pre-draw flows or UI.

- Outfitters already customize the **body** via **Contract Templates**; the app fills in client info, hunt info, and (for contracts) the bill. Client-facing titles (“Waiver of Liability”, “Hunt Contract”) stay fixed.
- **No implementation:** Leave as-is. No new settings, copy, or placeholder changes.

---

## 4. Admin preview client portal

**Goal:** Let admins preview the client portal (branding + dashboard) without logging in as a client. Web app only.

- **New API:** GET `/api/preview-client` — admin auth + outfitter cookie; returns branding (logo, header, background, etc.) + mock dashboard payload (same shape as client dashboard API: empty hunts, documents “not started”, no payment).
- **New page:** `/(app)/preview-client` — banner (“Preview — this is how your client portal looks”) + ClientShell (with branding) + dashboard content (reuse same UI as client dashboard via extracted presentational component).
- **Reuse:** Extract `ClientDashboardContent` from `(client)/client/page.tsx`; use in client page (real data) and preview page (mock data). Optional: in preview mode, make links non-navigating or show “Preview only”.
- **Entry:** “Preview client portal” link/button in Settings (Client Portal Branding or Dashboard Customization); optionally in app nav.

**Files:** New `app/api/preview-client/route.ts`, new `app/(app)/preview-client/page.tsx`, refactor `app/(client)/client/page.tsx` to use shared dashboard content component, `app/(app)/settings/page.tsx` (add preview link).

---

## Build order (recommended)

| Step | Work |
|------|------|
| 1 | Remove hunt showcase and testimonials (Settings + client dashboard + optional API cleanup). |
| 2 | Client portal branding: migration (accent + background_image_urls) → API → ClientShell (accent CSS var + optional slideshow) → Settings (accent + slideshow UI) → replace #1a472a in client pages. |
| 3 | Admin preview: API `/api/preview-client` → extract ClientDashboardContent → preview page + ClientShell + mock data → “Preview client portal” in Settings (and optionally nav). |

Contract/waiver/pre-draw: no work.

---

## Reference

- **Branding/customization already in place:** Logo, header color, background type (color/image/per-page), per-page backgrounds, dashboard hero/CTAs/feature cards/special sections/partner logos/contact, Past Success intro and species photos. Stored in `outfitters`; Settings: `app/(app)/settings/page.tsx`; client: `app/(client)/layout.tsx`, `app/(client)/components/ClientShell.tsx`, `app/(client)/client/page.tsx`.
- **Contract templates:** `contract_templates` (hunt_contract, waiver, pre_draw_agreement); admins edit body in Contract Templates; app injects client/hunt/choices. No changes planned.
