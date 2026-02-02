"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  action_url?: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  related_id?: string;
  related_type?: string;
  metadata?: any;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("unread");

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const unreadOnly = filter === "unread";
      const res = await fetch(`/api/notifications?unread_only=${unreadOnly}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error("Failed to load notifications", e);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
      });
      await loadNotifications();
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications/read-all", {
        method: "PUT",
      });
      await loadNotifications();
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case "urgent":
        return "#ef4444";
      case "high":
        return "#f59e0b";
      case "normal":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  }

  function getNotificationIcon(type: string): string {
    switch (type) {
      case "contract_pending_review":
        return "📋";
      case "contract_approved":
      case "contract_rejected":
        return "📄";
      case "time_off_pending":
        return "⏰";
      case "hunt_closeout_required":
        return "🏁";
      case "payment_due":
        return "💳";
      case "hunt_upcoming":
        return "📅";
      default:
        return "🔔";
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Notifications</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Stay updated on pending actions and important updates</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
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
              Mark All Read
            </button>
          )}
          <Link
            href="/dashboard"
            style={{
              padding: "10px 20px",
              background: "#f5f5f5",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter("unread")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "unread" ? "#0070f3" : "white",
            color: filter === "unread" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            background: filter === "all" ? "#0070f3" : "white",
            color: filter === "all" ? "white" : "#333",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          All
        </button>
      </div>

      {loading ? (
        <p>Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "#f9f9f9", borderRadius: 8 }}>
          <p style={{ fontSize: 18, margin: 0, opacity: 0.7 }}>
            {filter === "unread" ? "✅ No unread notifications" : "No notifications"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                background: notification.is_read ? "white" : "#f0f9ff",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                cursor: notification.action_url ? "pointer" : "default",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0070f3";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#ddd";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ fontSize: 32 }}>{getNotificationIcon(notification.notification_type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: getPriorityColor(notification.priority),
                            marginLeft: 8,
                          }}
                        />
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "#999" }}>
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "#666", lineHeight: 1.5 }}>
                    {notification.message}
                  </p>
                  {notification.action_url && (
                    <Link
                      href={notification.action_url}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        fontSize: 13,
                        color: "#0070f3",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      Take action →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
