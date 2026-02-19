"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface HuntCodeDates {
  start_date: string;
  end_date: string;
  code: string;
}

interface HuntCodeChoice {
  code: string;
  start_date?: string;
  end_date?: string;
  weapon?: string;
}

interface PrivateTag {
  id: string;
  ranch_name?: string;
  tag_name?: string;
  species?: string;
  unit?: string;
  weapon?: string;
  season_dates?: string;
  status?: string;
  notes?: string;
  price?: number;
  is_available?: boolean;
  hunt_code?: string;
  /** Unit-wide: comma-separated hunt codes (client chooses one at purchase) */
  hunt_code_options?: string;
  tag_type?: "private_land" | "unit_wide";
  state?: string;
  created_at?: string;
}

export default function ClientPrivateTagsPage() {
  const searchParams = useSearchParams();
  const [myTags, setMyTags] = useState<PrivateTag[]>([]);
  const [availableTags, setAvailableTags] = useState<PrivateTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "my-tags">("available");
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [purchaseTagForDates, setPurchaseTagForDates] = useState<PrivateTag | null>(null);
  const [huntCodeDates, setHuntCodeDates] = useState<HuntCodeDates | null>(null);
  const [purchaseStartDate, setPurchaseStartDate] = useState("");
  const [purchaseEndDate, setPurchaseEndDate] = useState("");
  const [unitWideChoices, setUnitWideChoices] = useState<HuntCodeChoice[]>([]);
  const [selectedHuntCode, setSelectedHuntCode] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [apiDebugInfo, setApiDebugInfo] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [myTagsRes, availableRes] = await Promise.all([
        fetch("/api/client/private-tags", { credentials: "include" }),
        fetch("/api/client/available-tags", { credentials: "include" }),
      ]);

      const myTagsData = await myTagsRes.json().catch(() => ({}));
      if (myTagsRes.ok) {
        const tags = myTagsData.tags || [];
        setMyTags(tags);
        // Clear "My Tags" error if successful
        if (error && error.includes("My Tags")) {
          setError(null);
        }
        console.log("My Tags loaded:", { count: tags.length });
      } else {
        const msg = myTagsData.error || myTagsRes.statusText || "Failed to load My Tags";
        const fullError = myTagsData.detail ? `${msg}: ${myTagsData.detail}` : msg;
        // Set error for My Tags (will show in My Tags tab)
        setError(`My Tags: ${fullError}`);
        setMyTags([]);
        console.error("My Tags error:", {
          status: myTagsRes.status,
          statusText: myTagsRes.statusText,
          error: myTagsData,
        });
      }

      if (availableRes.ok) {
        const data = await availableRes.json();
        const tags = data.tags || [];
        setAvailableTags(tags);
        setApiResponse(data); // Store for debug display
        
        // Store debug info for display
        setApiDebugInfo({
          success: true,
          tagsCount: tags.length,
          tags: tags,
          debug: data.debug,
          outfitter_id: data.outfitter_id,
          fullResponse: data,
        });
        
        // Debug: Log response
        console.log("Available tags response:", {
          tagsCount: tags.length,
          tags: tags,
          debug: data.debug,
          outfitter_id: data.outfitter_id,
          fullResponse: data,
        });
        
        // Debug: Log if no tags found
        if (tags.length === 0) {
          console.warn("No available tags found", {
            debug: data.debug,
            outfitter_id: data.outfitter_id,
            response: data,
          });
          // Auto-show debug panel if no tags
          setShowDebugPanel(true);
        }
      } else {
        const errorData = await availableRes.json().catch(() => ({}));
        console.error("Failed to load available tags:", {
          status: availableRes.status,
          statusText: availableRes.statusText,
          error: errorData,
        });
        const errorMsg = errorData.error || "Failed to load available tags";
        // Set error for available tags (will show in Available Tags tab)
        setError(`Available Tags: ${errorMsg}`);
        
        // Store debug info for display
        setApiDebugInfo({
          success: false,
          error: errorMsg,
          details: errorData.details,
          status: availableRes.status,
          statusText: availableRes.statusText,
          fullError: errorData,
        });
        
        if (errorData.details) {
          console.error("Details:", errorData.details);
        }
        setAvailableTags([]);
        // Auto-show debug panel on error
        setShowDebugPanel(true);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchaseClick(tag: PrivateTag) {
    const isUnitWide = tag.tag_type === "unit_wide";
    const options = (tag.hunt_code_options || "").split(",").map((c) => c.trim()).filter(Boolean);

    if (isUnitWide && options.length > 0) {
      setPurchaseTagForDates(tag);
      setSelectedHuntCode(null);
      setHuntCodeDates(null);
      setPurchaseStartDate("");
      setPurchaseEndDate("");
      setUnitWideChoices([]);
      Promise.all(
        options.map((code) =>
          fetch(`/api/hunt-codes?code=${encodeURIComponent(code)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((row) => (row ? { code: row.code || code, start_date: row.start_date, end_date: row.end_date } : { code }))
        )
      ).then((results) => setUnitWideChoices(results));
      return;
    }

    if (!tag.hunt_code) {
      if (!confirm("Are you sure you want to purchase this tag?\n\n(This is a simulated purchase - no actual payment will be processed)")) return;
      return doPurchase(tag.id);
    }
    setPurchaseTagForDates(tag);
    setSelectedHuntCode(null);
    setHuntCodeDates(null);
    setPurchaseStartDate("");
    setPurchaseEndDate("");
    fetch(`/api/hunt-codes?code=${encodeURIComponent(tag.hunt_code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => {
        if (row?.start_date && row?.end_date) {
          setHuntCodeDates({ start_date: row.start_date, end_date: row.end_date, code: row.code });
          setPurchaseStartDate(row.start_date);
          setPurchaseEndDate(row.end_date);
        } else {
          setHuntCodeDates(null);
        }
      })
      .catch(() => setHuntCodeDates(null));
  }

  function closePurchaseModal() {
    setPurchaseTagForDates(null);
    setHuntCodeDates(null);
    setPurchaseStartDate("");
    setPurchaseEndDate("");
    setSelectedHuntCode(null);
    setUnitWideChoices([]);
  }

  function onUnitWideSelectCode(code: string) {
    setSelectedHuntCode(code);
    const choice = unitWideChoices.find((c) => c.code === code);
    if (choice?.start_date && choice?.end_date) {
      setHuntCodeDates({ start_date: choice.start_date, end_date: choice.end_date, code });
      setPurchaseStartDate(choice.start_date);
      setPurchaseEndDate(choice.end_date);
    } else {
      setHuntCodeDates(null);
      setPurchaseStartDate("");
      setPurchaseEndDate("");
      fetch(`/api/hunt-codes?code=${encodeURIComponent(code)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((row) => {
          if (row?.start_date && row?.end_date) {
            setHuntCodeDates({ start_date: row.start_date, end_date: row.end_date, code: row.code });
            setPurchaseStartDate(row.start_date);
            setPurchaseEndDate(row.end_date);
          } else setHuntCodeDates(null);
        })
        .catch(() => setHuntCodeDates(null));
    }
  }

  async function doPurchase(tagId: string, clientStart?: string, clientEnd?: string, selectedCode?: string) {
    setPurchasing(tagId);
    try {
      const body: { tag_id: string; client_start_date?: string; client_end_date?: string; selected_hunt_code?: string } = { tag_id: tagId };
      if (clientStart) body.client_start_date = clientStart;
      if (clientEnd) body.client_end_date = clientEnd;
      if (selectedCode) body.selected_hunt_code = selectedCode;
      const res = await fetch("/api/client/purchase-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Purchase failed");
      }

      closePurchaseModal();
      const huntId = data.purchase?.hunt?.id;
      if (huntId) {
        window.location.href = `/client/complete-booking?hunt_id=${encodeURIComponent(huntId)}&return_to=${encodeURIComponent("/client/documents/hunt-contract")}`;
      } else {
        alert(`Purchase successful!\n\n${data.message}`);
        await loadData();
        setActiveTab("my-tags");
      }
    } catch (e: any) {
      alert("Error: " + String(e.message || e));
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading tags...</p>
      </div>
    );
  }

  // Debug panel (only show in development or if explicitly enabled)
  const showDebug = process.env.NODE_ENV === "development" || searchParams.get("debug") === "1";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Tags for Sale</h1>
            <p style={{ color: "#666" }}>
              Browse available tags (Private Land or Unit Wide) or view your purchased tags.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            style={{
              padding: "8px 16px",
              background: showDebugPanel ? "var(--client-accent, #1a472a)" : "#f0f0f0",
              color: showDebugPanel ? "white" : "#333",
              border: "1px solid #ddd",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {showDebugPanel ? "Hide" : "Show"} Debug
          </button>
        </div>
      </div>
      
      {/* Debug Panel */}
      {showDebugPanel && apiDebugInfo && (
        <div style={{
          background: "#fff3cd",
          border: "2px solid #ffc107",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          maxHeight: 400,
          overflow: "auto",
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700 }}>🔍 Debug Information</h3>
          <pre style={{
            fontSize: 11,
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {JSON.stringify(apiDebugInfo, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div style={{ background: "#fee", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <p style={{ color: "#c00" }}>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #eee" }}>
        <button
          onClick={() => setActiveTab("available")}
          style={{
            padding: "12px 24px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "available" ? "2px solid var(--client-accent, #1a472a)" : "2px solid transparent",
            marginBottom: -2,
            fontWeight: activeTab === "available" ? 600 : 400,
            color: activeTab === "available" ? "var(--client-accent, #1a472a)" : "#666",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Available Tags ({availableTags.length})
        </button>
        <button
          onClick={() => setActiveTab("my-tags")}
          style={{
            padding: "12px 24px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "my-tags" ? "2px solid var(--client-accent, #1a472a)" : "2px solid transparent",
            marginBottom: -2,
            fontWeight: activeTab === "my-tags" ? 600 : 400,
            color: activeTab === "my-tags" ? "var(--client-accent, #1a472a)" : "#666",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          My Tags ({myTags.length})
        </button>
      </div>

      {/* Available Tags Tab */}
      {activeTab === "available" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <p>Loading tags...</p>
            </div>
          ) : availableTags.length === 0 ? (
            <div
              style={{
                background: "white",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 48,
                textAlign: "center",
                color: "#666",
              }}
            >
              <p style={{ fontSize: 18, marginBottom: 8 }}>No tags currently available.</p>
              <p style={{ fontSize: 14, marginBottom: 16 }}>Check back later for new private land tag availability.</p>
              {error && (
                <div style={{ background: "#fee", padding: 12, borderRadius: 6, marginTop: 16, textAlign: "left", maxWidth: 500, margin: "16px auto 0" }}>
                  <strong>Error:</strong> {error}
                </div>
              )}
              {(searchParams.get("debug") === "1" || process.env.NODE_ENV === "development") && apiResponse && (
                <div style={{ background: "#f9f9f9", padding: 16, borderRadius: 6, marginTop: 16, textAlign: "left", maxWidth: 600, margin: "16px auto 0" }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>Debug Info:</strong>
                  <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 300 }}>
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              )}
              <button
                type="button"
                onClick={loadData}
                style={{
                  marginTop: 16,
                  padding: "8px 16px",
                  background: "var(--client-accent, #1a472a)",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Refresh
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {availableTags.map((tag) => (
                <AvailableTagCard
                  key={tag.id}
                  tag={tag}
                  onPurchase={handlePurchaseClick}
                  purchasing={purchasing === tag.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Tags Tab */}
      {activeTab === "my-tags" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <p>Loading your tags...</p>
            </div>
          ) : myTags.length === 0 ? (
            <div
              style={{
                background: "white",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 48,
                textAlign: "center",
                color: "#666",
              }}
            >
              <p style={{ fontSize: 18, marginBottom: 8 }}>You haven't purchased any tags yet.</p>
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                Browse the "Available Tags" tab to find and purchase private land tags.
              </p>
              {error && error.includes("My Tags") && (
                <div style={{ background: "#fee", padding: 12, borderRadius: 6, marginBottom: 16, textAlign: "left", maxWidth: 500, margin: "0 auto 16px" }}>
                  <strong>Error:</strong> {error}
                </div>
              )}
              {!error && (
                <div style={{ marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/client/private-tags?debug=1", { credentials: "include" });
                        const data = await res.json();
                        setDiagnostic(data.debug || { note: "No debug info", status: res.status, error: data.error });
                      } catch (e) {
                        setDiagnostic({ error: String(e) });
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
                    Why is My Tags empty? Run diagnostic
                  </button>
                  {diagnostic && (
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
                      {JSON.stringify(diagnostic, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {myTags.map((tag) => (
                <MyTagCard key={tag.id} tag={tag} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Purchase modal: unit-wide = choose hunt code then dates; private land = dates only */}
      {purchaseTagForDates && (
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
          onClick={closePurchaseModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {purchaseTagForDates.tag_type === "unit_wide" && unitWideChoices.length > 0 && !selectedHuntCode ? (
              <>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>Choose your hunt code</h3>
                <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
                  This unit-wide tag has 3 hunt code options. Choose the one you want; it will be added to your contract.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {unitWideChoices.map((choice) => (
                    <button
                      key={choice.code}
                      type="button"
                      onClick={() => onUnitWideSelectCode(choice.code)}
                      style={{
                        padding: 14,
                        textAlign: "left",
                        border: "2px solid var(--client-accent, #1a472a)",
                        borderRadius: 8,
                        background: "#f0f7f4",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: "monospace",
                      }}
                    >
                      {choice.code}
                      {choice.start_date && choice.end_date && (
                        <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: "#666", marginTop: 4 }}>
                          Season: {choice.start_date} – {choice.end_date}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button type="button" onClick={closePurchaseModal} style={{ padding: "10px 20px", background: "#eee", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>
                  {selectedHuntCode ? `Hunt code: ${selectedHuntCode}` : "Pay now"}
                </h3>
                <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
                  {selectedHuntCode
                    ? "You’ve chosen your hunt code. Pay the tag price now—on the next page you’ll choose your guide fee and hunt dates."
                    : purchaseTagForDates.hunt_code
                      ? "Pay the tag price now. On the next page you’ll choose your guide fee (guided hunt package) and pick your hunt dates."
                      : "Pay the tag price now. On the next page you’ll choose your guide fee and dates."}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {selectedHuntCode && (
                    <button
                      type="button"
                      onClick={() => { setSelectedHuntCode(null); setHuntCodeDates(null); setPurchaseStartDate(""); setPurchaseEndDate(""); }}
                      style={{ padding: "10px 20px", background: "#f0f0f0", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}
                    >
                      ← Back to hunt codes
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closePurchaseModal}
                    style={{ padding: "10px 20px", background: "#eee", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!purchaseTagForDates) return;
                      if (purchaseTagForDates.tag_type === "unit_wide" && selectedHuntCode) {
                        doPurchase(purchaseTagForDates.id, undefined, undefined, selectedHuntCode);
                      } else {
                        doPurchase(purchaseTagForDates.id);
                      }
                    }}
                    disabled={purchasing === purchaseTagForDates?.id}
                    style={{
                      padding: "10px 20px",
                      background: purchasing === purchaseTagForDates?.id ? "#ccc" : "var(--client-accent, #1a472a)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: purchasing === purchaseTagForDates?.id ? "not-allowed" : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {purchasing === purchaseTagForDates?.id ? "Processing…" : "Pay now"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#f0f7f4",
          borderRadius: 8,
          border: "1px solid #c8e6c9",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8, color: "var(--client-accent, #1a472a)" }}>
          About Tags for Sale
        </h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#555", lineHeight: 1.8, fontSize: 14 }}>
          <li>Tags may be Private Land or Unit Wide</li>
          <li>No draw required for many tags - guaranteed availability</li>
          <li>Hunt dates may be more flexible than public land seasons</li>
          <li>When you purchase a tag, select your hunt dates within the season (guided hunts are typically 3–7 days)</li>
        </ul>
      </div>
    </div>
  );
}

function AvailableTagCard({
  tag,
  onPurchase,
  purchasing,
}: {
  tag: PrivateTag;
  onPurchase: (tag: PrivateTag) => void;
  purchasing: boolean;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with species */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--client-accent, #1a472a) 0%, #2d5a3d 100%)",
          padding: 20,
          color: "white",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
          {tag.state || "NM"} • {tag.unit ? `Unit ${tag.unit}` : "Unit N/A"}
          {tag.tag_type && (
            <span> • {tag.tag_type === "unit_wide" ? "Unit Wide" : "Private Land"}</span>
          )}
        </div>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{tag.species}</h3>
        {tag.tag_name && (
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>{tag.tag_name}</div>
        )}
      </div>

      {/* Details */}
      <div style={{ padding: 20, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {/* Tag Type */}
          {tag.tag_type && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#666" }}>Type:</span>
              <span style={{ fontWeight: 500 }}>{tag.tag_type === "unit_wide" ? "Unit Wide" : "Private Land"}</span>
            </div>
          )}
          
          {/* Hunt Code(s) */}
          {tag.tag_type === "unit_wide" && tag.hunt_code_options ? (
            <div style={{ fontSize: 14 }}>
              <div style={{ color: "#666", marginBottom: 4 }}>Hunt codes (choose one at purchase):</div>
              <div style={{ fontWeight: 500, fontFamily: "monospace", fontSize: 13 }}>
                {tag.hunt_code_options.split(",").map((code: string, idx: number) => (
                  <span key={idx} style={{ display: "block", marginTop: idx > 0 ? 4 : 0 }}>
                    {code.trim()}
                  </span>
                ))}
              </div>
            </div>
          ) : tag.hunt_code && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#666" }}>Hunt Code:</span>
              <span style={{ fontWeight: 500, fontFamily: "monospace" }}>{tag.hunt_code}</span>
            </div>
          )}
          
          {/* Weapon */}
          {tag.weapon && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#666" }}>Weapon:</span>
              <span style={{ fontWeight: 500 }}>{tag.weapon}</span>
            </div>
          )}
          
          {/* Season Dates */}
          {tag.season_dates && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#666" }}>Season:</span>
              <span style={{ fontWeight: 500 }}>{tag.season_dates}</span>
            </div>
          )}
          
          {/* Unit (if not already in header) */}
          {tag.unit && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#666" }}>Unit:</span>
              <span style={{ fontWeight: 500 }}>{tag.unit}</span>
            </div>
          )}
        </div>

        {tag.notes && (
          <div style={{ marginTop: 12, padding: 12, background: "#f9f9f9", borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4, fontWeight: 600 }}>Notes:</div>
            <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>{tag.notes}</p>
          </div>
        )}
      </div>

      {/* Footer with price and button */}
      <div
        style={{
          padding: 20,
          borderTop: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#666" }}>Tag price</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--client-accent, #1a472a)" }}>
            {tag.price != null && Number(tag.price) > 0
              ? `$${Number(tag.price).toLocaleString()}`
              : "Contact for price"}
          </div>
        </div>
        <button
          onClick={() => onPurchase(tag)}
          disabled={purchasing}
          style={{
            padding: "12px 24px",
            background: purchasing ? "#ccc" : "var(--client-accent, #1a472a)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: purchasing ? "not-allowed" : "pointer",
            fontSize: 15,
          }}
        >
          {purchasing ? "Processing..." : "Purchase Tag"}
        </button>
      </div>
    </div>
  );
}

function MyTagCard({ tag }: { tag: PrivateTag }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 20,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h3 style={{ fontWeight: 600, fontSize: 18, margin: 0 }}>
              {tag.species || "Tag"}
            </h3>
            {tag.status && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 500,
                  background: getStatusColor(tag.status).bg,
                  color: getStatusColor(tag.status).color,
                }}
              >
                {tag.status}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "#666", fontSize: 14 }}>
            {tag.tag_type && (
              <span style={{ fontWeight: 600, color: "var(--client-accent, #1a472a)" }}>
                {tag.tag_type === "unit_wide" ? "Unit Wide" : "Private Land"}
              </span>
            )}
            {tag.hunt_code && <span>🏷️ Hunt code: {tag.hunt_code}</span>}
            {tag.ranch_name && <span>🏔️ {tag.ranch_name}</span>}
            {tag.unit && <span>📍 Unit {tag.unit}</span>}
            {tag.weapon && <span>🎯 {tag.weapon}</span>}
            {tag.season_dates && <span>📅 {tag.season_dates}</span>}
          </div>
        </div>
        <span style={{ fontSize: 20, color: "#999" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: "1px solid #eee",
            padding: 20,
            background: "#fafafa",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {tag.tag_type && (
              <DetailItem label="Type" value={tag.tag_type === "unit_wide" ? "Unit Wide" : "Private Land"} />
            )}
            {tag.hunt_code && <DetailItem label="Hunt Code" value={tag.hunt_code} />}
            {tag.ranch_name && <DetailItem label="Ranch" value={tag.ranch_name} />}
            {tag.species && <DetailItem label="Species" value={tag.species} />}
            {tag.unit && <DetailItem label="Unit" value={tag.unit} />}
            {tag.weapon && <DetailItem label="Weapon" value={tag.weapon} />}
            {tag.season_dates && <DetailItem label="Season Dates" value={tag.season_dates} />}
            {tag.status && <DetailItem label="Status" value={tag.status} />}
          </div>
          {tag.notes && (
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14, color: "#333" }}>Notes:</strong>
              <p style={{ marginTop: 4, color: "#666", fontSize: 14 }}>{tag.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#999", marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function getStatusColor(status: string): { bg: string; color: string } {
  switch (status.toLowerCase()) {
    case "confirmed":
    case "available":
      return { bg: "#e8f5e9", color: "#2e7d32" };
    case "pending":
      return { bg: "#fff3e0", color: "#e65100" };
    case "sold":
    case "purchased":
    case "used":
      return { bg: "#e3f2fd", color: "#1565c0" };
    default:
      return { bg: "#f5f5f5", color: "#666" };
  }
}
