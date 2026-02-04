"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Assignment {
  id: string;
  title: string;
  start_time?: string;
  end_time?: string;
  camp_name?: string;
  client_email?: string;
  species?: string;
  notes?: string;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function CookDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tenant/current");
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.needs_selection || !data.outfitter_id) {
          router.push("/select-outfitter");
          return;
        }
        
        // Load assignments
        const assignmentsRes = await fetch("/api/cook/assignments");
        if (assignmentsRes.ok) {
          const assignmentsData = await assignmentsRes.json();
          setAssignments(assignmentsData.assignments || []);
        }
      } catch (e) {
        console.error("Error loading data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const eventsByDate = new Map<string, Assignment[]>();
  assignments.forEach((a) => {
    const start = a.start_time;
    if (!start) return;
    
    const startDate = new Date(start);
    const endDate = a.end_time ? new Date(a.end_time) : startDate;
    
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    const endDateLocal = new Date(endDate);
    endDateLocal.setHours(23, 59, 59, 999);
    
    while (currentDate <= endDateLocal) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;
      
      if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, []);
      if (!eventsByDate.get(dateKey)!.some(existing => existing.id === a.id)) {
        eventsByDate.get(dateKey)!.push(a);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  function changeMonth(delta: number) {
    setSelectedDate(new Date(year, month + delta, 1));
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1200, margin: "50px auto", padding: 20 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 32, fontWeight: 700 }}>Cook Dashboard</h1>
        <p style={{ margin: 0, color: "#666", fontSize: 16 }}>
          View your camp assignments and meal schedules
        </p>
      </div>

      {assignments.length > 0 && (
        <div style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
          {assignments.length} assignment{assignments.length !== 1 ? "s" : ""} assigned
        </div>
      )}

      {assignments.length === 0 ? (
        <div style={{ marginTop: 24, padding: 32, background: "white", border: "1px solid #ddd", borderRadius: 12, textAlign: "center" }}>
          <p style={{ fontSize: 18, margin: "0 0 8px 0", fontWeight: 600 }}>No assignments yet</p>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
            You don&apos;t have any camp assignments yet. An admin will assign you to camps when needed.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 24, border: "1px solid #ddd", borderRadius: 12, overflow: "hidden", background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 20,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
            }}
          >
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              style={{ 
                padding: "10px 20px", 
                border: "none", 
                background: "rgba(255,255,255,0.2)", 
                color: "white",
                borderRadius: 8, 
                cursor: "pointer",
                fontWeight: 600,
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            >
              ← Prev
            </button>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              style={{ 
                padding: "10px 20px", 
                border: "none", 
                background: "rgba(255,255,255,0.2)", 
                color: "white",
                borderRadius: 8, 
                cursor: "pointer",
                fontWeight: 600,
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
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
                  background: "#f8f9fa",
                  borderBottom: "1px solid #e9ecef",
                  borderRight: "1px solid #e9ecef",
                  fontSize: 14,
                  color: "#495057",
                }}
              >
                {day}
              </div>
            ))}

            {Array.from({ length: startWeekday }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  minHeight: 120,
                  borderRight: "1px solid #e9ecef",
                  borderBottom: "1px solid #e9ecef",
                  background: "#f8f9fa",
                }}
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayAssignments = eventsByDate.get(dateKey) || [];
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={day}
                  style={{
                    minHeight: 120,
                    padding: 8,
                    borderRight: "1px solid #e9ecef",
                    borderBottom: "1px solid #e9ecef",
                    background: isToday ? "#fff3cd" : "white",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      fontWeight: isToday ? 700 : 600,
                      marginBottom: 4,
                      color: isToday ? "#856404" : "#495057",
                      fontSize: 14,
                    }}
                  >
                    {day}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dayAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        style={{
                          padding: "4px 8px",
                          background: "#667eea",
                          color: "white",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: "pointer",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={`${assignment.title}${assignment.camp_name ? ` - ${assignment.camp_name}` : ""}`}
                      >
                        {assignment.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Assignments List */}
      {assignments.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Upcoming Assignments</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {assignments
              .filter(a => a.start_time && new Date(a.start_time) >= new Date())
              .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
              .slice(0, 5)
              .map((assignment) => (
                <div
                  key={assignment.id}
                  style={{
                    padding: 16,
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#333" }}>
                      {assignment.title}
                    </h3>
                    {assignment.start_time && (
                      <div style={{ fontSize: 14, color: "#666", whiteSpace: "nowrap", marginLeft: 16 }}>
                        {new Date(assignment.start_time).toLocaleDateString()}
                        {assignment.end_time && assignment.end_time !== assignment.start_time && (
                          <> - {new Date(assignment.end_time).toLocaleDateString()}</>
                        )}
                      </div>
                    )}
                  </div>
                  {assignment.camp_name && (
                    <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                      <strong>Camp:</strong> {assignment.camp_name}
                    </div>
                  )}
                  {assignment.species && (
                    <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                      <strong>Species:</strong> {assignment.species}
                    </div>
                  )}
                  {assignment.notes && (
                    <div style={{ fontSize: 14, color: "#666", marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee" }}>
                      {assignment.notes}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </main>
  );
}
