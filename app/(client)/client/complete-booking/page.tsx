"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import * as React from "react";

interface HuntInfo {
  id: string;
  title: string;
  species: string | null;
  unit: string | null;
  weapon: string | null;
  hunt_code: string | null;
  window_start: string | null;
  window_end: string | null;
}

interface PricingPlan {
  id: string;
  title: string;
  description: string;
  amount_usd: number;
  category: string;
  included_days: number | null;
  species: string | null;
  weapons: string | null;
}

interface AddonItem {
  id: string;
  title: string;
  description: string | null;
  amount_usd: number;
  category: string | null;
  addon_type?: string | null;
}

function isExtraDayItem(item: AddonItem): boolean {
  if (item.addon_type === "extra_days") return true;
  const t = (item.title ?? "").toLowerCase();
  if (t.includes("non")) return false; // avoid matching "Non-Hunter"
  return t.includes("additional day") || t.includes("extra day") || t.includes("day");
}

function isNonHunterItem(item: AddonItem): boolean {
  if (item.addon_type === "non_hunter") return true;
  const t = (item.title ?? "").toLowerCase();
  const cat = (item.category ?? "").toLowerCase();
  return cat === "add-ons" && (t.includes("non-hunter") || t.includes("non hunter"));
}

function isSpotterItem(item: AddonItem): boolean {
  if (item.addon_type === "spotter") return true;
  const t = (item.title ?? "").toLowerCase();
  const cat = (item.category ?? "").toLowerCase();
  return cat === "add-ons" && t.includes("spotter");
}

function isRifleRentalItem(item: AddonItem): boolean {
  if (item.addon_type === "rifle_rental") return true;
  const t = (item.title ?? "").toLowerCase();
  const cat = (item.category ?? "").toLowerCase();
  return cat === "add-ons" && (t.includes("rifle") && (t.includes("rental") || t.includes("rent")));
}

export default function CompleteBookingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const huntIdFromUrl = searchParams.get("hunt_id");
  const contractId = searchParams.get("contract_id");
  const returnTo = searchParams.get("return_to") || "/client/documents";

  const [hunt, setHunt] = useState<HuntInfo | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [addonItems, setAddonItems] = useState<AddonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [extraDays, setExtraDays] = useState(0);
  const [extraNonHunters, setExtraNonHunters] = useState(0);
  const [extraSpotters, setExtraSpotters] = useState(0);
  const [rifleRental, setRifleRental] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const huntId = hunt?.id ?? huntIdFromUrl;
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple loads
    if (hasLoadedRef.current || loading) return;
    if (!huntIdFromUrl && !contractId) {
      setError("Missing hunt_id or contract_id");
      setLoading(false);
      return;
    }
    
    hasLoadedRef.current = true;
    const query = huntIdFromUrl
      ? `hunt_id=${encodeURIComponent(huntIdFromUrl)}`
      : `contract_id=${encodeURIComponent(contractId!)}`;
    console.error("[complete-booking] Loading with:", { huntIdFromUrl, contractId, query });
    fetch(`/api/client/complete-booking?${query}`)
      .then(async (r) => {
        const text = await r.text();
        console.error("[complete-booking] Response status:", r.status, "Response:", text);
        if (!r.ok) {
          let errorMsg = "Failed to load booking details";
          try {
            const json = JSON.parse(text);
            errorMsg = json.error || errorMsg;
          } catch {
            errorMsg = text || errorMsg;
          }
          throw new Error(`${errorMsg} (Status: ${r.status})`);
        }
        return JSON.parse(text);
      })
      .then((data) => {
        console.error("[complete-booking] Success, data:", data);
        
        // If booking is already complete, show message and redirect
        if (data.booking_complete) {
          alert(data.message || "Your booking is already complete.");
          window.location.replace("/client/documents/hunt-contract");
          return;
        }
        
        setHunt(data.hunt);
        setPlans(data.pricing_plans || []);
        setAddonItems(data.addon_items || []);
        const guideOnly = (data.pricing_plans || []).filter((p: { category?: string }) => (p.category || "").trim().toLowerCase() !== "add-ons");
        if (guideOnly.length === 1) {
          setSelectedPlanId(guideOnly[0].id);
        }
        const addon = data.client_addon_data;
        if (addon && typeof addon === "object") {
          if (typeof addon.extra_days === "number" && addon.extra_days > 0) setExtraDays(addon.extra_days);
          if (typeof addon.extra_non_hunters === "number" && addon.extra_non_hunters > 0) setExtraNonHunters(addon.extra_non_hunters);
          if (typeof addon.extra_spotters === "number" && addon.extra_spotters > 0) setExtraSpotters(addon.extra_spotters);
          if (typeof addon.rifle_rental === "number" && addon.rifle_rental > 0) setRifleRental(addon.rifle_rental);
        }
      })
      .catch((e) => {
        const errorMsg = e.message || "Something went wrong";
        console.error("[complete-booking] ERROR:", errorMsg, e);
        setError(errorMsg);
      })
      .finally(() => {
        setLoading(false);
        // Reset ref if there was an error so user can retry
        if (error) {
          hasLoadedRef.current = false;
        }
      });
  }, [huntIdFromUrl, contractId]);

  // Step 1 shows only guide fees (exclude Add-ons category)
  const guideFeePlans = plans.filter((p) => (p.category || "").trim().toLowerCase() !== "add-ons");
  const selectedPlan = guideFeePlans.find((p) => p.id === selectedPlanId);
  const baseDays = selectedPlan?.included_days ?? 0;
  const requiredDays = baseDays + extraDays; // extra days add-on extends the date range
  const windowStart = hunt?.window_start ?? null;
  const windowEnd = hunt?.window_end ?? null;

  useEffect(() => {
    if (requiredDays > 0 && startDate && windowStart && windowEnd) {
      const start = new Date(startDate + "T00:00:00Z");
      const end = new Date(start);
      end.setDate(end.getDate() + requiredDays - 1);
      const endStr = end.toISOString().slice(0, 10);
      const clamped = windowEnd && endStr > windowEnd ? windowEnd : endStr;
      setEndDate(clamped);
    }
  }, [startDate, requiredDays, windowStart, windowEnd]);

  function handleSubmit() {
    if (!huntId || !startDate || !endDate) return;
    setSubmitting(true);
    setError(null);
    fetch("/api/client/complete-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hunt_id: huntId,
        pricing_item_id: selectedPlanId || undefined,
        client_start_date: startDate,
        client_end_date: endDate,
        extra_days: extraDays > 0 ? extraDays : undefined,
        extra_non_hunters: extraNonHunters > 0 ? extraNonHunters : undefined,
        extra_spotters: extraSpotters > 0 ? extraSpotters : undefined,
        rifle_rental: rifleRental > 0 ? rifleRental : undefined,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to save");
        return data;
      })
      .then((data) => {
        let msg = data.message || "Saved!";
        if (data.contract_created) {
          msg += " Your contract is ready—open Documents → Hunt Contract to complete and sign it.";
        } else if (data.contract_error) {
          msg += ` (Contract could not be created: ${data.contract_error})`;
        }
        alert(msg);
        // Full page redirect so contract page re-loads with updated hunt dates
        // Add booking_completed flag to prevent redirect loop
        const returnUrl = returnTo || "/client/documents";
        const separator = returnUrl.includes("?") ? "&" : "?";
        // Use sessionStorage to prevent immediate redirect loop
        sessionStorage.setItem("booking_just_completed", "true");
        window.location.replace(`${returnUrl}${separator}booking_completed=1`);
      })
      .catch((e) => {
        setError(e.message || "Failed to save");
        setSubmitting(false);
      });
  }

  const dateSpanDays = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1
    : 0;
  const formOk =
    step === 1
      ? selectedPlanId != null || guideFeePlans.length === 0
      : step === 2
        ? true
        : startDate &&
          endDate &&
          dateSpanDays >= 1 &&
          (requiredDays === 0 || dateSpanDays === requiredDays);

  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: "48px auto", padding: 24, textAlign: "center" }}>
        <p>Loading your hunt…</p>
      </div>
    );
  }

  if (error && !hunt) {
    return (
      <div style={{ maxWidth: 600, margin: "48px auto", padding: 24 }}>
        <p style={{ color: "#c00", marginBottom: 16 }}>{error}</p>
        <Link href="/client/private-tags" style={{ color: "#1a472a", fontWeight: 600 }}>
          ← Back to Tags
        </Link>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "32px auto", padding: 24 }}>
      <Link href="/client/private-tags" style={{ color: "#1a472a", textDecoration: "none", fontSize: 14, marginBottom: 16, display: "inline-block" }}>
        ← Back to Tags
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Complete your booking</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        You’ve paid for your tag. Choose your guide fee, any add-ons, then your hunt dates.
      </p>

      {hunt && (
        <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Your hunt</div>
          <div style={{ fontWeight: 600 }}>{hunt.title}</div>
          {hunt.species && <span style={{ marginRight: 12 }}>{hunt.species}</span>}
          {hunt.weapon && <span style={{ marginRight: 12 }}>{hunt.weapon}</span>}
          {hunt.hunt_code && <span style={{ fontFamily: "monospace" }}>{hunt.hunt_code}</span>}
          {hunt.window_start && hunt.window_end && (
            <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
              Season: {hunt.window_start} – {hunt.window_end}
            </div>
          )}
        </div>
      )}

      {step === 1 ? (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Step 1: Choose your guide fee</h2>
          <p style={{ color: "#666", marginBottom: 16, fontSize: 14 }}>
            Guide fee options that match your hunt’s species and weapon are shown. The number of days in the plan sets how many days you’ll pick in the next step.
          </p>
          {guideFeePlans.length === 0 ? (
            <p style={{ color: "#666", marginBottom: 16 }}>No guide fee options match this hunt yet. You can still pick your dates below.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {guideFeePlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  style={{
                    padding: 16,
                    textAlign: "left",
                    border: selectedPlanId === plan.id ? "2px solid #1a472a" : "1px solid #ddd",
                    borderRadius: 8,
                    background: selectedPlanId === plan.id ? "#f0f7f4" : "#fff",
                    cursor: "pointer",
                    fontSize: 15,
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{plan.title}</span>
                    <span style={{ color: "#1a472a", fontWeight: 700, fontSize: 18 }}>
                      ${Number(plan.amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {plan.description && (
                    <div style={{ fontSize: 13, color: "#666", marginBottom: 8, lineHeight: 1.5 }}>{plan.description}</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#555" }}>
                    {plan.included_days != null && (
                      <div><strong>Days:</strong> {plan.included_days}-day hunt</div>
                    )}
                    {plan.species && (
                      <div><strong>Species:</strong> {plan.species}</div>
                    )}
                    {plan.weapons && (
                      <div><strong>Weapons:</strong> {plan.weapons.replace(/,/g, ", ")}</div>
                    )}
                    {plan.category && (
                      <div><strong>Category:</strong> {plan.category}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={guideFeePlans.length > 0 && !selectedPlanId}
            style={{
              padding: "12px 24px",
              background: guideFeePlans.length > 0 && !selectedPlanId ? "#ccc" : "#1a472a",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: guideFeePlans.length > 0 && !selectedPlanId ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            Next: Add-ons
          </button>
        </>
      ) : step === 2 ? (
        <>
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{
              marginBottom: 16,
              padding: "8px 16px",
              background: "#f0f0f0",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back to guide fee
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Step 2: Add-ons (optional)</h2>
          <div style={{ 
            background: "#fff3cd", 
            border: "1px solid #ffc107", 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 16 
          }}>
            <p style={{ fontSize: 13, color: "#856404", margin: 0, fontWeight: 600 }}>
              ⚠️ Note: Add-on prices are <strong>per item</strong> (per day, per person), not a total hunt price.
            </p>
            <p style={{ fontSize: 12, color: "#856404", margin: "6px 0 0 0" }}>
              Example: "Extra Day" at $500 = $500 per additional day. "Non-Hunter" at $200 = $200 per non-hunting companion.
            </p>
          </div>
          <p style={{ color: "#666", marginBottom: 16, fontSize: 14 }}>
            Add as many add-ons as you like. Extra days will extend your hunt; the date picker in the next step will use your total days.
          </p>
          {(addonItems.length > 0 ? addonItems : [
            { id: "_extra_day", title: "Additional Day(s)", description: "Per day", amount_usd: 0, category: "Add-ons" as string | null },
            { id: "_non_hunter", title: "Non-Hunter", description: "Per person", amount_usd: 0, category: "Add-ons" as string | null },
            { id: "_spotter", title: "Spotter", description: "Per person", amount_usd: 0, category: "Add-ons" as string | null, addon_type: "spotter" as string | null },
          ]).map((item) => {
            const isExtra = isExtraDayItem(item);
            const isNon = isNonHunterItem(item);
            const isSpotter = isSpotterItem(item);
            const isRifle = isRifleRentalItem(item);
            const value = isExtra ? extraDays : isNon ? extraNonHunters : isSpotter ? extraSpotters : isRifle ? rifleRental : 0;
            const hasControl = isExtra || isNon || isSpotter || isRifle;
            return (
              <div key={item.id} style={{ marginBottom: 16, padding: 16, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{item.title}</div>
                    {item.description && (
                      <div style={{ fontSize: 13, color: "#666", marginBottom: 8, lineHeight: 1.5 }}>{item.description}</div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                      {item.amount_usd != null && item.amount_usd > 0 && (
                        <div style={{ color: "#1a472a", fontWeight: 600 }}>
                          ${Number(item.amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                        </div>
                      )}
                      {item.category && (
                        <div style={{ color: "#888", fontSize: 12 }}>
                          Category: {item.category}
                        </div>
                      )}
                      {item.addon_type && (
                        <div style={{ color: "#888", fontSize: 12 }}>
                          Type: {item.addon_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => isExtra ? setExtraDays((p) => Math.max(0, p - 1)) : isNon ? setExtraNonHunters((p) => Math.max(0, p - 1)) : isSpotter ? setExtraSpotters((p) => Math.max(0, p - 1)) : isRifle ? setRifleRental((p) => Math.max(0, p - 1)) : undefined}
                      style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: hasControl ? "pointer" : "default", fontSize: 18 }}
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{value}</span>
                    <button
                      type="button"
                      onClick={() => isExtra ? setExtraDays((p) => p + 1) : isNon ? setExtraNonHunters((p) => p + 1) : isSpotter ? setExtraSpotters((p) => p + 1) : isRifle ? setRifleRental((p) => p + 1) : undefined}
                      style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: hasControl ? "pointer" : "default", fontSize: 18 }}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setStep(3)}
            style={{
              padding: "12px 24px",
              background: "#1a472a",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Next: Pick your dates
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setStep(2)}
            style={{
              marginBottom: 16,
              padding: "8px 16px",
              background: "#f0f0f0",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back to add-ons
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Step 3: Pick your hunt dates</h2>
          <p style={{ color: "#666", marginBottom: 16, fontSize: 14 }}>
            {requiredDays > 0
              ? `Your plan includes ${baseDays} days${extraDays > 0 ? ` plus ${extraDays} extra day(s)` : ""}, for a total of ${requiredDays} days. Choose your arrival date; your departure will be ${requiredDays} days later.`
              : "Choose your arrival and departure dates within the season."}
          </p>
          {windowStart && windowEnd && (
            <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
              Season window: {windowStart} – {windowEnd}
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Arrival (first day)</label>
              <input
                type="date"
                value={startDate}
                min={windowStart ?? undefined}
                max={windowEnd ?? undefined}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Departure (last day)</label>
              <input
                type="date"
                value={endDate}
                min={(startDate || windowStart) ?? undefined}
                max={windowEnd ?? undefined}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          </div>
          {error && <p style={{ color: "#c00", marginBottom: 16 }}>{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formOk || submitting}
            style={{
              padding: "12px 24px",
              background: !formOk || submitting ? "#ccc" : "#1a472a",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: !formOk || submitting ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "Saving…" : "Save and continue"}
          </button>
        </>
      )}
    </main>
  );
}
