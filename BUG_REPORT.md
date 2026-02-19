# Full-Workspace Bug Report

Generated from the structured bug review (Phase 1: pattern-based scan, Phase 2: high-risk paths, Phase 3: broader logic + iOS). No code was changed; this is a read-only audit.

---

## High severity

*None identified in this pass.*

---

## Medium severity

### 1. Payment create-intent: null `amount_paid_cents` / `platform_fee_cents` can produce wrong Stripe amount

| Field | Value |
|-------|--------|
| **File** | [huntco-web/app/api/payments/create-intent/route.ts](huntco-web/app/api/payments/create-intent/route.ts) |
| **Location** | Lines 72–73, inside `POST` handler |
| **Description** | `amountToCharge = paymentItem.total_cents - paymentItem.amount_paid_cents` and `platformFee = paymentItem.platform_fee_cents` do not guard against `null`/`undefined`. If the DB returns null for either, `amountToCharge` or `platformFee` can be `NaN`, which can lead to incorrect Stripe amounts or API errors. |
| **Suggested fix** | Use `(paymentItem.amount_paid_cents ?? 0)` and `(paymentItem.platform_fee_cents ?? 0)` (or equivalent) so arithmetic and Stripe calls always use numbers. |

### 2. Admin routes rely on outfitter cookie without explicit membership check

| Field | Value |
|-------|--------|
| **File** | [huntco-web/app/api/hunt-contracts/route.ts](huntco-web/app/api/hunt-contracts/route.ts) (and similarly [huntco-web/app/api/hunt-contracts/[id]/route.ts](huntco-web/app/api/hunt-contracts/[id]/route.ts), [huntco-web/app/api/clients/[email]/route.ts](huntco-web/app/api/clients/[email]/route.ts)) |
| **Location** | GET (and PATCH where applicable): use `outfitterId` from cookie, filter by `eq("outfitter_id", outfitterId)` |
| **Description** | These routes require auth and use the outfitter id from the cookie to scope data. They do not explicitly verify that the current user has an active membership for that outfitter. Access then depends on RLS and on the cookie being set only via flows that already check membership (e.g. tenant/select). If the cookie is ever set or tampered with for another outfitter, behavior is undefined without a server-side membership check. |
| **Suggested fix** | After resolving `outfitterId` from the cookie, query `outfitter_memberships` for the current user and that `outfitter_id` with `status = 'active'`. If no such membership exists, return 403 before running the main query. |

---

## Low severity

### 3. Client payments API: client lookup `.single()` error not distinguished from “not found”

| Field | Value |
|-------|--------|
| **File** | [huntco-web/app/api/client/payments/route.ts](huntco-web/app/api/client/payments/route.ts) |
| **Location** | Lines 16–24: `const { data: client } = await supabase...clients...single()` |
| **Description** | The route does not destructure `error` from the clients query. On a DB or Supabase error (e.g. multiple rows), the handler still returns 404 “Client record not found,” which hides server/configuration issues. |
| **Suggested fix** | Destructure `error` and, if `error` is set, return 500 with a generic message (and log the error) instead of 404. |

### 4. Auth login: client lookup `.single()` error not distinguished from “no client”

| Field | Value |
|-------|--------|
| **File** | [huntco-web/app/api/auth/login/route.ts](huntco-web/app/api/auth/login/route.ts) |
| **Location** | Lines 70–75: client record lookup with `.single()` |
| **Description** | Same pattern as #3: only `data` is used. A DB or “multiple rows” error is indistinguishable from “user is not a client,” so redirect and logging may be misleading. |
| **Suggested fix** | Check the query `error`; on error return 500 (or a safe error response) and log, instead of treating it as “no client.” |

### 5. Hunt-contract page: `currentContract!` in simulate-payment callback

| Field | Value |
|-------|--------|
| **File** | [huntco-web/app/(client)/client/documents/hunt-contract/page.tsx](huntco-web/app/(client)/client/documents/hunt-contract/page.tsx) |
| **Location** | Line 920: `currentContract!.id` inside the simulate-payment success handler |
| **Description** | If `currentContract` is ever cleared or set to null before the callback runs (e.g. navigation or state update), this will throw. |
| **Suggested fix** | Guard: `if (!currentContract) return;` before the fetch, or use `currentContract?.id` and skip the refetch when missing. |

### 6. Payments webhook: defensive handling of `amount_paid_cents`

| Field | Value |
|-------|--------|
| **File** | [huntco-web/app/api/payments/webhook/route.ts](huntco-web/app/api/payments/webhook/route.ts) |
| **Location** | Line 115 in `handlePaymentSuccess`: `item.amount_paid_cents + paymentIntent.amount` |
| **Description** | If the DB returns `undefined` for `amount_paid_cents`, the sum becomes `NaN`, which can corrupt `amount_paid_cents` in the update. (Null is coerced to 0 in JS; undefined is not.) |
| **Suggested fix** | Use `(item.amount_paid_cents ?? 0) + paymentIntent.amount` (and same for any other numeric fields used in arithmetic). |

### 7. Client layout: console logs and optional error handling

| Field | Value |
|-------|--------|
| **File** | [huntco-web/app/(client)/layout.tsx](huntco-web/app/(client)/layout.tsx) |
| **Location** | Client and outfitter fetches using `.single()` |
| **Description** | Layout correctly branches on `clientError || !clientRecord` and `outfitterError || !outfitter`. No crash risk; only note is that console.log in production may leak minor diagnostic info. |
| **Suggested fix** | Optional: gate verbose logging behind `NODE_ENV === 'development'` or remove in production. |

---

## iOS (low / code quality)

### 8. Unnecessary force unwrap after assignment (iOS)

| Field | Value |
|-------|--------|
| **File** | [huntco 2-2-2-2-4-5-8-5-3-3-8-5.0/Huntco/ClientContractCompletionView.swift](huntco%202-2-2-2-4-5-8-5-3-3-8-5.0/Huntco/ClientContractCompletionView.swift) |
| **Location** | Lines 561–562: `contract!.clientName` immediately after `contract = HuntContractDetail(...)` |
| **Description** | `contract` is assigned just above, so it is non-nil here. The force unwrap is redundant and could become unsafe if the code is refactored. |
| **Suggested fix** | Use `contract?.clientName` or `guard let contract = contract else { return }` (or a local `let`) for clarity and future safety. |

### 9. Optional force unwraps in success history / private tags (iOS)

| Field | Value |
|-------|--------|
| **File** | [huntco 2-2-2-2-4-5-8-5-3-3-8-5.0/Huntco/ClientSuccessHistoryView.swift](huntco%202-2-2-2-4-5-8-5-3-3-8-5.0/Huntco/ClientSuccessHistoryView.swift), [huntco 2-2-2-2-4-5-8-5-3-3-8-5.0/Huntco/ClientPrivateLandTagsView.swift](huntco%202-2-2-2-4-5-8-5-3-3-8-5.0/Huntco/ClientPrivateLandTagsView.swift) |
| **Location** | e.g. `photos[species]!`, `tag.clientEmail!` after nil checks |
| **Description** | In the reviewed snippets, the force unwraps are guarded by preceding nil checks, so crash risk is low. Using optional binding would be clearer and safer over time. |
| **Suggested fix** | Prefer `if let x = photos[species], !x.isEmpty` and `if let email = tag.clientEmail` instead of `!` where possible. |

---

## Summary

| Severity | Count |
|----------|--------|
| High    | 0     |
| Medium  | 2     |
| Low     | 5 (web) + 2 (iOS) |

**Recommended order of fixes:**  
1) Medium #1 (create-intent null handling).  
2) Medium #2 (explicit membership check for cookie-based admin routes).  
3) Low #3 and #4 (error vs “not found” for client lookups).  
4) Low #5 (currentContract guard).  
5) Low #6 (webhook amount_paid_cents).  
6) iOS items as part of normal iOS cleanup.

---

*Report generated from plan: Full-workspace bug review (pattern-based scan + high-risk path review + broader logic and iOS pass).*
