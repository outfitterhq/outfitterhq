"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CalendarEvent, CalendarAudience, HuntStatus } from "@/lib/types/calendar";
import { AUDIENCE_LABELS } from "@/lib/types/calendar";
import type { HuntType, TagStatus, WorkflowState } from "@/lib/types/hunt-contracts";
import { TAG_STATUS_LABELS, HUNT_TYPE_LABELS } from "@/lib/types/hunt-contracts";

interface TimeOffRequest {
  id: string;
  guide_username: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const eventIdFromUrl = searchParams.get("event");
  const assignContractId = searchParams.get("assign_contract");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEditor, setShowEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [openedEventId, setOpenedEventId] = useState<string | null>(null);
  
  // Filters
  const [filterSpecies, setFilterSpecies] = useState<string>("");
  const [filterUnit, setFilterUnit] = useState<string>("");
  const [filterGuide, setFilterGuide] = useState<string>("");
  const [filterHuntCode, setFilterHuntCode] = useState<string>("");
  const [filterWeapon, setFilterWeapon] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [guides, setGuides] = useState<Array<{ username: string; email?: string; name?: string }>>([]);
  const [speciesOptions, setSpeciesOptions] = useState<string[]>(["Elk", "Mule / Coues Deer", "Antelope", "Oryx", "Ibex", "Bighorn", "Aoudad"]);
  const [pendingActions, setPendingActions] = useState<{
    total: number;
    counts: { assign_to_calendar: number; complete_event: number; generate_contract: number; send_docusign: number; admin_sign: number };
    items: Array<{ hunt_id: string; contract_id?: string; action: string; title: string; start_time: string | null; client_email: string | null }>;
  } | null>(null);
  const [showPendingActions, setShowPendingActions] = useState(true); // Always show by default

  // Load events and time off for current month
  useEffect(() => {
    loadEvents();
    loadTimeOff();
    loadPendingActions();
  }, [selectedDate]);

  // Open event by id from URL (e.g. /calendar?event=UUID from Tags for Sale "Open hunt & generate contract")
  useEffect(() => {
    if (!eventIdFromUrl || eventIdFromUrl === openedEventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/calendar/${eventIdFromUrl}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const e = data.event;
        if (!e || cancelled) return;
        const mapped: CalendarEvent = {
          ...e,
          start_date: e.start_time || e.start_date,
          end_date: e.end_time || e.end_date,
          notes: e.notes || e.description,
        };
        setSelectedDate(new Date(e.start_time || e.start_date));
        setEditingEvent(mapped);
        setShowEditor(true);
        setOpenedEventId(eventIdFromUrl);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventIdFromUrl]);

  // Handle assign_contract URL parameter - create calendar event from contract
  useEffect(() => {
    if (!assignContractId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/calendar/assign-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contract_id: assignContractId }),
        });
        if (!res.ok || cancelled) {
          const error = await res.json().catch(() => ({}));
          alert(error.error || "Failed to assign contract to calendar");
          return;
        }
        const data = await res.json();
        // Reload events and pending actions
        await loadEvents();
        await loadPendingActions();
        // Open the newly created event
        if (data.hunt_id) {
          window.history.replaceState({}, "", `/calendar?event=${data.hunt_id}`);
          // Force re-trigger event opening
          setTimeout(async () => {
            try {
              const eventRes = await fetch(`/api/calendar/${data.hunt_id}`);
              if (eventRes.ok) {
                const eventData = await eventRes.json();
                const e = eventData.event;
                if (e) {
                  const mapped: CalendarEvent = {
                    ...e,
                    start_date: e.start_time || e.start_date,
                    end_date: e.end_time || e.end_date,
                    notes: e.notes || e.description,
                  };
                  setSelectedDate(new Date(e.start_time || e.start_date));
                  setEditingEvent(mapped);
                  setShowEditor(true);
                  setOpenedEventId(data.hunt_id);
                }
              }
            } catch {
              // ignore
            }
          }, 500);
        }
      } catch (e) {
        console.error("Failed to assign contract:", e);
        alert("Failed to assign contract to calendar");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignContractId]);

  // Load guides for filter dropdown
  useEffect(() => {
    loadGuides();
    loadSpecies();
  }, []);

  async function loadSpecies() {
    try {
      const res = await fetch("/api/outfitter/species");
      if (res.ok) {
        const data = await res.json();
        setSpeciesOptions(data.species || ["Elk", "Mule / Coues Deer", "Antelope", "Oryx", "Ibex", "Bighorn", "Aoudad"]);
      }
    } catch (e) {
      console.error("Failed to load species", e);
    }
  }

  async function loadGuides() {
    try {
      const res = await fetch("/api/guides");
      if (res.ok) {
        const data = await res.json();
        setGuides(data.guides || []);
      }
    } catch (e) {
      console.error("Failed to load guides", e);
    }
  }

  async function loadEvents() {
    setLoading(true);
    setError(null);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const res = await fetch(`/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load events");
      }
      const data = await res.json();
      // Map database fields (start_time/end_time) to frontend model (start_date/end_date)
      const mappedEvents = (data.events || []).map((e: any) => ({
        ...e,
        start_date: e.start_time || e.start_date,
        end_date: e.end_time || e.end_date,
        notes: e.notes || e.description,
      }));
      setEvents(mappedEvents);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeOff() {
    try {
      const res = await fetch("/api/time-off?status=approved");
      if (res.ok) {
        const data = await res.json();
        setTimeOffRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Failed to load time off requests", e);
    }
  }

  async function loadPendingActions() {
    try {
      const res = await fetch("/api/admin/pending-actions");
      if (res.ok) {
        const data = await res.json();
        console.log("[CALENDAR] Pending actions loaded:", data);
        setPendingActions(data);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("[CALENDAR] Failed to load pending actions:", res.status, errorData);
        // Set empty state instead of null so queue still shows
        setPendingActions({ total: 0, counts: { assign_to_calendar: 0, complete_event: 0, generate_contract: 0, send_docusign: 0, admin_sign: 0 }, items: [] });
      }
    } catch (e) {
      console.error("[CALENDAR] Error loading pending actions:", e);
      // Set empty state instead of null so queue still shows
      setPendingActions({ total: 0, counts: { assign_to_calendar: 0, complete_event: 0, generate_contract: 0, send_docusign: 0, admin_sign: 0 }, items: [] });
    }
  }

  // Convert approved time off to calendar events for display
  // Get outfitter_id from first event (all events should have same outfitter_id)
  const outfitterId = events.length > 0 ? events[0].outfitter_id : "";
  
  const timeOffEvents: CalendarEvent[] = timeOffRequests.map((to) => ({
    id: `timeoff-${to.id}`,
    outfitter_id: outfitterId, // Required field
    title: `Time Off: ${to.guide_username}`,
    notes: to.reason || undefined,
    start_date: to.start_date,
    end_date: to.end_date,
    camp_name: undefined,
    client_email: undefined,
    guide_username: to.guide_username,
    audience: "internalOnly" as CalendarAudience,
    species: undefined,
    unit: undefined,
    status: "Inquiry",
    weapon: undefined,
  }));

  // Apply filters to events
  const filteredEvents = events.filter(e => {
    if (filterSpecies && e.species !== filterSpecies) return false;
    if (filterUnit && e.unit !== filterUnit) return false;
    if (filterGuide && e.guide_username !== filterGuide) return false;
    if (filterWeapon && e.weapon !== filterWeapon) return false;
    if (filterHuntCode) {
      // Search in hunt_code field, title, or notes
      const huntCodeMatch = e.hunt_code?.toLowerCase().includes(filterHuntCode.toLowerCase());
      const titleMatch = e.title?.toLowerCase().includes(filterHuntCode.toLowerCase());
      const notesMatch = e.notes?.toLowerCase().includes(filterHuntCode.toLowerCase());
      if (!huntCodeMatch && !titleMatch && !notesMatch) return false;
    }
    return true;
  });

  // Combine filtered events with time off events
  const allEventsForDisplay = [...filteredEvents, ...timeOffEvents];
  
  // Get unique values for filter dropdowns
  const uniqueSpecies = [...new Set(events.map(e => e.species).filter((s): s is string => Boolean(s)))];
  const uniqueUnits = [...new Set(events.map(e => e.unit).filter((u): u is string => Boolean(u)))].sort();
  const uniqueWeapons = [...new Set(events.map(e => e.weapon).filter((w): w is string => Boolean(w)))];
  const uniqueHuntCodes = [...new Set(events.map(e => e.hunt_code).filter((h): h is string => Boolean(h)))].sort();
  const activeFiltersCount = [filterSpecies, filterUnit, filterGuide, filterHuntCode, filterWeapon].filter(Boolean).length;

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await loadEvents();
    } catch (e: any) {
      alert("Error: " + String(e));
    }
  }

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Group events by date (including time off)
  const eventsByDate = new Map<string, CalendarEvent[]>();
  allEventsForDisplay.forEach((e) => {
    const dateKey = new Date((e as any).start_date || (e as any).start_time || (e as any).startDate).toISOString().split("T")[0];
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(e);
  });

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function changeMonth(delta: number) {
    setSelectedDate(new Date(year, month + delta, 1));
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Calendar</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Manage hunts and events</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/time-off-requests"
            style={{
              padding: "10px 20px",
              background: "#f5f5f5",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⏰</span>
            <span>Time Off Requests</span>
          </Link>
          <button
            onClick={() => {
              setEditingEvent(null);
              setShowEditor(true);
            }}
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + New Event
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {/* Work Queue: Contracts and events needing attention */}
      {/* Always show the work queue section, even if empty */}
      <div
        style={{
          marginBottom: 16,
          border: pendingActions && pendingActions.total > 0 ? "2px solid #ff9800" : "1px solid #ddd",
          borderRadius: 12,
          background: pendingActions && pendingActions.total > 0 ? "#fff8e1" : "#f9f9f9",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setShowPendingActions((v) => !v)}
          style={{
            width: "100%",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 16,
            textAlign: "left",
          }}
        >
          <span>
            📋 Work Queue: {pendingActions ? pendingActions.total : 0} item{(pendingActions?.total || 0) !== 1 ? "s" : ""} need attention
            {pendingActions && (pendingActions.counts.assign_to_calendar > 0 || pendingActions.counts.complete_event > 0) && (
              <span style={{ marginLeft: 12, color: "#e65100", fontSize: 15, fontWeight: 700 }}>
                {pendingActions.counts.assign_to_calendar > 0 && (
                  <span>⚠️ {pendingActions.counts.assign_to_calendar} contract{pendingActions.counts.assign_to_calendar !== 1 ? "s" : ""} need calendar assignment</span>
                )}
                {pendingActions.counts.assign_to_calendar > 0 && pendingActions.counts.complete_event > 0 && " • "}
                {pendingActions.counts.complete_event > 0 && (
                  <span>📝 {pendingActions.counts.complete_event} event{pendingActions.counts.complete_event !== 1 ? "s" : ""} need completion</span>
                )}
              </span>
            )}
            {pendingActions && pendingActions.counts.assign_to_calendar === 0 && pendingActions.counts.complete_event === 0 && (
              <span style={{ marginLeft: 12, color: "#666", fontSize: 14, fontWeight: 400 }}>
                All contracts assigned and events completed
              </span>
            )}
          </span>
          <span style={{ opacity: 0.7 }}>{showPendingActions ? "▼" : "▶"}</span>
        </button>
        {showPendingActions && (
          <div style={{ padding: pendingActions && pendingActions.total > 0 ? "0 20px 16px" : "0 20px 16px" }}>
            {pendingActions && pendingActions.total > 0 ? (
              <>
                {pendingActions.counts.assign_to_calendar > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#e65100" }}>
                      Contracts Needing Calendar Assignment ({pendingActions.counts.assign_to_calendar})
                    </h3>
                    <div style={{ 
                      background: "white", 
                      border: "1px solid #ffcc80", 
                      borderRadius: 8, 
                      padding: 12,
                      maxHeight: 300,
                      overflowY: "auto"
                    }}>
                      <ul style={{ margin: 0, paddingLeft: 20, listStyle: "disc" }}>
                        {pendingActions.items
                          .filter((item) => item.action === "assign_to_calendar")
                          .map((item) => {
                            const dateStr = item.start_time
                              ? new Date(item.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                              : "";
                            const clientInfo = item.client_email ? ` — ${item.client_email}` : "";
                            return (
                              <li key={`${item.contract_id}-assign`} style={{ marginBottom: 8 }}>
                                <button
                                  onClick={async () => {
                                    // Open event editor directly with contract details
                                    const startDate = item.start_time 
                                      ? new Date(item.start_time)
                                      : new Date();
                                    const endDate = item.start_time
                                      ? new Date(new Date(item.start_time).getTime() + 7 * 24 * 60 * 60 * 1000)
                                      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                                    
                                    // Get outfitter_id from first event (all events should have same outfitter_id)
                                    const outfitterId = events.length > 0 ? events[0].outfitter_id : "";
                                    
                                    const newEvent: CalendarEvent = {
                                      id: "",
                                      outfitter_id: outfitterId, // Required field - will be set by API if empty
                                      title: item.title,
                                      notes: item.client_email 
                                        ? `Client: ${item.client_email}\n\nContract ID: ${item.contract_id}\n(This event will be linked to the contract when saved)`
                                        : `Contract ID: ${item.contract_id}\n(This event will be linked to the contract when saved)`,
                                      start_date: startDate.toISOString(),
                                      end_date: endDate.toISOString(),
                                      camp_name: null,
                                      client_email: item.client_email,
                                      guide_username: null,
                                      audience: "internalOnly",
                                      species: null,
                                      unit: null,
                                      status: "Pending",
                                      weapon: null,
                                    };
                                    
                                    // Store contract ID to link after saving
                                    (newEvent as any).contractIdForLinking = item.contract_id;
                                    
                                    setEditingEvent(newEvent);
                                    setShowEditor(true);
                                  }}
                                  style={{ 
                                    fontWeight: 600, 
                                    color: "#1565c0",
                                    textDecoration: "none",
                                    fontSize: 14,
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    width: "100%"
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                                >
                                  {item.title}
                                </button>
                                {dateStr && <span style={{ color: "#666", marginLeft: 8 }}>({dateStr})</span>}
                                {clientInfo && <span style={{ color: "#666", marginLeft: 8 }}>{clientInfo}</span>}
                                <span style={{ marginLeft: 8, color: "#e65100", fontWeight: 500 }}>→ Click to open editor</span>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  </div>
                )}
                {pendingActions.counts.complete_event > 0 && (
                  <div style={{ marginBottom: 12 }}>
                        <h3 style={{ margin: pendingActions.counts.assign_to_calendar > 0 ? "16px 0 8px 0" : "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#e65100" }}>
                          Events Needing Completion ({pendingActions.counts.complete_event})
                        </h3>
                        <div style={{ 
                          background: "white", 
                          border: "1px solid #ffcc80", 
                          borderRadius: 8, 
                          padding: 12,
                          maxHeight: 300,
                          overflowY: "auto"
                        }}>
                          <ul style={{ margin: 0, paddingLeft: 20, listStyle: "disc" }}>
                            {pendingActions.items
                              .filter((item) => item.action === "complete_event")
                              .map((item) => {
                                const dateStr = item.start_time
                                  ? new Date(item.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                                  : "";
                                const clientInfo = item.client_email ? ` — ${item.client_email}` : "";
                                return (
                                  <li key={`${item.hunt_id}-complete`} style={{ marginBottom: 8 }}>
                                    <button
                                      onClick={async () => {
                                        // Fetch event and open editor directly
                                        try {
                                          const res = await fetch(`/api/calendar/${item.hunt_id}`);
                                          if (res.ok) {
                                            const data = await res.json();
                                            const e = data.event;
                                            if (e) {
                                              const mapped: CalendarEvent = {
                                                ...e,
                                                start_date: e.start_time || e.start_date,
                                                end_date: e.end_time || e.end_date,
                                                notes: e.notes || e.description,
                                              };
                                              setEditingEvent(mapped);
                                              setShowEditor(true);
                                            }
                                          } else {
                                            alert("Failed to load event");
                                          }
                                        } catch (error) {
                                          console.error("Failed to load event:", error);
                                          alert("Failed to load event");
                                        }
                                      }}
                                      style={{ 
                                        fontWeight: 600, 
                                        color: "#1565c0",
                                        textDecoration: "none",
                                        fontSize: 14,
                                        background: "none",
                                        border: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        width: "100%"
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                                    >
                                      {item.title}
                                    </button>
                                    {dateStr && <span style={{ color: "#666", marginLeft: 8 }}>({dateStr})</span>}
                                    {clientInfo && <span style={{ color: "#666", marginLeft: 8 }}>{clientInfo}</span>}
                                    <span style={{ marginLeft: 8, color: "#e65100", fontWeight: 500 }}>→ Click to open editor</span>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                  </div>
                )}
                {(pendingActions.counts.generate_contract > 0 || pendingActions.counts.send_docusign > 0 || pendingActions.counts.admin_sign > 0) && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #ddd" }}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#666" }}>
                      Other Actions Needed
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: 20, listStyle: "disc" }}>
                      {pendingActions.items
                        .filter((item) => item.action !== "assign_to_calendar")
                        .map((item) => {
                          const actionLabel =
                            item.action === "generate_contract"
                              ? "Generate contract"
                              : item.action === "send_docusign"
                                ? "Send to DocuSign"
                                : "Sign (admin)";
                          const dateStr = item.start_time
                            ? new Date(item.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : "";
                          const linkUrl = item.hunt_id
                            ? `/calendar?event=${encodeURIComponent(item.hunt_id)}`
                            : "#";
                          return (
                            <li key={`${item.hunt_id || item.contract_id}-${item.action}`} style={{ marginBottom: 6 }}>
                              <Link
                                href={linkUrl}
                                style={{ fontWeight: 500, color: "#1565c0" }}
                              >
                                {item.title}
                                {dateStr ? ` (${dateStr})` : ""}
                              </Link>
                              {" — "}
                              <span style={{ color: "#e65100" }}>{actionLabel}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "12px 0", color: "#666", fontSize: 14, textAlign: "center" }}>
                ✓ All contracts have been assigned to calendar events
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Toggle Button */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: "10px 20px",
            background: activeFiltersCount > 0 ? "#0070f3" : "#f5f5f5",
            color: activeFiltersCount > 0 ? "white" : "#333",
            border: "1px solid #ddd",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🔍 Filters</span>
          {activeFiltersCount > 0 && (
            <span style={{
              background: "white",
              color: "#0070f3",
              borderRadius: "50%",
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
            }}>
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div style={{
          background: "#f9f9f9",
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Filter Hunts</h3>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setFilterSpecies("");
                  setFilterUnit("");
                  setFilterGuide("");
                  setFilterHuntCode("");
                  setFilterWeapon("");
                }}
                style={{
                  padding: "6px 12px",
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {/* Species Filter */}
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Species</label>
              <select
                value={filterSpecies}
                onChange={(e) => setFilterSpecies(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              >
                <option value="">All Species</option>
                {uniqueSpecies.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Unit Filter */}
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Unit</label>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              >
                <option value="">All Units</option>
                {uniqueUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Guide Filter */}
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Guide</label>
              <select
                value={filterGuide}
                onChange={(e) => setFilterGuide(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              >
                <option value="">All Guides</option>
                {guides.map(g => {
                  const id = g.username || g.email || "";
                  return (
                    <option key={id} value={id}>{g.name || g.email || g.username}</option>
                  );
                })}
              </select>
            </div>

            {/* Weapon Filter */}
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Weapon</label>
              <select
                value={filterWeapon}
                onChange={(e) => setFilterWeapon(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              >
                <option value="">All Weapons</option>
                {uniqueWeapons.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            {/* Hunt Code Filter */}
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Hunt Code</label>
              {uniqueHuntCodes.length > 0 ? (
                <select
                  value={filterHuntCode}
                  onChange={(e) => setFilterHuntCode(e.target.value)}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                >
                  <option value="">All Hunt Codes</option>
                  {uniqueHuntCodes.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={filterHuntCode}
                  onChange={(e) => setFilterHuntCode(e.target.value)}
                  placeholder="e.g., ELK-1-294"
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
              )}
            </div>
          </div>

          {/* Filter Results Count */}
          <div style={{ marginTop: 16, fontSize: 13, color: "#666" }}>
            Showing {filteredEvents.length} of {events.length} hunts
            {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount > 1 ? "s" : ""} applied)`}
          </div>
        </div>
      )}

      {showEditor && (
        <EventEditor
          event={editingEvent}
          onClose={() => {
            setShowEditor(false);
            setEditingEvent(null);
            loadPendingActions();
          }}
          onSave={async () => {
            await loadEvents();
            setShowEditor(false);
            setEditingEvent(null);
            await loadPendingActions();
          }}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
          {/* Month header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              background: "#f5f5f5",
              borderBottom: "1px solid #ddd",
            }}
          >
            <button
              onClick={() => changeMonth(-1)}
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                background: "white",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              ← Prev
            </button>
            <h2 style={{ margin: 0 }}>
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={() => changeMonth(1)}
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                background: "white",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Next →
            </button>
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                style={{
                  padding: 12,
                  textAlign: "center",
                  fontWeight: 600,
                  background: "#f9f9f9",
                  borderBottom: "1px solid #ddd",
                }}
              >
                {day}
              </div>
            ))}

            {/* Empty cells for days before month starts */}
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  minHeight: 100,
                  borderRight: "1px solid #eee",
                  borderBottom: "1px solid #eee",
                  background: "#fafafa",
                }}
              />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const dateKey = date.toISOString().split("T")[0];
              const dayEvents = eventsByDate.get(dateKey) || [];
              const isToday =
                date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={day}
                  style={{
                    minHeight: 100,
                    padding: 8,
                    borderRight: "1px solid #eee",
                    borderBottom: "1px solid #eee",
                    background: isToday ? "#e3f2fd" : "white",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      fontWeight: isToday ? 700 : 500,
                      marginBottom: 4,
                      color: isToday ? "#1976d2" : "inherit",
                    }}
                  >
                    {day}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dayEvents.slice(0, 3).map((e) => {
                      const isTimeOff = e.title?.startsWith("Time Off:");
                      const pendingItem = isTimeOff ? undefined : pendingActions?.items.find((i) => i.hunt_id === e.id);
                      const isPending = (e as any).status === "Pending";
                      const actionBadge =
                        pendingItem?.action === "generate_contract"
                          ? " • contract"
                          : pendingItem?.action === "send_docusign"
                            ? " • DocuSign"
                            : pendingItem?.action === "admin_sign"
                              ? " • sign"
                              : "";
                      // Color coding: Pending = orange, Time Off = orange, Action needed = red, Normal = blue
                      const bgColor = isTimeOff 
                        ? "#ff9800" 
                        : pendingItem 
                          ? "#e65100" 
                          : isPending 
                            ? "#ff9800" 
                            : "#0070f3";
                      return (
                        <div
                          key={e.id}
                          onClick={() => {
                            if (!isTimeOff) {
                              setEditingEvent(e);
                              setShowEditor(true);
                            }
                          }}
                          style={{
                            fontSize: 11,
                            padding: "4px 6px",
                            background: bgColor,
                            color: "white",
                            borderRadius: 4,
                            cursor: isTimeOff ? "default" : "pointer",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            opacity: isTimeOff ? 0.8 : 1,
                            border: isPending ? "1px solid #ff6f00" : "none",
                          }}
                          title={
                            e.title +
                            (isTimeOff ? " (Time Off - Read Only)" : "") +
                            (isPending ? " (Pending - Needs setup)" : "") +
                            (actionBadge ? ` — Action needed: ${actionBadge.replace(" • ", "")}` : "")
                          }
                        >
                          {e.title}
                          {isPending && !actionBadge ? <span style={{ opacity: 0.9 }}> • Pending</span> : null}
                          {actionBadge ? <span style={{ opacity: 0.9 }}>{actionBadge}</span> : null}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

// Event Editor Component
function EventEditor({
  event,
  onClose,
  onSave,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState(event?.title || "");
  const [notes, setNotes] = useState(event?.notes || "");
  const [startDate, setStartDate] = useState(
    event?.start_date
      ? new Date(event.start_date).toISOString().slice(0, 16)
      : ""
  );
  const [endDate, setEndDate] = useState(
    event?.end_date
      ? new Date(event.end_date).toISOString().slice(0, 16)
      : ""
  );
  const [campName, setCampName] = useState(event?.camp_name || "");
  const [clientEmail, setClientEmail] = useState(event?.client_email || "");
  // Use email as fallback if username is empty (same as iOS)
  const [guideUsername, setGuideUsername] = useState(
    event?.guide_username || ""
  );
  const [audience, setAudience] = useState<CalendarAudience>(event?.audience || "all");
  const [species, setSpecies] = useState(event?.species || "");
  const [unit, setUnit] = useState(event?.unit || "");
  const [status, setStatus] = useState(event?.status || "Inquiry");
  const [weapon, setWeapon] = useState(event?.weapon || "");
  const [huntCode, setHuntCode] = useState(event?.hunt_code || "");
  const [huntType, setHuntType] = useState<HuntType>(event?.hunt_type || "draw");
  const [tagStatus, setTagStatus] = useState<TagStatus>(event?.tag_status || "pending");
  const [guides, setGuides] = useState<Array<{ username: string; email?: string; name?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [workflowContract, setWorkflowContract] = useState<{ id: string; status?: string } | null>(null);
  const [tagStatusUpdating, setTagStatusUpdating] = useState(false);
  const [sendDocusignLoading, setSendDocusignLoading] = useState(false);
  const [adminSignLoading, setAdminSignLoading] = useState(false);
  const [generateContractLoading, setGenerateContractLoading] = useState(false);
  const [speciesOptions, setSpeciesOptions] = useState<string[]>(["Elk", "Mule / Coues Deer", "Antelope", "Oryx", "Ibex", "Bighorn", "Aoudad"]);
  const [huntPhotos, setHuntPhotos] = useState<Array<{ id: string; url: string }>>([]);

  const statusOptions = ["Inquiry", "Pending", "Booked", "Completed", "Cancelled"];
  const weaponOptions = ["Rifle", "Muzzleloader", "Bow"];
  const huntTypeOptions: HuntType[] = ["draw", "private_land"];
  const tagStatusOptions: TagStatus[] = ["pending", "applied", "drawn", "unsuccessful", "confirmed"];

  useEffect(() => {
    loadGuides();
    loadAllEvents();
    loadTimeOffForEditor();
    loadSpecies();
    if (event?.id) {
      loadWorkflowState(event.id);
      loadHuntPhotos(event.id);
    } else {
      setHuntPhotos([]);
    }
  }, [event?.id]);

  async function loadHuntPhotos(huntId: string) {
    try {
      const res = await fetch(`/api/photos?hunt_id=${encodeURIComponent(huntId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.photos || data || []).map((p: { id: string; url?: string; signedUrl?: string; signed_url?: string }) => ({
        id: p.id,
        url: p.url || p.signedUrl || p.signed_url || "",
      })).filter((p: { url: string }) => p.url);
      setHuntPhotos(list);
    } catch {
      setHuntPhotos([]);
    }
  }

  async function loadSpecies() {
    try {
      const res = await fetch("/api/outfitter/species");
      if (res.ok) {
        const data = await res.json();
        setSpeciesOptions(data.species || ["Elk", "Mule / Coues Deer", "Antelope", "Oryx", "Ibex", "Bighorn", "Aoudad"]);
      }
    } catch (e) {
      console.error("Failed to load species", e);
    }
  }

  async function loadWorkflowState(huntId: string) {
    try {
      const res = await fetch(`/api/calendar/${huntId}/tag-status`);
      if (res.ok) {
        const data = await res.json();
        setWorkflowState(data.workflow_state);
        setWorkflowContract(data.contract || null);
        if (data.hunt?.tag_status) {
          setTagStatus(data.hunt.tag_status);
        }
        if (data.hunt?.hunt_type) {
          setHuntType(data.hunt.hunt_type);
        }
      }
    } catch (e) {
      console.error("Failed to load workflow state", e);
    }
  }

  async function handleGenerateContract() {
    if (!event?.id) return;
    setGenerateContractLoading(true);
    try {
      const body: { hunt_code?: string; start_time?: string; end_time?: string } = {};
      if (huntCode.trim()) body.hunt_code = huntCode.trim();
      if (startDate) body.start_time = new Date(startDate).toISOString();
      if (endDate) body.end_time = new Date(endDate).toISOString();
      const res = await fetch(`/api/calendar/${event.id}/generate-contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to generate contract");
        return;
      }
      alert(data.message || "Hunt contract generated. Client can complete and sign it from their Documents page.");
      await loadWorkflowState(event.id);
    } catch (e: unknown) {
      alert("Failed to generate contract: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerateContractLoading(false);
    }
  }

  async function handleSendToDocuSign() {
    if (!workflowContract?.id) return;
    setSendDocusignLoading(true);
    try {
      const res = await fetch(`/api/hunt-contracts/${workflowContract.id}/send-docusign`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || data.hint || "Failed to send contract to DocuSign");
        return;
      }
      alert(data.docusign?.message || "Contract sent to DocuSign. Client can sign from their Documents page.");
      if (event?.id) {
        await loadWorkflowState(event.id);
      }
    } catch (e: unknown) {
      alert("Failed to send to DocuSign: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSendDocusignLoading(false);
    }
  }

  async function handleAdminSignDocuSign() {
    if (!workflowContract?.id) return;
    setAdminSignLoading(true);
    try {
      const res = await fetch(`/api/hunt-contracts/${workflowContract.id}/admin-sign-docusign`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to get signing URL");
        return;
      }
      if (data.signingUrl) {
        window.open(data.signingUrl, "_blank");
      } else if (data.mock && data.message) {
        alert(data.message);
      }
      if (event?.id) {
        await loadWorkflowState(event.id);
      }
    } catch (e: unknown) {
      alert("Failed to open DocuSign: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAdminSignLoading(false);
    }
  }

  async function updateTagStatus(newStatus: TagStatus) {
    if (!event?.id) return;
    
    if ((newStatus === "drawn" || newStatus === "confirmed") && !clientEmail) {
      alert("Cannot mark tag as drawn/confirmed without a client assigned to the hunt.");
      return;
    }

    const action = newStatus === "drawn" 
      ? "mark this hunt as DRAWN (will generate contract)" 
      : newStatus === "confirmed"
      ? "mark this tag as CONFIRMED (will generate contract)"
      : `change tag status to ${TAG_STATUS_LABELS[newStatus]}`;

    if (!confirm(`Are you sure you want to ${action}?`)) return;

    setTagStatusUpdating(true);
    try {
      const res = await fetch(`/api/calendar/${event.id}/tag-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update tag status");
      }

      setTagStatus(newStatus);
      
      if (data.contract_generated) {
        alert("Tag status updated. Contract has been generated and sent to the client!");
      } else if (newStatus === "drawn" || newStatus === "confirmed") {
        alert(data.hint || "Tag status updated, but no contract was generated. Make sure a contract template exists.");
      } else {
        alert("Tag status updated.");
      }

      // Reload workflow state
      await loadWorkflowState(event.id);
    } catch (e: any) {
      alert("Error: " + String(e.message || e));
    } finally {
      setTagStatusUpdating(false);
    }
  }

  async function loadAllEvents() {
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const data = await res.json();
        const mappedEvents = (data.events || []).map((e: any) => ({
          ...e,
          start_date: e.start_time || e.start_date,
          end_date: e.end_time || e.end_date,
        }));
        setAllEvents(mappedEvents);
      }
    } catch (e) {
      console.error("Failed to load events for conflict checking", e);
    }
  }

  async function loadTimeOffForEditor() {
    try {
      const res = await fetch("/api/time-off?status=approved");
      if (res.ok) {
        const data = await res.json();
        setTimeOffRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Failed to load time off for conflict checking", e);
    }
  }

  function checkConflicts(): string | null {
    if (!guideUsername || !startDate || !endDate) {
      return null; // No guide assigned, no conflict check needed
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    // Helper to check date overlap
    function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
      return aStart <= bEnd && bStart <= aEnd;
    }

    // Check for double-booking with other hunts
    for (const existingEvent of allEvents) {
      if (event && existingEvent.id === event.id) continue; // Skip self when editing
      
      if (existingEvent.guide_username && 
          existingEvent.guide_username.toLowerCase() === guideUsername.toLowerCase()) {
        const existingStart = new Date(existingEvent.start_date);
        const existingEnd = new Date(existingEvent.end_date);
        
        if (overlaps(newStart, newEnd, existingStart, existingEnd)) {
          return `Guide ${guideUsername} is already assigned to "${existingEvent.title}" from ${existingStart.toLocaleDateString()} to ${existingEnd.toLocaleDateString()}. Please adjust dates or change the assigned guide.`;
        }
      }
    }

    // Check for conflicts with approved time off
    for (const timeOff of timeOffRequests) {
      if (timeOff.guide_username.toLowerCase() === guideUsername.toLowerCase() &&
          timeOff.status === "approved") {
        const toStart = new Date(timeOff.start_date);
        const toEnd = new Date(timeOff.end_date);
        
        if (overlaps(newStart, newEnd, toStart, toEnd)) {
          return `Guide ${guideUsername} has approved time off from ${toStart.toLocaleDateString()} to ${toEnd.toLocaleDateString()}. Cannot schedule a hunt during this period.`;
        }
      }
    }

    return null;
  }

  async function loadGuides() {
    try {
      const res = await fetch("/api/guides");
      if (res.ok) {
        const data = await res.json();
        setGuides(data.guides || []);
      }
    } catch (e) {
      console.error("Failed to load guides", e);
    }
  }

  async function handleSave() {
    if (!title.trim() || !startDate || !endDate) {
      alert("Title, start date, and end date are required");
      return;
    }

    // Check for conflicts before saving
    const conflict = checkConflicts();
    if (conflict) {
      setConflictError(conflict);
      alert(conflict);
      return;
    }
    setConflictError(null);

    setLoading(true);
    try {
      const body = {
        title: title.trim(),
        notes: notes.trim() || null,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        camp_name: campName.trim() || null,
        client_email: clientEmail.trim() || null,
        guide_username: guideUsername.trim() || null,
        audience,
        species: species.trim() || null,
        unit: unit.trim() || null,
        status: status || "Inquiry",
        weapon: weapon.trim() || null,
        hunt_code: huntCode.trim() || null,
        hunt_type: huntType,
        tag_status: event ? undefined : tagStatus, // Only set on create, use tag-status endpoint for updates
      };

      const url = event ? `/api/calendar/${event.id}` : "/api/calendar";
      const method = event ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      // Get the saved event ID from response (for new events)
      const savedEvent = await res.json().catch(() => null);
      const savedEventId = savedEvent?.event?.id || event?.id;
      
      // If this was a new event created from a contract, link it now
      const contractId = (event as any)?.contractIdForLinking;
      if (contractId && savedEventId && !event?.id) {
        try {
          const linkRes = await fetch("/api/calendar/assign-contract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              contract_id: contractId,
              hunt_id: savedEventId 
            }),
          });
          if (!linkRes.ok) {
            console.error("Failed to link contract to event");
          }
        } catch (error) {
          console.error("Failed to link contract:", error);
        }
      }

      onSave();
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm("Delete this event?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      onSave();
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 600,
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{event ? "Edit Event" : "New Event"}</h2>

        {/* Hunt & contract details – visible at top, used when generating contract */}
        <div
          style={{
            padding: 16,
            background: "#f0f7f4",
            border: "1px solid #1a472a",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#1a472a" }}>
            Hunt & contract details
          </h3>
          <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
            Set these before clicking &quot;Generate hunt contract&quot;. Hunt code can come from Tags for Sale.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="Hunt name or event title"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Start Date & Time *</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setConflictError(null);
                  }}
                  style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>End Date & Time *</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setConflictError(null);
                  }}
                  style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Hunt code (optional)</label>
              <input
                type="text"
                value={huntCode}
                onChange={(e) => setHuntCode(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="e.g. ELK-1-294 or from Tags for Sale"
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Camp / Location</label>
            <input
              type="text"
              value={campName}
              onChange={(e) => setCampName(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Optional"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Client Email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Optional"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Species</label>
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            >
              <option value="">None</option>
              {speciesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Optional"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Weapon</label>
            <select
              value={weapon}
              onChange={(e) => setWeapon(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            >
              <option value="">None</option>
              {weaponOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as HuntStatus)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Hunt Workflow Section */}
          <div style={{ 
            border: "1px solid #ddd", 
            borderRadius: 8, 
            padding: 16, 
            background: "#f9f9f9",
            marginTop: 8 
          }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600 }}>
              Hunt & Contract Workflow
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500, fontSize: 13 }}>Hunt Type</label>
                <select
                  value={huntType}
                  onChange={(e) => setHuntType(e.target.value as HuntType)}
                  style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                >
                  {huntTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {HUNT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500, fontSize: 13 }}>Tag Status</label>
                {event?.id ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={tagStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value as TagStatus;
                        if (newStatus !== tagStatus) {
                          updateTagStatus(newStatus);
                        }
                      }}
                      disabled={tagStatusUpdating}
                      style={{ 
                        flex: 1, 
                        padding: 8, 
                        border: "1px solid #ddd", 
                        borderRadius: 6,
                        background: tagStatusUpdating ? "#eee" : "white"
                      }}
                    >
                      {tagStatusOptions.map((s) => (
                        <option key={s} value={s}>
                          {TAG_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value={tagStatus}
                    onChange={(e) => setTagStatus(e.target.value as TagStatus)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                  >
                    {tagStatusOptions.map((s) => (
                      <option key={s} value={s}>
                        {TAG_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Workflow State Display */}
            {event?.id && workflowState && (
              <div style={{ 
                marginTop: 12, 
                padding: 12, 
                background: workflowState.step === 6 ? "#e8f5e9" : 
                           workflowState.step === -1 ? "#ffebee" : "#e3f2fd",
                borderRadius: 6,
                fontSize: 13
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ 
                    display: "inline-block", 
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%",
                    background: workflowState.step === 6 ? "#4caf50" : 
                               workflowState.step === -1 ? "#f44336" : "#2196f3"
                  }} />
                  <strong>{workflowState.label}</strong>
                  {workflowState.step !== null && workflowState.step > 0 && workflowState.step < 6 && (
                    <span style={{ opacity: 0.7 }}>(Step {workflowState.step} of 6)</span>
                  )}
                </div>
                <p style={{ margin: 0, opacity: 0.8 }}>{workflowState.description}</p>
                {/* Generate hunt contract: use hunt code (optional) and dates above, then generate */}
                {workflowState.next_action === "generate_contract" && (
                  <button
                    type="button"
                    onClick={handleGenerateContract}
                    disabled={generateContractLoading}
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      background: generateContractLoading ? "#999" : "#1a472a",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: generateContractLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {generateContractLoading ? "Generating…" : "Generate hunt contract"}
                  </button>
                )}
                {/* Send to DocuSign button when contract is ready for signature */}
                {workflowState.next_action === "send_docusign" && workflowContract?.id && (
                  <button
                    type="button"
                    onClick={handleSendToDocuSign}
                    disabled={sendDocusignLoading}
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      background: sendDocusignLoading ? "#999" : "#1a472a",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: sendDocusignLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {sendDocusignLoading ? "Sending…" : "Send to DocuSign"}
                  </button>
                )}
                {/* Admin sign (DocuSign) when client has signed */}
                {workflowState.next_action === "wait_for_signatures" &&
                  workflowContract?.id &&
                  workflowContract?.status === "client_signed" && (
                    <button
                      type="button"
                      onClick={handleAdminSignDocuSign}
                      disabled={adminSignLoading}
                      style={{
                        marginTop: 8,
                        padding: "8px 16px",
                        background: adminSignLoading ? "#999" : "#1976d2",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: adminSignLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {adminSignLoading ? "Opening…" : "Admin sign (DocuSign)"}
                    </button>
                  )}
              </div>
            )}

            <p style={{ fontSize: 11, color: "#666", marginTop: 8, marginBottom: 0 }}>
              {huntType === "draw" 
                ? "For draw hunts: set tag status to 'Drawn' after successful draw to generate contract." 
                : "For tags for sale: set tag status to 'Confirmed' when tag is secured. Then set Hunt Code (optional) and dates above and click Generate hunt contract."}
            </p>
          </div>

          {/* Photos for this hunt (from closeout / success library) */}
          {event?.id && (
            <div
              style={{
                padding: 16,
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600 }}>Photos for this hunt</h3>
              {huntPhotos.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {huntPhotos.map((p) => (
                    <img
                      key={p.id}
                      src={p.url}
                      alt="Hunt"
                      style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
                  No photos yet. Add photos after the hunt via <strong>Success Library</strong> (closeout or manual entry).
                </p>
              )}
            </div>
          )}

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Assigned Guide (Optional)</label>
            <select
              value={guideUsername}
              onChange={(e) => {
                setGuideUsername(e.target.value);
                setConflictError(null); // Clear conflict error when guide changes
              }}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            >
              <option value="">No Guide Assigned</option>
              {guides.map((g) => {
                // Use email as identifier if username is empty (same as iOS)
                const identifier = g.username || g.email || "";
                return (
                  <option key={identifier} value={identifier}>
                    {g.name || g.email || g.username} {identifier ? `(${identifier})` : ""}
                  </option>
                );
              })}
            </select>
            <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Guides only see hunts they are assigned to. Clients only see hunts with their email.
            </p>
            {conflictError && (
              <div style={{ marginTop: 8, padding: 8, background: "#fee", borderRadius: 4, fontSize: 12, color: "#c00" }}>
                ⚠️ {conflictError}
              </div>
            )}
          </div>


          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6, minHeight: 80 }}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          {event && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: "10px 20px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading || !title.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
