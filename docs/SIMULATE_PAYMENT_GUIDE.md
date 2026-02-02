# Simulate Payment Guide (Testing)

Use simulated payment to test the full flow: **sign contract → pay → see calendar event / dashboard** without charging a real card.

---

## When to use

- Local development or staging
- Testing the client flow after signing a hunt contract
- Verifying that the dashboard and calendar reflect “paid” after payment

---

## How to enable simulate payment

**Option 1 – URL parameter (no env change)**  
Add `?simulate=1` so the simulate button appears:

- **Hunt Contract page:** Open `/client/documents/hunt-contract?simulate=1` (or add `&simulate=1` if you already have a contract in the URL). You’ll see **Simulate payment (testing)** next to Pay in full — one click marks the guide fee as paid.
- **Pay page:** Open the pay page with `&simulate=1`, e.g. `/client/pay?item_id=<payment_item_id>&simulate=1`. Then click **Simulate payment (testing)**.

**Option 2 – Environment variable**  
In `.env.local`:

```bash
NEXT_PUBLIC_ALLOW_SIMULATE_PAYMENT=true
```

Restart the dev server. The **Simulate payment (testing)** button will show on both the Hunt Contract page and the pay page without adding `?simulate=1` to the URL.

**Note:** The API only accepts simulate requests when:

- `NODE_ENV=development`, or  
- `NEXT_PUBLIC_ALLOW_SIMULATE_PAYMENT=true`

Otherwise you get 403.

---

## End-to-end flow (simulate)

1. **Sign the hunt contract**  
   - Client: Documents → Hunt Contract → complete and submit (and sign via DocuSign if enabled).  
   - Contract status becomes `fully_executed` when all parties have signed.

2. **Open the pay page**  
   - On the Hunt Contract page, click **Pay in full** (or use the pay link from the client dashboard).  
   - If using Option 1, add `&simulate=1` to the URL.

3. **Simulate payment**  
   - **From Hunt Contract (with ?simulate=1 or env set):** Click **Simulate payment (testing)** next to Pay in full. The guide fee is marked paid and the balance updates on the page.  
   - **From Pay page:** Click **Pay in full** (add `&simulate=1` to the URL if needed), then click **Simulate payment (testing)**.  
   - The payment item is marked **paid** (no Stripe charge). You see “Payment complete” or “Payment simulated. Balance updated.”

4. **Check the result**  
   - **Client dashboard:** “Payment due” / balance goes away.  
   - **Client → Payments:** The guide fee shows as **Paid**.  
   - **Calendar:** The hunt (calendar event) is unchanged; it was created when the contract/hunt was set up. Payment is stored on `payment_items`; the calendar event is linked via `hunt_id` / `contract_id`. So “after payment” you see the same hunt on the calendar, but the client’s balance is cleared.

---

## What simulate does (technical)

- **API:** `POST /api/client/simulate-payment`  
  Body: `{ "payment_item_id": "<uuid>" }`
- **Database:** Updates `payment_items` for that item:
  - `amount_paid_cents = total_cents`
  - `status = 'paid'`
  - `paid_at = now()`
- No Stripe call, no `payment_transactions` row.

---

## Calendar event vs payment

- The **calendar event** (hunt) is created when the hunt/contract is set up (e.g. tag purchase, admin creating the event, or contract generation).
- **Payment** is tracked in `payment_items` (and optionally `payment_transactions` for real Stripe payments).
- Simulate payment only updates the payment item. It does **not** create or change calendar events.  
- To “simulate the calendar event after payment and signing”: complete the flow above (sign contract → simulate pay). The calendar event for that hunt already exists; after payment, the client simply has no balance due for that contract.

---

## iOS: Pay banner and “Pay on the web”

When a client logs in on iOS and has a balance due:

- The **Client Dashboard** shows a **Payment due** banner at the top with **Pay now** and **View contract & payment**.
- Tapping **Pay now** or **View contract & payment** opens the **website** (in Safari) so they can pay or view the contract there.

**If the app uses localhost (device/simulator):**

- Payment due is loaded from **Supabase** (not the web API).
- The links use **WEB_APP_URL** so they open your real website. Set **WEB_APP_URL** in Xcode (scheme or Info.plist) to your deployed web app URL (e.g. `https://yourapp.com`). Then “Pay now” opens `https://yourapp.com/client/pay?item_id=...`.

**If the app uses your production API (API_BASE_URL set to your web URL):**

- Payment due comes from the dashboard API and links use that same URL, so “Pay now” already opens your website.

---

## Quick reference

| Step              | Action                                              |
|-------------------|-----------------------------------------------------|
| Enable simulate   | Add `?simulate=1` to pay URL or set env var above   |
| Go to pay         | Hunt Contract → Pay in full (or dashboard pay link) |
| Simulate          | Click **Simulate payment (testing)**                |
| Verify            | Dashboard balance = 0; Payments shows Paid          |
