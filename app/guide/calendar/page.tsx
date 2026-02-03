"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Hunt {
  id: string;
  title: string;
  start_time?: string;
  end_time?: string;
  species?: string;
  unit?: string;
  client_email?: string;
  camp_name?: string;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function GuideCalendarPage() {
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/guide/hunts");
        if (res.ok) {
          const data = await res.json();
          console.log("[Guide Calendar] Loaded hunts:", data.hunts?.length || 0, data.hunts);
          setHunts(data.hunts || []);
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error("[Guide Calendar] Failed to load hunts:", res.status, errorData);
          setHunts([]);
        }
      } catch (e) {
        console.error("[Guide Calendar] Error loading hunts:", e);
        setHunts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const eventsByDate = new Map<string, Hunt[]>();
  hunts.forEach((h) => {
    const start = h.start_time;
    if (!start) {
      console.warn("[Guide Calendar] Hunt missing start_time:", h.id, h.title);
      return;
    }
    
    // Get start and end dates (parse as UTC, then convert to local date for matching)
    const startDate = new Date(start);
    const endDate = h.end_time ? new Date(h.end_time) : startDate;
    
    // Add hunt to all dates it spans
    // Use local date (not UTC) for matching calendar days
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0); // Reset to start of day in local timezone
    
    const endDateLocal = new Date(endDate);
    endDateLocal.setHours(23, 59, 59, 999); // End of day in local timezone
    
    while (currentDate <= endDateLocal) {
      // Create dateKey using local date (YYYY-MM-DD format)
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;
      
      if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, []);
      // Only add if not already in the array (avoid duplicates)
      if (!eventsByDate.get(dateKey)!.some(existing => existing.id === h.id)) {
        eventsByDate.get(dateKey)!.push(h);
      }
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  console.log("[Guide Calendar] Total hunts loaded:", hunts.length);
  console.log("[Guide Calendar] Events by date (first 10):", Array.from(eventsByDate.entries()).slice(0, 10));
  console.log("[Guide Calendar] Current month:", `${MONTH_NAMES[month]} ${year}`);
  console.log("[Guide Calendar] Sample hunt dates:", hunts.slice(0, 3).map(h => ({
    id: h.id,
    title: h.title,
    start_time: h.start_time,
    end_time: h.end_time,
    startDate: h.start_time ? new Date(h.start_time).toLocaleDateString() : null,
    endDate: h.end_time ? new Date(h.end_time).toLocaleDateString() : null,
  })));

  function changeMonth(delta: number) {
    setSelectedDate(new Date(year, month + delta, 1));
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 28, fontWeight: 700 }}>Calendar</h1>
      <p style={{ margin: 0, color: "#666" }}>Your assigned hunts by date</p>

      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link
            href="/guide/schedule"
            style={{ color: "#059669", fontWeight: 600, fontSize: 14 }}
          >
            List view
          </Link>
          <span style={{ color: "#ccc" }}>|</span>
          <Link
            href="/guide/packets"
            style={{ color: "#059669", fontWeight: 600, fontSize: 14 }}
          >
            Hunt Packets
          </Link>
        </div>
        {hunts.length > 0 && (
          <div style={{ fontSize: 12, color: "#666" }}>
            {hunts.length} hunt{hunts.length !== 1 ? "s" : ""} assigned
          </div>
        )}
      </div>
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === "development" && hunts.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: "#f0f0f0", borderRadius: 8, fontSize: 12 }}>
          <strong>Debug Info:</strong>
          <div style={{ marginTop: 4 }}>
            Hunts loaded: {hunts.length} | Events mapped: {eventsByDate.size} dates
          </div>
          {hunts.slice(0, 3).map(h => (
            <div key={h.id} style={{ marginTop: 4, fontSize: 11 }}>
              {h.title}: {h.start_time ? new Date(h.start_time).toLocaleDateString() : "no start"} - {h.end_time ? new Date(h.end_time).toLocaleDateString() : "no end"}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ marginTop: 24 }}>Loading calendar…</p>
      ) : hunts.length === 0 ? (
        <div style={{ marginTop: 24, padding: 24, background: "white", border: "1px solid #ddd", borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 16, margin: "0 0 8px 0", fontWeight: 600 }}>No hunts assigned</p>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
            You don't have any hunts assigned yet. Check back later or contact your outfitter.
          </p>
          <p style={{ fontSize: 12, color: "#999", marginTop: 8, fontStyle: "italic" }}>
            Debug: API returned {hunts.length} hunts. Check browser console for details.
          </p>
          <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            Make sure hunts are assigned to you in the admin calendar (set guide_username field).
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 24, border: "1px solid #ddd", borderRadius: 12, overflow: "hidden", background: "white" }}>
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
              type="button"
              onClick={() => changeMonth(-1)}
              style={{ padding: "8px 16px", border: "1px solid #ddd", background: "white", borderRadius: 6, cursor: "pointer" }}
            >
              ← Prev
            </button>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              style={{ padding: "8px 16px", border: "1px solid #ddd", background: "white", borderRadius: 6, cursor: "pointer" }}
            >
              Next →
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                style={{
                  padding: 12,
                  textAlign: "center",
                  fontWeight: 600,
                  background: "#f9f9f9",
                  borderBottom: "1px solid #eee",
                  borderRight: "1px solid #eee",
                  fontSize: 14,
                }}
              >
                {day}
              </div>
            ))}

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

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              // Create dateKey using local date (YYYY-MM-DD format) to match eventsByDate
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayHunts = eventsByDate.get(dateKey) || [];
              const isToday = date.toDateString() === new Date().toDateString();
              
              // Debug first day of month
              if (i === 0 && hunts.length > 0) {
                console.log(`[Guide Calendar] First day (${dateKey}):`, {
                  dateKey,
                  dayHunts: dayHunts.length,
                  availableKeys: Array.from(eventsByDate.keys()).slice(0, 5),
                });
              }

              return (
                <div
                  key={day}
                  style={{
                    minHeight: 100,
                    padding: 8,
                    borderRight: "1px solid #eee",
                    borderBottom: "1px solid #eee",
                    background: isToday ? "#e0f2fe" : "white",
                  }}
                >
                  <div style={{ fontWeight: isToday ? 700 : 500, marginBottom: 4, color: isToday ? "#0369a1" : "inherit" }}>
                    {day}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dayHunts.slice(0, 3).map((hunt) => (
                      <Link
                        key={hunt.id}
                        href={`/guide/packet/${hunt.id}`}
                        style={{
                          fontSize: 11,
                          padding: "4px 6px",
                          background: "#059669",
                          color: "white",
                          borderRadius: 4,
                          textDecoration: "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={hunt.title}
                      >
                        {hunt.title}
                      </Link>
                    ))}
                    {dayHunts.length > 3 && (
                      <div style={{ fontSize: 11, color: "#666" }}>+{dayHunts.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
