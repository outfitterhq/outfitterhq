"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import InAppSigningFlow from "@/app/(client)/components/InAppSigningFlow";

interface ContractItem {
  id: string;
  status: string;
  content?: string;
  client_completed_at?: string;
  client_signed_at?: string;
  signed_at?: string;
  /** From API: hunt code and window at contract level so client can always restrict dates */
  hunt_code?: string | null;
  hunt_window_start?: string | null;
  hunt_window_end?: string | null;
  /** private_land | unit_wide – when unit_wide, client must answer unit-wide question before submit */
  tag_type?: string | null;
  /** When true, client must select dates and guide fee (complete-booking) before opening contract. Used for draw. */
  needs_complete_booking?: boolean;
  hunt_id?: string | null;
  /** Add-on prices for extra days, non-hunters, and spotter (always set; defaults if outfitter has no pricing items) */
  addon_pricing?: { extra_day_usd: number; non_hunter_usd: number; spotter_usd: number };
  /** Base guide fee from selected pricing item (for price summary) */
  base_guide_fee_usd?: number;
  /** Contract total in cents (for displaying total) */
  contract_total_cents?: number;
  /** Stored completion data (for prefilling form when contract already has add-ons) */
  client_completion_data?: Record<string, unknown> | null;
  hunt?: {
    title: string;
    start_date: string;
    end_date: string;
    species?: string;
    unit?: string;
    weapon?: string | null;
    camp_name?: string | null;
    hunt_code?: string | null;
    hunt_window_start?: string | null;
    hunt_window_end?: string | null;
  };
}

interface ContractData {
  eligible: boolean;
  contracts: ContractItem[];
  reason?: string;
  hunts_without_contracts?: { id: string; needs_complete_booking?: boolean }[];
  client_email?: string;
}

export default function HuntContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractIdFromUrl = searchParams.get("contract");
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingLoading, setCompletingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedContractIndex, setSelectedContractIndex] = useState(0);
  const [fetchedHuntWindow, setFetchedHuntWindow] = useState<{ start: string; end: string } | null>(null);
  const [huntWindowLoading, setHuntWindowLoading] = useState(false);
  const [huntWindowError, setHuntWindowError] = useState(false);
  // Booking form state (integrated into contract page)
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [bookingPlans, setBookingPlans] = useState<any[]>([]);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);
  const [bookingHunt, setBookingHunt] = useState<any>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [extraDays, setExtraDays] = useState(0);
  const [extraNonHunters, setExtraNonHunters] = useState(0);
  const [extraSpotters, setExtraSpotters] = useState(0);
  const [rifleRental, setRifleRental] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Guide fee bill (when contract is fully signed)
  const [guideFeeBill, setGuideFeeBill] = useState<{
    amount_usd: number;
    description: string;
    payment_item_id?: string;
    total_cents: number;
    balance_due_cents?: number;
    payment_plan: boolean;
    installments?: { payment_item_id: string; amount_cents: number; amount_usd: string; due_date: string; status: string }[];
  } | null>(null);
  const [guideFeeLoading, setGuideFeeLoading] = useState(false);
  const [guideFeeError, setGuideFeeError] = useState<string | null>(null);
  const [paymentPlanModal, setPaymentPlanModal] = useState(false);
  const [paymentPlanSaving, setPaymentPlanSaving] = useState(false);
  const [paymentPlanNumPayments, setPaymentPlanNumPayments] = useState(4);
  const [paymentPlanFirstDue, setPaymentPlanFirstDue] = useState("");
  const [contractDiagnostic, setContractDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [showFullContractModal, setShowFullContractModal] = useState(false);
  const [simulatePaymentLoading, setSimulatePaymentLoading] = useState(false);

  const allowSimulatePayment =
    searchParams.get("simulate") === "1" || process.env.NEXT_PUBLIC_ALLOW_SIMULATE_PAYMENT === "true";

  // Completion form state (if contract needs client completion)
  // Note: Dates come from hunt.start_date/end_date (set in complete-booking), not from user input here
  const [completionData, setCompletionData] = useState({
    acknowledgment: false,
    additionalInfo: "",
    extra_days: 0,
    extra_non_hunters: 0,
    extra_spotters: 0,
  });

  useEffect(() => {
    loadContract();
    
    // Safety: Force clear loading after 35 seconds no matter what
    const safetyTimer = setTimeout(() => {
      console.error("[hunt-contract] SAFETY TIMEOUT - forcing loading to false");
      setLoading(false);
      if (!data && !error) {
        setError("Page took too long to load. Please refresh.");
      }
    }, 35000);
    
    return () => clearTimeout(safetyTimer);
  }, []);

  // When client returns to this tab, refetch so they see "Sign via DocuSign" after outfitter sends it
  useEffect(() => {
    const onFocus = () => {
      if (!loading) loadContract();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loading]);

  const currentContract = data?.contracts?.[selectedContractIndex];
  const isComplete = currentContract?.status === "client_signed" || currentContract?.status === "fully_executed";

  // Prefill completion form from contract when it has client_completion_data (e.g. from complete-booking)
  useEffect(() => {
    const cc = currentContract?.client_completion_data;
    if (!cc || typeof cc !== "object" || currentContract?.status !== "pending_client_completion") return;
    const o = cc as Record<string, unknown>;
    const num = (v: unknown) => Math.max(0, parseInt(String(v ?? ""), 10) || Number(v) || 0);
    setCompletionData((prev) => ({
      ...prev,
      extra_days: num(o.extra_days ?? o.additional_days ?? prev.extra_days),
      extra_non_hunters: num(o.extra_non_hunters ?? o.non_hunters ?? prev.extra_non_hunters),
      extra_spotters: num(o.extra_spotters ?? prev.extra_spotters),
    }));
  }, [currentContract?.id, currentContract?.status, currentContract?.client_completion_data]);

  // Load guide fee bill only when contract is fully executed (both parties signed)
  useEffect(() => {
    if (!isComplete || !currentContract?.id || currentContract?.status !== "fully_executed") {
      setGuideFeeBill(null);
      setGuideFeeError(null);
      return;
    }
    let cancelled = false;
    setGuideFeeLoading(true);
    setGuideFeeError(null);
    fetch(`/api/client/guide-fee-bill?contract_id=${encodeURIComponent(currentContract.id)}`)
      .then((res) => {
        if (cancelled) return res.json();
        if (!res.ok) return res.json().then((err) => { setGuideFeeError(err.error || "Failed to load guide fee"); return null; });
        return res.json();
      })
      .then((bill) => {
        if (cancelled || !bill) return;
        if (bill.error) {
          setGuideFeeError(bill.error);
          return;
        }
        setGuideFeeBill(bill);
      })
      .catch(() => { if (!cancelled) setGuideFeeError("Failed to load guide fee"); })
      .finally(() => { if (!cancelled) setGuideFeeLoading(false); });
    return () => { cancelled = true; };
  }, [isComplete, currentContract?.id]);

  // Load booking data when contract needs booking
  useEffect(() => {
    const contract = data?.contracts?.[selectedContractIndex];
    if (!contract?.needs_complete_booking || bookingLoading || bookingHunt) return;
    
    const huntId = contract.hunt_id;
    const contractId = contract.id;
    if (!huntId && !contractId) return;
    
    setBookingLoading(true);
    setBookingError(null);
    const query = huntId ? `hunt_id=${encodeURIComponent(huntId)}` : `contract_id=${encodeURIComponent(contractId)}`;
    fetch(`/api/client/complete-booking?${query}`)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          let errorMsg = "Failed to load booking details";
          try {
            const json = JSON.parse(text);
            errorMsg = json.error || errorMsg;
          } catch {
            errorMsg = text || errorMsg;
          }
          throw new Error(errorMsg);
        }
        return r.json();
      })
      .then((data) => {
        if (data.booking_complete) {
          // Booking already complete, reload contract
          loadContract();
          return;
        }
        setBookingHunt(data.hunt);
        setBookingPlans(data.pricing_plans || []);
        setBookingAddons(data.addon_items || []);
        const addon = data.client_addon_data;
        if (addon && typeof addon === "object") {
          if (typeof addon.extra_days === "number") setExtraDays(addon.extra_days);
          if (typeof addon.extra_non_hunters === "number") setExtraNonHunters(addon.extra_non_hunters);
          if (typeof addon.extra_spotters === "number") setExtraSpotters(addon.extra_spotters);
          if (typeof addon.rifle_rental === "number") setRifleRental(addon.rifle_rental);
        }
      })
      .catch((e) => {
        setBookingError(e.message || "Failed to load booking details");
      })
      .finally(() => {
        setBookingLoading(false);
      });
  }, [data, selectedContractIndex, bookingLoading, bookingHunt]);

  // Auto-calculate end date when start date changes (for booking form)
  useEffect(() => {
    const contract = data?.contracts?.[selectedContractIndex];
    const needsBooking = contract?.needs_complete_booking ?? false;
    if (!needsBooking || !bookingHunt) return;
    const guideFeePlans = bookingPlans.filter((p) => (p.category || "").trim().toLowerCase() !== "add-ons");
    const selectedPlan = guideFeePlans.find((p) => p.id === selectedPlanId);
    const baseDays = selectedPlan?.included_days ?? null;
    const requiredDays = baseDays != null ? baseDays + extraDays : null;
    const windowStart = bookingHunt?.window_start ?? null;
    const windowEnd = bookingHunt?.window_end ?? null;
    
    if (requiredDays != null && requiredDays > 0 && startDate && windowStart && windowEnd) {
      const start = new Date(startDate + "T00:00:00Z");
      const end = new Date(start);
      end.setDate(end.getDate() + requiredDays - 1);
      const endStr = end.toISOString().slice(0, 10);
      const clamped = windowEnd && endStr > windowEnd ? windowEnd : endStr;
      setEndDate(clamped);
    }
  }, [startDate, selectedPlanId, extraDays, bookingPlans, bookingHunt, data, selectedContractIndex]);

  // When contract needs completion and has hunt_code but no hunt_window, fetch window from API
  useEffect(() => {
    const contract = data?.contracts?.[selectedContractIndex];
    const hunt = contract?.hunt;
    const needsCompletion = contract?.status === "pending_client_completion";
    const huntCodeFromContent =
      contract?.content &&
      (contract.content.match(/- Hunt Code:\s*([A-Za-z0-9-]+)/i) ||
        contract.content.match(/Hunt Code:\s*([A-Za-z0-9-]+)/i))?.[1]?.trim();
    const huntCode = contract?.hunt_code ?? hunt?.hunt_code ?? huntCodeFromContent ?? null;
    const hasWindow =
      (contract?.hunt_window_start && contract?.hunt_window_end) ||
      (hunt?.hunt_window_start && hunt?.hunt_window_end);

    if (!huntCode || hasWindow) {
      setFetchedHuntWindow(null);
      setHuntWindowLoading(false);
      setHuntWindowError(false);
      return;
    }
    if (!needsCompletion) return;

    setHuntWindowLoading(true);
    setHuntWindowError(false);
    fetch(`/api/hunt-codes?code=${encodeURIComponent(huntCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => {
        if (row?.start_date && row?.end_date) {
          const toYMD = (d: string) => {
            const parsed = new Date(d);
            if (Number.isNaN(parsed.getTime())) return d;
            return parsed.toISOString().slice(0, 10);
          };
          setFetchedHuntWindow({
            start: toYMD(row.start_date),
            end: toYMD(row.end_date),
          });
          setHuntWindowError(false);
        } else {
          setFetchedHuntWindow(null);
          setHuntWindowError(true);
        }
      })
      .catch(() => {
        setFetchedHuntWindow(null);
        setHuntWindowError(true);
      })
      .finally(() => setHuntWindowLoading(false));
  }, [data?.contracts, selectedContractIndex]);

  async function loadContract() {
    setError(null);
    setLoading(true);
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      console.log("[hunt-contract] Starting fetch...");
      const startTime = Date.now();
      const res = await fetch(`/api/client/hunt-contract?fix_bill=1&_=${Date.now()}`, { 
        credentials: "include",
        signal: controller.signal,
      });
      
      const fetchTime = Date.now() - startTime;
      console.log("[hunt-contract] Fetch completed in", fetchTime, "ms, status:", res.status);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const json = await res.json().catch((e) => {
        console.error("[hunt-contract] JSON parse error:", e);
        return {};
      });
      if (!res.ok) {
        const msg = json.error || "Failed to load contract";
        setError(res.status === 401 ? "Please sign in again. Your session may have expired." : msg);
        setData({ eligible: false, contracts: [], hunts_without_contracts: json.hunts_without_contracts ?? [] });
        setLoading(false);
        return;
      }

      // Support both { contracts } and { data: { contracts } } response shapes
      const contractsRaw = Array.isArray(json.contracts) ? json.contracts : (json.data?.contracts ?? []);
      const selectedIdx = contractIdFromUrl
        ? contractsRaw.findIndex((c: { id: string }) => c.id === contractIdFromUrl)
        : 0;

      // API returns { contracts: [...], eligible: boolean } – show all contracts
      if (contractsRaw.length > 0) {
        const contracts: ContractItem[] = json.contracts.map((contract: any) => {
          const rawHunt = contract.hunt || contract.calendar_events;
          const hunt = Array.isArray(rawHunt) ? rawHunt[0] : rawHunt;
          const huntCode = contract.hunt_code ?? hunt?.hunt_code;
          const windowStart = contract.hunt_window_start ?? hunt?.hunt_window_start;
          const windowEnd = contract.hunt_window_end ?? hunt?.hunt_window_end;
          const needsBooking = contract.needs_complete_booking ?? false;
          const huntId = contract.hunt_id ?? hunt?.id ?? null;
          
          console.log("[hunt-contract] Processing contract:", {
            id: contract.id,
            needs_complete_booking: needsBooking,
            hunt_id: huntId,
            hasHunt: !!hunt,
            hasDates: !!(hunt?.start_time || hunt?.start_date),
            hasPrice: !!contract.base_guide_fee_usd,
          });
          
          return {
            id: contract.id,
            status: contract.status,
            content: contract.content,
            client_completed_at: contract.client_completed_at,
            client_signed_at: contract.client_signed_at,
            signed_at: contract.client_signed_at || contract.admin_signed_at,
            hunt_code: huntCode ?? null,
            hunt_window_start: windowStart ?? null,
            hunt_window_end: windowEnd ?? null,
            tag_type: contract.tag_type ?? null,
            needs_complete_booking: needsBooking,
            addon_pricing: contract.addon_pricing ?? undefined,
            base_guide_fee_usd: contract.base_guide_fee_usd ?? undefined,
            client_completion_data: contract.client_completion_data ?? undefined,
            hunt_id: huntId,
            hunt: hunt ? {
              title: hunt.title || "Hunt",
              // API returns start_time/end_time, convert to start_date/end_date for consistency
              start_date: hunt.start_time || hunt.start_date,
              end_date: hunt.end_time || hunt.end_date,
              species: hunt.species,
              unit: hunt.unit,
              weapon: hunt.weapon ?? null,
              camp_name: hunt.camp_name ?? null,
              hunt_code: huntCode ?? hunt.hunt_code,
              hunt_window_start: windowStart ?? hunt.hunt_window_start,
              hunt_window_end: windowEnd ?? hunt.hunt_window_end,
            } : undefined,
          };
        });
        
        // ALWAYS set data and clear loading - page MUST render first
        // Redirect logic is handled separately in useEffect
        const selectedIdx = contractIdFromUrl
          ? contracts.findIndex((c) => c.id === contractIdFromUrl)
          : 0;
        
        setData({
          eligible: true,
          contracts,
          hunts_without_contracts: json.hunts_without_contracts ?? [],
          client_email: json.client_email,
        });
        setSelectedContractIndex(selectedIdx >= 0 ? selectedIdx : 0);
        setLoading(false); // MUST clear loading immediately
        
        console.log("[hunt-contract] Contracts loaded:", contracts.length, "contracts, loading cleared");
      } else {
        console.log("[hunt-contract] No contracts found");
        setData({
          eligible: json.eligible ?? true,
          contracts: [],
          reason: json.reason || "No contract available yet.",
          hunts_without_contracts: json.hunts_without_contracts ?? [],
          client_email: json.client_email,
        });
        setLoading(false);
      }
    } catch (e: any) {
      // Clear timeout if still active
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      console.error("[hunt-contract] Error loading contract:", e);
      
      // Handle abort/timeout errors gracefully
      if (e.name === 'AbortError' || e.message?.includes('timeout')) {
        setError("Request timed out. Please try refreshing the page.");
      } else {
        setError(e?.message || String(e) || "Failed to load contract");
      }
      setData((prev) => prev ?? { eligible: false, contracts: [], hunts_without_contracts: [] });
      setLoading(false);
    }
  }

  async function handleCompleteContract() {
    if (!currentContract?.id) return;

    const hunt = currentContract?.hunt;
    // Debug: log what we have
    console.log("Contract submission - hunt object:", {
      hunt: hunt,
      start_date: hunt?.start_date,
      end_date: hunt?.end_date,
      start_time: (hunt as any)?.start_time,
      end_time: (hunt as any)?.end_time,
    });
    const huntCode =
      currentContract?.hunt_code ?? hunt?.hunt_code ?? null;
    const windowStart =
      currentContract?.hunt_window_start?.slice(0, 10) ??
      hunt?.hunt_window_start?.slice(0, 10) ??
      fetchedHuntWindow?.start;
    const windowEnd =
      currentContract?.hunt_window_end?.slice(0, 10) ??
      hunt?.hunt_window_end?.slice(0, 10) ??
      fetchedHuntWindow?.end;
    const hasHuntCode = Boolean(huntCode);
    const hasWindow = Boolean(windowStart && windowEnd);

    // Dates come from hunt object (set in complete-booking flow), not from user input
    // Handle both start_date/end_date and start_time/end_time (API might return either)
    const toYMD = (s: string | undefined) => (s && s.length >= 10 ? s.slice(0, 10) : "");
    const huntAny = hunt as any;
    const startDate = toYMD(hunt?.start_date || huntAny?.start_time);
    const endDate = toYMD(hunt?.end_date || huntAny?.end_time);

    if (hasHuntCode && hasWindow && startDate && endDate && windowStart && windowEnd) {
      if (startDate < windowStart || endDate > windowEnd || startDate > endDate) {
        setError("Hunt dates must be within your hunt code season: " + windowStart + " – " + windowEnd + ".");
        return;
      }
    }

    if (!startDate || !endDate) {
      setError("Hunt dates are required. Your hunt details at the top should show dates; if not, contact your outfitter.");
      return;
    }

    setCompletingLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/client/hunt-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: currentContract.id,
          completion_data: {
            acknowledgment: completionData.acknowledgment,
            additionalInfo: completionData.additionalInfo,
            client_start_date: startDate,
            client_end_date: endDate,
            extra_days: completionData.extra_days,
            extra_non_hunters: completionData.extra_non_hunters,
            extra_spotters: completionData.extra_spotters,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMsg = err.error || "Failed to complete contract";
        console.error("Contract submission error:", {
          status: res.status,
          statusText: res.statusText,
          error: err,
        });
        throw new Error(errorMsg);
      }

      const json = await res.json();
      setSuccessMessage(json.message || "Contract submitted successfully!");
      console.log("Contract submitted successfully:", json);
      
      // Reload contract data
      await loadContract();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCompletingLoading(false);
    }
  }

  async function handleSignInApp({ typedName }: { typedName: string }) {
    if (!currentContract?.id) return;
    const res = await fetch("/api/client/hunt-contract/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_id: currentContract.id, typed_name: typedName }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to sign");
    setSuccessMessage(json.message ?? "Contract signed successfully.");
    await loadContract();
  }


  // Show loading only if we have no data and no error
  if (loading && !data && !error) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading contract...</p>
        <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
          If this takes more than 30 seconds, please refresh the page.
        </p>
      </div>
    );
  }
  
  // Show error if we have one and no data
  if (error && !data) {
    return (
      <div style={{ maxWidth: 600, margin: "48px auto", padding: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Error</h2>
        <p style={{ color: "#d32f2f", marginBottom: 24 }}>{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadContract();
          }}
          style={{
            padding: "12px 24px",
            background: "var(--client-accent, #1a472a)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Check if contract needs booking (missing pricing or dates) - should redirect, not show form
  const needsBooking = currentContract?.needs_complete_booking ?? false;
  const needsCompletion = currentContract?.status === "pending_client_completion" && !needsBooking;
  const pendingReview = currentContract?.status === "pending_admin_review";
  const approvedWaitingDocuSign = currentContract?.status === "ready_for_signature";
  const readyForSignature = currentContract?.status === "sent_to_docusign";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/documents"
          style={{ color: "var(--client-accent, #1a472a)", textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Documents
        </Link>
      </div>

      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Hunt Contract</h1>
          <p style={{ color: "#666" }}>
            Your final hunt contract with dates, pricing, and terms.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); loadContract(); }}
          disabled={loading}
          style={{
            padding: "8px 16px",
            border: "1px solid var(--client-accent, #1a472a)",
            borderRadius: 8,
            background: "white",
            color: "var(--client-accent, #1a472a)",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <div style={{ marginBottom: 24 }}>
        {data?.contracts && data.contracts.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "#555", marginRight: 8 }}>Contract:</label>
            <select
              value={selectedContractIndex}
              onChange={(e) => setSelectedContractIndex(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: 6,
                fontSize: 14,
                minWidth: 280,
              }}
            >
              {data.contracts.map((c, i) => (
                <option key={c.id} value={i}>
                  {c.hunt?.title || `Contract ${i + 1}`} {c.status === "fully_executed" || c.status === "client_signed" ? "✓" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            background: "#e8f5e9",
            color: "#2e7d32",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          {successMessage}
        </div>
      )}


      {!data?.eligible || !(data.contracts?.length) ? (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            Hunt Contract Not Available Yet
          </h2>
          <p style={{ color: "#666", maxWidth: 400, margin: "0 auto 24px" }}>
            {data?.hunts_without_contracts?.length && data.hunts_without_contracts.every((h) => !h.needs_complete_booking)
              ? "You've completed your booking. Your outfitter will generate your contract and send it to you shortly."
              : data?.reason ||
                "Your hunt contract will be available after you receive your tag (draw success or private land purchase)."}
          </p>
          <p style={{ color: "#888", fontSize: 13, maxWidth: 400, margin: "0 auto 24px" }}>
            If you see your contract in the app but not here, try signing out and back in on the web.
          </p>
          <Link
            href="/client/documents"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#f5f5f5",
              color: "#666",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Back to Documents
          </Link>
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch("/api/client/hunt-contract?debug=1", { credentials: "include" });
                  const data = await res.json();
                  setContractDiagnostic(data.debug || { note: "No debug info", status: res.status, error: data.error });
                } catch (e) {
                  setContractDiagnostic({ error: String(e) });
                }
              }}
              style={{
                padding: "8px 16px",
                background: "#f0f0f0",
                border: "1px solid #ccc",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Why is my contract missing? Run diagnostic
            </button>
            {contractDiagnostic && (
              <pre
                style={{
                  marginTop: 16,
                  textAlign: "left",
                  background: "#f9f9f9",
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: "auto",
                  maxWidth: "100%",
                }}
              >
                {JSON.stringify(contractDiagnostic, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ) : isComplete ? (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#2e7d32" }}>
            Contract Signed
          </h2>
          <p style={{ color: "#666", marginBottom: 24 }}>
            Your hunt contract was signed on{" "}
            {currentContract?.signed_at
              ? new Date(currentContract.signed_at).toLocaleDateString()
              : "record"}.
          </p>
          {currentContract?.hunt && (
            <div
              style={{
                background: "#f0f7f4",
                border: "1px solid #c8e6c9",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
                textAlign: "left",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>{currentContract.hunt.title}</h3>
              <p style={{ color: "#666", margin: 0, fontSize: 14 }}>
                {formatDate(currentContract.hunt.start_date)} - {formatDate(currentContract.hunt.end_date)}
                {currentContract.hunt.species && ` • ${currentContract.hunt.species}`}
                {currentContract.hunt.unit && ` • Unit ${currentContract.hunt.unit}`}
              </p>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => setShowFullContractModal(true)}
              style={{
                padding: "12px 24px",
                background: "white",
                color: "var(--client-accent, #1a472a)",
                border: "2px solid var(--client-accent, #1a472a)",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              View full contract
            </button>
          </div>

          {/* Guide fee bill: pay in full or set up payment plan (only when contract is fully executed - both parties signed) */}
          {currentContract?.status === "fully_executed" && (
            <>
              {guideFeeLoading && (
                <p style={{ marginBottom: 24, color: "#666" }}>Loading guide fee…</p>
              )}
              {guideFeeError && !guideFeeLoading && (
                <div style={{ marginBottom: 24, padding: 16, background: "#fff3e0", borderRadius: 8, border: "1px solid #ffb74d", textAlign: "left" }}>
                  <strong>Guide fee</strong>
                  <p style={{ margin: "8px 0 0", color: "#666", fontSize: 14 }}>{guideFeeError}</p>
                </div>
              )}
              {guideFeeBill && !guideFeeLoading && (
            <div
              style={{
                marginBottom: 24,
                padding: 24,
                background: "#f5f5f5",
                borderRadius: 8,
                border: "1px solid #ddd",
                textAlign: "left",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600 }}>Guide fee</h3>
              <p style={{ margin: "0 0 8px", color: "#555", fontSize: 14 }}>
                Contract total ({guideFeeBill.description}):{" "}
                <strong>${(guideFeeBill.amount_usd ?? guideFeeBill.total_cents / 100).toLocaleString()}</strong>
                {" — "}
                Amount due (includes platform fee):{" "}
                <strong>${(guideFeeBill.balance_due_cents != null ? guideFeeBill.balance_due_cents / 100 : guideFeeBill.total_cents / 100).toLocaleString()}</strong>
              </p>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888" }}>
                The contract total should match the Total in the BILL section when you view the full contract.
              </p>
              {guideFeeBill.payment_plan && guideFeeBill.installments && guideFeeBill.installments.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>Payment plan</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {guideFeeBill.installments.map((inst) => (
                      <li key={inst.payment_item_id} style={{ marginBottom: 6, fontSize: 14 }}>
                        ${(inst.amount_cents / 100).toLocaleString()} due {formatDate(inst.due_date)}
                        {inst.status === "paid" ? (
                          <span style={{ color: "#2e7d32", marginLeft: 8 }}>Paid</span>
                        ) : (
                          <Link
                            href={`/client/pay?item_id=${encodeURIComponent(inst.payment_item_id)}`}
                            style={{ marginLeft: 12, color: "var(--client-accent, #1a472a)", fontWeight: 600 }}
                          >
                            Pay
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {guideFeeBill.payment_item_id && (
                    <Link
                      href={`/client/pay?item_id=${encodeURIComponent(guideFeeBill.payment_item_id)}`}
                      style={{
                        display: "inline-block",
                        padding: "10px 20px",
                        background: "var(--client-accent, #1a472a)",
                        color: "white",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Pay in full
                    </Link>
                  )}
                  {guideFeeBill.payment_item_id && allowSimulatePayment && (
                    <button
                      type="button"
                      disabled={simulatePaymentLoading || (guideFeeBill.balance_due_cents ?? guideFeeBill.total_cents) <= 0}
                      onClick={async () => {
                        setSimulatePaymentLoading(true);
                        setSuccessMessage(null);
                        try {
                          const res = await fetch("/api/client/simulate-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ payment_item_id: guideFeeBill.payment_item_id }),
                          });
                          const json = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            setError(json.error || "Simulate payment failed.");
                            return;
                          }
                          setSuccessMessage("Payment simulated. Balance updated.");
                          const refetch = await fetch(`/api/client/guide-fee-bill?contract_id=${encodeURIComponent(currentContract!.id)}`);
                          const bill = await refetch.json();
                          if (bill && !bill.error) setGuideFeeBill(bill);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Simulate payment failed.");
                        } finally {
                          setSimulatePaymentLoading(false);
                        }
                      }}
                      style={{
                        padding: "10px 20px",
                        background: "white",
                        color: "#e65100",
                        border: "2px solid #e65100",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: simulatePaymentLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {simulatePaymentLoading ? "Simulating…" : "Simulate payment (testing)"}
                    </button>
                  )}
                  {guideFeeBill.payment_item_id && (
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + 1);
                        setPaymentPlanFirstDue(d.toISOString().slice(0, 10));
                        setPaymentPlanModal(true);
                      }}
                      style={{
                        padding: "10px 20px",
                        background: "white",
                        color: "var(--client-accent, #1a472a)",
                        border: "2px solid var(--client-accent, #1a472a)",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      Set up payment plan
                    </button>
                  )}
                </div>
              )}
            </div>
              )}
            </>
          )}

          {paymentPlanModal && currentContract?.id && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => !paymentPlanSaving && setPaymentPlanModal(false)}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 24,
                  maxWidth: 400,
                  width: "90%",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>Set up payment plan</h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Number of payments</label>
                  <select
                    value={paymentPlanNumPayments}
                    onChange={(e) => setPaymentPlanNumPayments(Number(e.target.value))}
                    style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                  >
                    {[2, 3, 4, 6].map((n) => (
                      <option key={n} value={n}>{n} payments</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>First payment due date</label>
                  <input
                    type="date"
                    value={paymentPlanFirstDue}
                    onChange={(e) => setPaymentPlanFirstDue(e.target.value)}
                    style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setPaymentPlanModal(false)}
                    disabled={paymentPlanSaving}
                    style={{
                      padding: "10px 20px",
                      background: "#f5f5f5",
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      cursor: paymentPlanSaving ? "not-allowed" : "pointer",
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setPaymentPlanSaving(true);
                      try {
                        const res = await fetch("/api/client/guide-fee-bill", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            contract_id: currentContract.id,
                            action: "payment_plan",
                            number_of_payments: paymentPlanNumPayments,
                            first_due_date: paymentPlanFirstDue || undefined,
                          }),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          alert(json.error || "Failed to set up payment plan");
                          return;
                        }
                        setPaymentPlanModal(false);
                        setGuideFeeBill(null);
                        const refetch = await fetch(`/api/client/guide-fee-bill?contract_id=${encodeURIComponent(currentContract.id)}`);
                        const bill = await refetch.json();
                        if (bill && !bill.error) setGuideFeeBill(bill);
                      } catch (e) {
                        alert("Failed to set up payment plan");
                      } finally {
                        setPaymentPlanSaving(false);
                      }
                    }}
                    disabled={paymentPlanSaving || !paymentPlanFirstDue}
                    style={{
                      padding: "10px 20px",
                      background: paymentPlanSaving ? "#999" : "var(--client-accent, #1a472a)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: paymentPlanSaving ? "not-allowed" : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {paymentPlanSaving ? "Setting up…" : "Set up plan"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showFullContractModal && currentContract && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 24,
              }}
              onClick={() => setShowFullContractModal(false)}
            >
              <div
                id="contract-print-view"
                style={{
                  background: "white",
                  borderRadius: 12,
                  maxWidth: 800,
                  width: "100%",
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Hunt Contract</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "var(--client-accent, #1a472a)",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: 14,
                      }}
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFullContractModal(false)}
                      style={{
                        padding: "8px 16px",
                        background: "#f5f5f5",
                        border: "1px solid #ccc",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: 14,
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    padding: 32,
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {/* Professional Contract Header */}
                  <div style={{ textAlign: "center", marginBottom: 32, paddingBottom: 16, borderBottom: "2px solid #000" }}>
                    <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px 0", letterSpacing: "1px" }}>
                      HUNT CONTRACT
                    </h1>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#666", margin: 0 }}>
                      Agreement for Guided Hunting Services
                    </p>
                  </div>

                  {/* Contract Information Section */}
                  <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                      CONTRACT INFORMATION
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "12px 16px", fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: "#666" }}>Contract ID:</div>
                      <div>{currentContract.id.slice(0, 8).toUpperCase()}</div>
                      <div style={{ fontWeight: 600, color: "#666" }}>Date Created:</div>
                      <div>{currentContract.client_completed_at ? new Date(currentContract.client_completed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Not set"}</div>
                      <div style={{ fontWeight: 600, color: "#666" }}>Status:</div>
                      <div>{currentContract.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</div>
                    </div>
                  </div>

                  {/* Client Information Section */}
                  <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                      CLIENT INFORMATION
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "12px 16px", fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: "#666" }}>Name:</div>
                      <div>Client Name</div>
                      <div style={{ fontWeight: 600, color: "#666" }}>Email:</div>
                      <div>client@example.com</div>
                    </div>
                  </div>

                  {/* Hunt Details Section */}
                  {currentContract.hunt && (
                    <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                        HUNT DETAILS
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "12px 16px", fontSize: 11 }}>
                        {currentContract.hunt.species && (
                          <>
                            <div style={{ fontWeight: 600, color: "#666" }}>Species:</div>
                            <div>{currentContract.hunt.species}</div>
                          </>
                        )}
                        {currentContract.hunt.unit && (
                          <>
                            <div style={{ fontWeight: 600, color: "#666" }}>Unit:</div>
                            <div>{currentContract.hunt.unit}</div>
                          </>
                        )}
                        {currentContract.hunt_code && (
                          <>
                            <div style={{ fontWeight: 600, color: "#666" }}>Hunt Code:</div>
                            <div>{currentContract.hunt_code}</div>
                          </>
                        )}
                        {currentContract.hunt.start_date && currentContract.hunt.end_date && (
                          <>
                            <div style={{ fontWeight: 600, color: "#666" }}>Dates:</div>
                            <div>{formatDate(currentContract.hunt.start_date)} – {formatDate(currentContract.hunt.end_date)}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Terms & Conditions Section */}
                  <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                      TERMS & CONDITIONS
                    </h3>
                    <div
                      style={{
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: "#333",
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                      }}
                    >
                      {currentContract.content ? (
                        currentContract.content
                      ) : (
                        <p style={{ color: "#666" }}>Contract text is not available.</p>
                      )}
                    </div>
                  </div>

                  {/* Payment Information (if available) */}
                  {guideFeeBill && (
                    <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                        PAYMENT INFORMATION
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "12px 16px", fontSize: 11 }}>
                        <div style={{ fontWeight: 600, color: "#666" }}>Description:</div>
                        <div>{guideFeeBill.description}</div>
                        {guideFeeBill.total_cents && (
                          <>
                            <div style={{ fontWeight: 600, color: "#666" }}>Total Amount:</div>
                            <div>${(guideFeeBill.total_cents / 100).toLocaleString()}</div>
                          </>
                        )}
                        {guideFeeBill.balance_due_cents && (
                          <>
                            <div style={{ fontWeight: 600, color: "#666" }}>Balance Due:</div>
                            <div>${(guideFeeBill.balance_due_cents / 100).toLocaleString()}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #ddd", textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: "#999", margin: "8px 0" }}>
                      This contract is a legally binding agreement between the client and outfitter.
                    </p>
                    <p style={{ fontSize: 9, color: "#999", margin: 0 }}>
                      Generated on {new Date().toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Print Styles */}
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #contract-print-view,
              #contract-print-view * {
                visibility: visible;
              }
              #contract-print-view {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                max-width: 100%;
                max-height: 100%;
                box-shadow: none;
                border: none;
                padding: 0;
                margin: 0;
              }
              #contract-print-view > div:first-child {
                display: none;
              }
            }
          `}</style>

          <Link
            href="/client/documents"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "var(--client-accent, #1a472a)",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Back to Documents
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 32,
          }}
        >
          {/* Hunt Details – auto-filled from tag/contract (species, unit, weapon, dates, hunt code) */}
          {currentContract?.hunt && (
            <div
              style={{
                background: "#f9f9f9",
                borderRadius: 8,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Hunt Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#999" }}>Hunt</div>
                  <div style={{ fontWeight: 500 }}>{currentContract.hunt.title}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#999" }}>Species</div>
                  <div style={{ fontWeight: 500 }}>{currentContract.hunt.species ?? "Not specified"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#999" }}>Unit</div>
                  <div style={{ fontWeight: 500 }}>{currentContract.hunt.unit ?? "Not specified"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#999" }}>Weapon</div>
                  <div style={{ fontWeight: 500 }}>
                    {currentContract.hunt.weapon === "Bow" ? "Archery" : (currentContract.hunt.weapon ?? "Not specified")}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#999" }}>Dates</div>
                  <div style={{ fontWeight: 500 }}>
                    {currentContract.hunt.start_date && currentContract.hunt.end_date ? (
                      `${formatDate(currentContract.hunt.start_date)} – ${formatDate(currentContract.hunt.end_date)}`
                    ) : (
                      <span style={{ color: "#d32f2f" }}>Dates will be set when you complete your booking</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#999" }}>Hunt Code</div>
                  <div style={{ fontWeight: 500 }}>{currentContract.hunt.hunt_code ?? currentContract.hunt_code ?? "Not specified"}</div>
                </div>
                {(currentContract.hunt.camp_name ?? "").trim() && (
                  <div>
                    <div style={{ fontSize: 12, color: "#999" }}>Camp</div>
                    <div style={{ fontWeight: 500 }}>{currentContract.hunt.camp_name}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Professional Contract Display */}
          <div
            id="contract-main-view"
            style={{
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 32,
              marginBottom: 24,
            }}
          >
            {/* Professional Header */}
            <div style={{ textAlign: "center", marginBottom: 32, paddingBottom: 16, borderBottom: "2px solid #000" }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px 0", letterSpacing: "1px" }}>
                HUNT CONTRACT
              </h1>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#666", margin: 0 }}>
                Agreement for Guided Hunting Services
              </p>
            </div>

            {/* Contract Information Section */}
            <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                CONTRACT INFORMATION
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "12px 16px", fontSize: 11 }}>
                <div style={{ fontWeight: 600, color: "#666" }}>Contract ID:</div>
                <div>{currentContract?.id.slice(0, 8).toUpperCase()}</div>
                <div style={{ fontWeight: 600, color: "#666" }}>Date Created:</div>
                <div>{currentContract?.client_completed_at ? new Date(currentContract.client_completed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Not set"}</div>
                <div style={{ fontWeight: 600, color: "#666" }}>Status:</div>
                <div>{currentContract?.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</div>
              </div>
            </div>

            {/* Hunt Details Section */}
            {currentContract?.hunt && (
              <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                  HUNT DETAILS
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "12px 16px", fontSize: 11 }}>
                  {currentContract.hunt.species && (
                    <>
                      <div style={{ fontWeight: 600, color: "#666" }}>Species:</div>
                      <div>{currentContract.hunt.species}</div>
                    </>
                  )}
                  {currentContract.hunt.unit && (
                    <>
                      <div style={{ fontWeight: 600, color: "#666" }}>Unit:</div>
                      <div>{currentContract.hunt.unit}</div>
                    </>
                  )}
                  {currentContract.hunt_code && (
                    <>
                      <div style={{ fontWeight: 600, color: "#666" }}>Hunt Code:</div>
                      <div>{currentContract.hunt_code}</div>
                    </>
                  )}
                  {currentContract.hunt.start_date && currentContract.hunt.end_date && (
                    <>
                      <div style={{ fontWeight: 600, color: "#666" }}>Dates:</div>
                      <div>{formatDate(currentContract.hunt.start_date)} – {formatDate(currentContract.hunt.end_date)}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Terms & Conditions Section */}
            <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px 0" }}>
                TERMS & CONDITIONS
              </h3>
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "#333",
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  maxHeight: 400,
                  overflowY: "auto",
                }}
              >
                {currentContract?.content ? (
                  currentContract.content
                ) : (
                  <p style={{ color: "#666" }}>Contract text is not available.</p>
                )}
              </div>
            </div>

            {/* Print Button */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button
                type="button"
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    const contractHTML = document.getElementById("contract-main-view")?.innerHTML || "";
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>Hunt Contract</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                            @media print { body { padding: 0; } }
                          </style>
                        </head>
                        <body>
                          ${contractHTML}
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                      printWindow.print();
                    }, 250);
                  }
                }}
                style={{
                  padding: "12px 24px",
                  background: "var(--client-accent, #1a472a)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Print Contract
              </button>
            </div>
          </div>

          {/* Submitted – awaiting admin review */}
          {pendingReview && (
            <div
              style={{
                padding: 16,
                background: "#e8f5e9",
                border: "1px solid #4caf50",
                borderRadius: 8,
                marginBottom: 24,
                fontSize: 14,
                color: "#2e7d32",
              }}
            >
              <strong>Submitted for review.</strong> Your contract is with your outfitter. Once they approve it, they will send it for your DocuSign signature—check back here or watch for an email.
            </div>
          )}

          {/* Inline Booking Form (when contract needs booking) */}
          {needsBooking && (
            <div
              style={{
                background: "#f9f9f9",
                border: "2px solid var(--client-accent, #1a472a)",
                borderRadius: 8,
                padding: 24,
                marginBottom: 24,
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: 16, color: "var(--client-accent, #1a472a)", fontSize: 20 }}>
                Complete Your Booking
              </h3>
              <p style={{ marginBottom: 20, color: "#666", fontSize: 14 }}>
                Select your guide fee, add-ons, and hunt dates to complete your booking.
              </p>

              {bookingLoading && (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <p>Loading booking options...</p>
                </div>
              )}

              {bookingError && (
                <div style={{ background: "#ffebee", border: "1px solid #d32f2f", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <p style={{ margin: 0, color: "#c62828", fontSize: 14 }}>⚠️ {bookingError}</p>
                </div>
              )}

              {!bookingLoading && bookingHunt && (
                <div>
                  {/* Step 1: Guide Fee Selection */}
                  {bookingStep === 1 && (
                    <div>
                      <h4 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Step 1: Choose your guide fee (Required)</h4>
                      <p style={{ color: "#666", marginBottom: 16, fontSize: 14 }}>
                        Select a guide fee option that matches your hunt's species and weapon.
                      </p>
                      {(() => {
                        const guideFeePlans = bookingPlans.filter((p) => (p.category || "").trim().toLowerCase() !== "add-ons");
                        const selectedPlan = guideFeePlans.find((p) => p.id === selectedPlanId);
                        return (
                          <>
                            {selectedPlan && selectedPlan.included_days != null && (
                              <div style={{ background: "#e3f2fd", border: "1px solid #2196f3", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1565c0" }}>
                                  ✓ Selected: {selectedPlan.title} — {selectedPlan.included_days}-day hunt
                                </p>
                              </div>
                            )}
                            {guideFeePlans.length === 0 ? (
                              <p style={{ color: "#666", marginBottom: 16 }}>No guide fee options match this hunt yet.</p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                                {guideFeePlans.map((plan: any) => (
                                  <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    style={{
                                      padding: 16,
                                      textAlign: "left",
                                      border: selectedPlanId === plan.id ? "2px solid var(--client-accent, #1a472a)" : "1px solid #ddd",
                                      borderRadius: 8,
                                      background: selectedPlanId === plan.id ? "#f0f7f4" : "#fff",
                                      cursor: "pointer",
                                      fontSize: 15,
                                      width: "100%",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                                      <span style={{ fontWeight: 600, fontSize: 16 }}>{plan.title}</span>
                                      <span style={{ color: "var(--client-accent, #1a472a)", fontWeight: 700, fontSize: 18 }}>
                                        ${Number(plan.amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    {plan.included_days != null && (
                                      <div style={{ fontSize: 13, color: "#555" }}>
                                        <strong>Days:</strong> {plan.included_days}-day hunt
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setBookingStep(2)}
                              disabled={!selectedPlanId}
                              style={{
                                padding: "12px 24px",
                                background: !selectedPlanId ? "#ccc" : "var(--client-accent, #1a472a)",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                cursor: !selectedPlanId ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {!selectedPlanId ? "Please select a guide fee" : "Next: Add-ons"}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Step 2: Add-ons */}
                  {bookingStep === 2 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setBookingStep(1)}
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
                      <h4 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Step 2: Add-ons (optional)</h4>
                      <p style={{ color: "#666", marginBottom: 16, fontSize: 14 }}>
                        Add extra days, non-hunters, or spotters to your hunt.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Extra Days</div>
                              <div style={{ fontSize: 13, color: "#666" }}>Extend your hunt beyond base days</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setExtraDays((p) => Math.max(0, p - 1))}
                                style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 18 }}
                              >
                                −
                              </button>
                              <span style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{extraDays}</span>
                              <button
                                type="button"
                                onClick={() => setExtraDays((p) => p + 1)}
                                style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 18 }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Non-Hunters</div>
                              <div style={{ fontSize: 13, color: "#666" }}>Per person</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setExtraNonHunters((p) => Math.max(0, p - 1))}
                                style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 18 }}
                              >
                                −
                              </button>
                              <span style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{extraNonHunters}</span>
                              <button
                                type="button"
                                onClick={() => setExtraNonHunters((p) => p + 1)}
                                style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 18 }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Spotters</div>
                              <div style={{ fontSize: 13, color: "#666" }}>Per person</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setExtraSpotters((p) => Math.max(0, p - 1))}
                                style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 18 }}
                              >
                                −
                              </button>
                              <span style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{extraSpotters}</span>
                              <button
                                type="button"
                                onClick={() => setExtraSpotters((p) => p + 1)}
                                style={{ width: 36, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 18 }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBookingStep(3)}
                        style={{
                          padding: "12px 24px",
                          background: "var(--client-accent, #1a472a)",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Next: Pick your dates
                      </button>
                    </div>
                  )}

                  {/* Step 3: Dates */}
                  {bookingStep === 3 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setBookingStep(2)}
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
                      <h4 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Step 3: Pick your hunt dates</h4>
                      {(() => {
                        const guideFeePlans = bookingPlans.filter((p) => (p.category || "").trim().toLowerCase() !== "add-ons");
                        const selectedPlan = guideFeePlans.find((p) => p.id === selectedPlanId);
                        const baseDays = selectedPlan?.included_days ?? null;
                        const requiredDays = baseDays != null ? baseDays + extraDays : null;
                        const windowStart = bookingHunt?.window_start ?? null;
                        const windowEnd = bookingHunt?.window_end ?? null;
                        const dateSpanDays = startDate && endDate
                          ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1
                          : 0;
                        const formOk = startDate && endDate && dateSpanDays >= 1 && requiredDays != null && dateSpanDays === requiredDays;

                        async function handleBookingSubmit() {
                          if (!currentContract?.hunt_id || !startDate || !endDate) return;
                          setBookingSubmitting(true);
                          setBookingError(null);
                          try {
                            const res = await fetch("/api/client/complete-booking", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                hunt_id: currentContract.hunt_id,
                                pricing_item_id: selectedPlanId || undefined,
                                client_start_date: startDate,
                                client_end_date: endDate,
                                extra_days: extraDays > 0 ? extraDays : undefined,
                                extra_non_hunters: extraNonHunters > 0 ? extraNonHunters : undefined,
                                extra_spotters: extraSpotters > 0 ? extraSpotters : undefined,
                                rifle_rental: rifleRental > 0 ? rifleRental : undefined,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Failed to save");
                            // Reload contract data instead of redirecting
                            await loadContract();
                            alert(data.message || "Booking saved! Your contract has been updated.");
                          } catch (e: any) {
                            setBookingError(e.message || "Failed to save");
                          } finally {
                            setBookingSubmitting(false);
                          }
                        }

                        return (
                          <>
                            {requiredDays != null && (
                              <div style={{ background: "#e3f2fd", border: "1px solid #2196f3", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1565c0" }}>
                                  You need to select exactly {requiredDays} day{requiredDays !== 1 ? "s" : ""}
                                </p>
                                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#555" }}>
                                  {baseDays} day{baseDays !== 1 ? "s" : ""} from your guide fee plan{extraDays > 0 ? ` + ${extraDays} extra day${extraDays !== 1 ? "s" : ""}` : ""}
                                </p>
                              </div>
                            )}
                            {windowStart && windowEnd && (
                              <div style={{ background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#333" }}>
                                  Hunt Season Window: {windowStart} – {windowEnd}
                                </p>
                              </div>
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
                            {dateSpanDays > 0 && requiredDays != null && dateSpanDays !== requiredDays && (
                              <div style={{ background: "#ffebee", border: "1px solid #d32f2f", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#c62828" }}>
                                  ⚠️ Date mismatch: You selected {dateSpanDays} day{dateSpanDays !== 1 ? "s" : ""}, but you need {requiredDays} day{requiredDays !== 1 ? "s" : ""}.
                                </p>
                              </div>
                            )}
                            {bookingError && (
                              <div style={{ background: "#ffebee", border: "1px solid #d32f2f", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                <p style={{ margin: 0, fontSize: 13, color: "#c62828" }}>⚠️ {bookingError}</p>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={handleBookingSubmit}
                              disabled={!formOk || bookingSubmitting}
                              style={{
                                padding: "12px 24px",
                                background: !formOk || bookingSubmitting ? "#ccc" : "var(--client-accent, #1a472a)",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                cursor: !formOk || bookingSubmitting ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {bookingSubmitting ? "Saving…" : "Save and continue"}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Client Completion Form (if needed - only for contracts that have pricing/dates but need acknowledgment) */}
          {needsCompletion && !needsBooking && (
            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: 8,
                padding: 24,
                marginBottom: 24,
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Complete Your Contract</h3>
              <p style={{ marginBottom: 16, color: "#666" }}>
                Please review the contract above. Your hunt details (species, dates, hunt code) are shown at the top. Confirm below to submit for your outfitter&apos;s review.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={completionData.acknowledgment}
                    onChange={(e) =>
                      setCompletionData({ ...completionData, acknowledgment: e.target.checked })
                    }
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontWeight: completionData.acknowledgment ? 600 : 400 }}>
                    I have read and understand the terms and conditions of this contract.
                  </span>
                </label>
                {!completionData.acknowledgment && (
                  <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#d32f2f" }}>
                    ⚠️ You must check this box to submit the contract.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                  Additional Information (Optional)
                </label>
                <textarea
                  value={completionData.additionalInfo}
                  onChange={(e) =>
                    setCompletionData({ ...completionData, additionalInfo: e.target.value })
                  }
                  placeholder="Any additional information or special requests..."
                  style={{
                    width: "100%",
                    minHeight: 100,
                    padding: 12,
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    fontSize: 14,
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Note: Pricing and add-ons are selected in complete-booking, not here */}
              {currentContract?.contract_total_cents && currentContract.contract_total_cents > 0 && (
                <div
                  style={{
                    marginBottom: 24,
                    padding: 16,
                    background: "#f0f7f4",
                    border: "1px solid #c8e6c9",
                    borderRadius: 8,
                  }}
                >
                  <h4 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: "var(--client-accent, #1a472a)" }}>
                    Contract Total
                  </h4>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--client-accent, #1a472a)" }}>
                    ${((currentContract.contract_total_cents as number) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#666" }}>
                    This total includes your guide fee and any add-ons you selected during booking.
                  </p>
                </div>
              )}

              {(() => {
                const hunt = currentContract?.hunt;
                const toYMD = (s: string | undefined) => (s && s.length >= 10 ? s.slice(0, 10) : "");
                const hasHuntDates = Boolean(toYMD(hunt?.start_date) && toYMD(hunt?.end_date));
                const canSubmit = completionData.acknowledgment;
                console.log("Contract submit button state:", {
                  canSubmit,
                  acknowledgment: completionData.acknowledgment,
                  contractStatus: currentContract?.status,
                  needsCompletion,
                });
                  completionData.acknowledgment &&
                  hasHuntDates &&
                  !completingLoading;
                return (
              <button
                onClick={handleCompleteContract}
                disabled={!canSubmit}
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  background: canSubmit ? "var(--client-accent, #1a472a)" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {completingLoading ? "Submitting..." : "Submit Contract"}
              </button>
                );
              })()}
            </div>
          )}

          {/* Approved but not yet sent to DocuSign */}
          {approvedWaitingDocuSign && (
            <div
              style={{
                padding: 16,
                background: "#e3f2fd",
                border: "1px solid #2196f3",
                borderRadius: 8,
                marginBottom: 24,
                fontSize: 14,
                color: "#1565c0",
              }}
            >
              <strong>Contract approved.</strong> Your outfitter will send it for your signature. When they do, click <strong>Refresh</strong> above or return to this page—the Sign button will appear so you can sign here.
            </div>
          )}

          {/* Sign (unified in-app flow) */}
          {readyForSignature && (
            <InAppSigningFlow
              documentTitle="Hunt Contract"
              documentContent={currentContract?.content ?? undefined}
              clientEmail={data?.client_email ?? ""}
              onSign={handleSignInApp}
              backHref="/client/documents"
              backLabel="← Back to Documents"
            />
          )}

          {/* Status message if contract is in draft */}
          {currentContract?.status === "draft" && (
            <div
              style={{
                background: "#e3f2fd",
                border: "1px solid #2196f3",
                borderRadius: 8,
                padding: 16,
                textAlign: "center",
                color: "#1976d2",
              }}
            >
              This contract is still being prepared. Please check back later.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not set";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Try parsing as YYYY-MM-DD
      const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (parts) {
        const [_, year, month, day] = parts;
        return `${month}/${day}/${year}`;
      }
      return "Invalid date";
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Invalid date";
  }
}
