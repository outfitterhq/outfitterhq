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
          setHunts(data.hunts || []);
        }
      } catch {
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
    if (!start) return;
    const dateKey = new Date(start).toISOString().split("T")[0];
    if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, []);
    eventsByDate.get(dateKey)!.push(h);
  });

  function changeMonth(delta: number) {
    setSelectedDate(new Date(year, month + delta, 1));
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 28, fontWeight: 700 }}>Calendar</h1>
      <p style={{ margin: 0, color: "#666" }}>Your assigned hunts by date</p>

      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
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

      {loading ? (
        <p style={{ marginTop: 24 }}>Loading calendar…</p>
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
              const dateKey = date.toISOString().split("T")[0];
              const dayHunts = eventsByDate.get(dateKey) || [];
              const isToday = date.toDateString() === new Date().toDateString();

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
