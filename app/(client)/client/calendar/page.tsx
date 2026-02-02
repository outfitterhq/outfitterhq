"use client";

import { useState, useEffect } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  camp_name?: string;
  species?: string;
  unit?: string;
  weapon?: string;
  status?: string;
  guide_username?: string;
  notes?: string;
}

export default function ClientCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [showDayDetails, setShowDayDetails] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    // Reload events when month changes
    loadEvents();
  }, [selectedDate]);

  async function loadEvents() {
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const res = await fetch(`/api/client/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load calendar");
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

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

  // Group events by date
  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.forEach((e) => {
    const startDate = new Date(e.start_time);
    const endDate = new Date(e.end_time);
    
    // Add event to all days it spans
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey)!.push(e);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  function handleDayClick(day: number) {
    const date = new Date(year, month, day);
    const dateKey = date.toISOString().split("T")[0];
    const dayEvents = eventsByDate.get(dateKey) || [];
    
    // Remove duplicates (events that span multiple days)
    const uniqueEvents = Array.from(
      new Map(dayEvents.map((e) => [e.id, e])).values()
    );
    
    setSelectedDayEvents(uniqueEvents);
    setShowDayDetails(true);
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading your calendar...</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div style={{ background: "#fee", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <p style={{ color: "#c00" }}>{error}</p>
        </div>
      )}

      {/* Calendar Grid */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden", background: "white" }}>
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
              fontWeight: 600,
            }}
          >
            ← Prev
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
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
              fontWeight: 600,
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
                fontSize: 14,
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
            
            // Remove duplicates
            const uniqueDayEvents = Array.from(
              new Map(dayEvents.map((e) => [e.id, e])).values()
            );
            
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                style={{
                  minHeight: 100,
                  padding: 8,
                  borderRight: "1px solid #eee",
                  borderBottom: "1px solid #eee",
                  background: isToday ? "#e3f2fd" : "white",
                  position: "relative",
                  cursor: uniqueDayEvents.length > 0 ? "pointer" : "default",
                }}
              >
                <div
                  style={{
                    fontWeight: isToday ? 700 : 500,
                    marginBottom: 4,
                    color: isToday ? "#1976d2" : "inherit",
                    fontSize: 14,
                  }}
                >
                  {day}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {uniqueDayEvents.slice(0, 3).map((e) => {
                    const isPast = new Date(e.end_time) < new Date();
                    return (
                      <div
                        key={e.id}
                        style={{
                          fontSize: 11,
                          padding: "4px 6px",
                          background: isPast ? "#9e9e9e" : "#1a472a",
                          color: "white",
                          borderRadius: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          opacity: isPast ? 0.7 : 1,
                        }}
                        title={e.title}
                      >
                        {e.title}
                      </div>
                    );
                  })}
                  {uniqueDayEvents.length > 3 && (
                    <div style={{ fontSize: 11, opacity: 0.7, color: "#666" }}>
                      +{uniqueDayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal */}
      {showDayDetails && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowDayDetails(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                {selectedDayEvents.length > 0
                  ? new Date(selectedDayEvents[0].start_time).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "No Events"}
              </h2>
              <button
                onClick={() => setShowDayDetails(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#666",
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: "#666", textAlign: "center", padding: 20 }}>
                No hunts scheduled for this day.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {selectedDayEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isPast = new Date(event.end_time) < new Date();

  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        overflow: "hidden",
        opacity: isPast ? 0.8 : 1,
      }}
    >
      <div
        style={{
          padding: 16,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h3 style={{ fontWeight: 600, fontSize: 18, margin: 0 }}>{event.title}</h3>
            <StatusBadge status={event.status} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "#666", fontSize: 14 }}>
            <span>📅 {formatDateRange(event.start_time, event.end_time)}</span>
            {event.species && <span>🦌 {event.species}</span>}
            {event.unit && <span>📍 Unit {event.unit}</span>}
            {event.weapon && <span>🎯 {event.weapon}</span>}
          </div>
        </div>
        <span style={{ fontSize: 20, color: "#999" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: "1px solid #eee",
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <DetailItem label="Start Date" value={formatDate(event.start_time)} />
            <DetailItem label="End Date" value={formatDate(event.end_time)} />
            {event.camp_name && <DetailItem label="Camp" value={event.camp_name} />}
            {event.guide_username && <DetailItem label="Guide" value={event.guide_username} />}
            {event.species && <DetailItem label="Species" value={event.species} />}
            {event.unit && <DetailItem label="Unit" value={event.unit} />}
            {event.weapon && <DetailItem label="Weapon" value={event.weapon} />}
          </div>
          {event.notes && (
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14, color: "#333" }}>Notes:</strong>
              <p style={{ marginTop: 4, color: "#666", fontSize: 14 }}>{event.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const config = getStatusConfig(status);
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 16,
        fontSize: 12,
        fontWeight: 500,
        background: config.bg,
        color: config.color,
      }}
    >
      {config.label}
    </span>
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

function formatDateRange(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const yearOptions: Intl.DateTimeFormatOptions = { ...options, year: "numeric" };
    
    if (startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", yearOptions)}`;
    }
    return `${startDate.toLocaleDateString("en-US", yearOptions)} - ${endDate.toLocaleDateString("en-US", yearOptions)}`;
  } catch {
    return `${start} - ${end}`;
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getStatusConfig(status?: string): { label: string; bg: string; color: string } {
  switch (status?.toLowerCase()) {
    case "booked":
      return { label: "Booked", bg: "#e8f5e9", color: "#2e7d32" };
    case "pending":
      return { label: "Pending", bg: "#fff3e0", color: "#e65100" };
    case "completed":
      return { label: "Completed", bg: "#e3f2fd", color: "#1565c0" };
    case "cancelled":
      return { label: "Cancelled", bg: "#ffebee", color: "#c62828" };
    case "inquiry":
    default:
      return { label: status || "Inquiry", bg: "#f5f5f5", color: "#666" };
  }
}
