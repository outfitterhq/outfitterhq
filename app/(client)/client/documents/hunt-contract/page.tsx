"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
}

export default function HuntContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractIdFromUrl = searchParams.get("contract");
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingLoading, setSigningLoading] = useState(false);
  const [completingLoading, setCompletingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [docusignNotConfigured, setDocusignNotConfigured] = useState(false);
  const [selectedContractIndex, setSelectedContractIndex] = useState(0);
  const [fetchedHuntWindow, setFetchedHuntWindow] = useState<{ start: string; end: string } | null>(null);
  const [huntWindowLoading, setHuntWindowLoading] = useState(false);
  const [huntWindowError, setHuntWindowError] = useState(false);
  const [redirectingToBooking, setRedirectingToBooking] = useState(false);

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

  // Load guide fee bill when contract is fully signed (so client can pay or set up payment plan)
  useEffect(() => {
    if (!isComplete || !currentContract?.id) {
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

  // Redirect to complete-booking ONLY when contract is loaded and needs booking
  // This happens after data loads, so user sees the contract page briefly, then redirects
  useEffect(() => {
    if (loading || !data) return;
    
    // Check if current contract needs complete booking
    const contract = data?.contracts?.[selectedContractIndex];
    console.log("[hunt-contract] Checking redirect:", {
      contract: contract?.id,
      needs_complete_booking: contract?.needs_complete_booking,
      hunt_id: contract?.hunt_id,
      hasDates: contract?.hunt?.start_date || contract?.hunt?.start_time,
      hasPrice: contract?.base_guide_fee_usd || contract?.hunt?.selected_pricing_item_id,
    });
    
    if (contract?.needs_complete_booking && contract?.hunt_id) {
      // Redirect to booking (like purchase tags flow)
      console.log("[hunt-contract] Redirecting to complete-booking for hunt:", contract.hunt_id);
      setRedirectingToBooking(true);
      const returnUrl = `/client/documents/hunt-contract${contractIdFromUrl ? `?contract=${contractIdFromUrl}` : ""}`;
      window.location.replace(`/client/complete-booking?hunt_id=${encodeURIComponent(contract.hunt_id)}&return_to=${encodeURIComponent(returnUrl)}`);
      return;
    }
    
    // If no contracts but there's a hunt that needs booking, redirect to that
    if (!data.contracts || data.contracts.length === 0) {
      if (data.hunts_without_contracts?.length) {
        const firstHunt = data.hunts_without_contracts[0];
        if (firstHunt?.needs_complete_booking) {
          console.log("[hunt-contract] Redirecting to complete-booking for hunt without contract:", firstHunt.id);
          setRedirectingToBooking(true);
          window.location.replace(`/client/complete-booking?hunt_id=${encodeURIComponent(String(firstHunt.id))}&return_to=${encodeURIComponent("/client/documents/hunt-contract")}`);
          return;
        }
      }
    }
  }, [loading, data, selectedContractIndex, contractIdFromUrl]);

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
    try {
      const res = await fetch(`/api/client/hunt-contract?fix_bill=1&_=${Date.now()}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.error || "Failed to load contract";
        setError(res.status === 401 ? "Please sign in again. Your session may have expired." : msg);
        setData({ eligible: false, contracts: [], hunts_without_contracts: json.hunts_without_contracts ?? [] });
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
            hasPrice: !!(contract.base_guide_fee_usd || hunt?.selected_pricing_item_id),
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
        
        // Check if we need to redirect BEFORE setting state
        const selectedIdx = contractIdFromUrl
          ? contracts.findIndex((c) => c.id === contractIdFromUrl)
          : 0;
        const contractToCheck = contracts[selectedIdx >= 0 ? selectedIdx : 0];
        
        if (contractToCheck?.needs_complete_booking && contractToCheck?.hunt_id) {
          console.log("[hunt-contract] Contract needs booking - redirecting immediately");
          setLoading(false);
          setRedirectingToBooking(true);
          const returnUrl = `/client/documents/hunt-contract${contractIdFromUrl ? `?contract=${contractIdFromUrl}` : ""}`;
          window.location.replace(`/client/complete-booking?hunt_id=${encodeURIComponent(contractToCheck.hunt_id)}&return_to=${encodeURIComponent(returnUrl)}`);
          return;
        }
        
        setData({
          eligible: true,
          contracts,
          hunts_without_contracts: json.hunts_without_contracts ?? [],
        });
        setSelectedContractIndex(selectedIdx >= 0 ? selectedIdx : 0);
      } else {
        setData({
          eligible: json.eligible ?? true,
          contracts: [],
          reason: json.reason || "No contract available yet.",
          hunts_without_contracts: json.hunts_without_contracts ?? [],
        });
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      setData((prev) => prev ?? { eligible: false, contracts: [], hunts_without_contracts: [] });
    } finally {
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

  async function handleStartSigning() {
    if (!currentContract?.id) return;
    setSigningLoading(true);
    setError(null);
    setDocusignNotConfigured(false);

    try {
      const res = await fetch("/api/client/hunt-contract/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_id: currentContract.id }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 503 && (json.needsConfiguration || /not configured|not set up/i.test(json.error || ""))) {
        setDocusignNotConfigured(true);
        setError(json.error || "DocuSign isn't set up yet. Your outfitter can enable it in Settings.");
        return;
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to start signing");
      }

      if (json.signingUrl) {
        window.open(json.signingUrl, "_blank");
      } else if (json.message) {
        setSuccessMessage(json.message);
        await loadContract();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start signing");
    } finally {
      setSigningLoading(false);
    }
  }

  // Show loading/redirecting state immediately if redirecting
  if (redirectingToBooking) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Redirecting to complete your booking…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading contract...</p>
      </div>
    );
  }

  const needsCompletion = currentContract?.status === "pending_client_completion";
  const pendingReview = currentContract?.status === "pending_admin_review";
  const approvedWaitingDocuSign = currentContract?.status === "ready_for_signature";
  const readyForSignature = currentContract?.status === "sent_to_docusign";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/documents"
          style={{ color: "#1a472a", textDecoration: "none", fontSize: 14 }}
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
            border: "1px solid #1a472a",
            borderRadius: 8,
            background: "white",
            color: "#1a472a",
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
                color: "#1a472a",
                border: "2px solid #1a472a",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              View full contract
            </button>
          </div>

          {/* Guide fee bill: pay in full or set up payment plan (only when contract is fully signed) */}
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
                            style={{ marginLeft: 12, color: "#1a472a", fontWeight: 600 }}
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
                        background: "#1a472a",
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
                        color: "#1a472a",
                        border: "2px solid #1a472a",
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
                      background: paymentPlanSaving ? "#999" : "#1a472a",
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
                style={{
                  background: "white",
                  borderRadius: 12,
                  maxWidth: 720,
                  width: "100%",
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Full contract</h2>
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
                <div
                  style={{
                    padding: 24,
                    overflowY: "auto",
                    flex: 1,
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "#333",
                  }}
                >
                  {currentContract.content ? (
                    currentContract.content
                  ) : (
                    <p style={{ color: "#666" }}>Contract text is not available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Link
            href="/client/documents"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#1a472a",
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

          {/* Contract Content */}
          <div
            style={{
              background: "#f9f9f9",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 24,
              marginBottom: 24,
              maxHeight: 500,
              overflowY: "auto",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: 16 }}>
              HUNT CONTRACT TERMS & CONDITIONS
            </h3>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.8,
                color: "#333",
                whiteSpace: "pre-wrap",
              }}
            >
              {currentContract?.content ? (
                <div style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14 }}>
                  {currentContract.content}
                </div>
              ) : (
                <div>
                  <p>
                    This Hunt Contract ("Agreement") is entered into between the Outfitter
                    ("Outfitter") and the undersigned Client ("Hunter").
                  </p>
                  <p style={{ marginTop: 16 }}>
                    <strong>SERVICES:</strong> Outfitter agrees to provide guided hunting services
                    as described in this contract, including lodging, meals, transportation during
                    the hunt, and professional guide services.
                  </p>
                  <p style={{ marginTop: 16 }}>
                    <strong>PAYMENT TERMS:</strong> Payment schedule as agreed. Full payment is
                    due before hunt start date. See My Payments for details.
                  </p>
                  <p style={{ marginTop: 16 }}>
                    <strong>CANCELLATION POLICY:</strong> Deposits are non-refundable. Rescheduling
                    may be available depending on circumstances and availability.
                  </p>
                  <p style={{ marginTop: 16, fontStyle: "italic", color: "#666" }}>
                    [Contract content will be displayed here once available]
                  </p>
                </div>
              )}
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

          {/* Client Completion Form (if needed) */}
          {needsCompletion && (
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

              {!currentContract?.hunt?.start_date || !currentContract?.hunt?.end_date ? (
                <div style={{ 
                  background: "#fff3cd", 
                  border: "1px solid #ffc107", 
                  borderRadius: 8, 
                  padding: 12, 
                  marginBottom: 16 
                }}>
                  <p style={{ margin: 0, color: "#856404", fontSize: 14 }}>
                    ⚠️ <strong>Missing hunt dates.</strong> Your hunt needs start and end dates. If dates are not shown at the top, contact your outfitter or complete your booking first.
                  </p>
                </div>
              ) : null}

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

              {/* Add-ons: extra days and non-hunters — always show; add to total */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
                  Add-ons (extra days, non-hunters, spotter) are added to your guide fee and included in the contract total.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Extra days (extend hunt)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={completionData.extra_days}
                      onChange={(e) =>
                        setCompletionData({
                          ...completionData,
                          extra_days: Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      style={{ width: 80, padding: 8, border: "1px solid #ddd", borderRadius: 4, fontSize: 14 }}
                    />
                    <span style={{ marginLeft: 8, fontSize: 14, color: "#666" }}>
                      ${(currentContract?.addon_pricing?.extra_day_usd ?? 100).toLocaleString()}/day
                    </span>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Non-hunters
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={completionData.extra_non_hunters}
                      onChange={(e) =>
                        setCompletionData({
                          ...completionData,
                          extra_non_hunters: Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      style={{ width: 80, padding: 8, border: "1px solid #ddd", borderRadius: 4, fontSize: 14 }}
                    />
                    <span style={{ marginLeft: 8, fontSize: 14, color: "#666" }}>
                      ${(currentContract?.addon_pricing?.non_hunter_usd ?? 75).toLocaleString()}/person
                    </span>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Spotter(s)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={completionData.extra_spotters}
                      onChange={(e) =>
                        setCompletionData({
                          ...completionData,
                          extra_spotters: Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      style={{ width: 80, padding: 8, border: "1px solid #ddd", borderRadius: 4, fontSize: 14 }}
                    />
                    <span style={{ marginLeft: 8, fontSize: 14, color: "#666" }}>
                      ${(currentContract?.addon_pricing?.spotter_usd ?? 50).toLocaleString()}/person
                    </span>
                  </div>
                </div>
              </div>

              {/* Price summary: guide fee + add-ons = total (what you are reviewing) */}
              {(() => {
                const baseUsd = currentContract?.base_guide_fee_usd ?? 0;
                const dayRate = currentContract?.addon_pricing?.extra_day_usd ?? 100;
                const nonHunterRate = currentContract?.addon_pricing?.non_hunter_usd ?? 75;
                const spotterRate = currentContract?.addon_pricing?.spotter_usd ?? 50;
                const extraDays = completionData.extra_days || 0;
                const nonHunters = completionData.extra_non_hunters || 0;
                const spotters = completionData.extra_spotters || 0;
                const addonsUsd = extraDays * dayRate + nonHunters * nonHunterRate + spotters * spotterRate;
                const totalUsd = baseUsd + addonsUsd;
                return (
                  <div
                    style={{
                      marginBottom: 24,
                      padding: 16,
                      background: "#f0f7f4",
                      border: "1px solid #c8e6c9",
                      borderRadius: 8,
                    }}
                  >
                    <h4 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: "#1a472a" }}>
                      Contract total (what you are reviewing)
                    </h4>
                    <div style={{ fontSize: 14, color: "#333", lineHeight: 1.8 }}>
                      <div>Guide fee: ${baseUsd.toLocaleString()}</div>
                      {extraDays > 0 && (
                        <div>Extra days ({extraDays} × ${dayRate.toLocaleString()}/day): ${(extraDays * dayRate).toLocaleString()}</div>
                      )}
                      {nonHunters > 0 && (
                        <div>Non-hunters ({nonHunters} × ${nonHunterRate.toLocaleString()}/person): ${(nonHunters * nonHunterRate).toLocaleString()}</div>
                      )}
                      {spotters > 0 && (
                        <div>Spotter(s) ({spotters} × ${spotterRate.toLocaleString()}/person): ${(spotters * spotterRate).toLocaleString()}</div>
                      )}
                      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 16 }}>
                        Total: ${totalUsd.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                  background: canSubmit ? "#1a472a" : "#ccc",
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
              <strong>Contract approved.</strong> Your outfitter will send it to DocuSign for your signature. When they do, click <strong>Refresh</strong> above or return to this page—the &quot;Sign via DocuSign&quot; button will appear so you can sign here.
            </div>
          )}

          {/* Sign Button (when contract has been sent to DocuSign) */}
          {readyForSignature && (
            <>
              <button
                onClick={handleStartSigning}
                disabled={signingLoading}
                style={{
                  width: "100%",
                  padding: "16px 28px",
                  background: signingLoading ? "#ccc" : "#1a472a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 18,
                  fontWeight: 600,
                  cursor: signingLoading ? "not-allowed" : "pointer",
                }}
              >
                {signingLoading ? "Preparing DocuSign…" : "Sign via DocuSign"}
              </button>

              <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#666" }}>
                You will be redirected to DocuSign to complete signing.
              </p>

              {docusignNotConfigured && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    background: "#fff3e0",
                    border: "1px solid #ffb74d",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "#e65100",
                  }}
                >
                  <strong>DocuSign isn&apos;t set up yet.</strong> Your outfitter can enable
                  electronic signing in Settings. Once enabled, you&apos;ll be able to sign
                  this contract via DocuSign here.
                </div>
              )}
            </>
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
