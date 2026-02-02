"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
}

export default function NotificationBell({ userRole }: { userRole: "admin" | "client" }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications?unread_only=true&limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
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
    markAsRead(notification.id);
    if (notification.action_url) {
      router.push(notification.action_url);
      setShowDropdown(false);
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

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: "relative",
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "#ef4444",
              color: "white",
              borderRadius: "50%",
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 8,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              minWidth: 320,
              maxWidth: 400,
              maxHeight: 500,
              overflow: "auto",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    padding: "4px 8px",
                    background: "transparent",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
                No new notifications
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #eee",
                      cursor: notification.action_url ? "pointer" : "default",
                      background: notification.is_read ? "white" : "#f0f9ff",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!notification.is_read) {
                        e.currentTarget.style.background = "#e0f2fe";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!notification.is_read) {
                        e.currentTarget.style.background = "#f0f9ff";
                      }
                    }}
                  >
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{getNotificationIcon(notification.notification_type)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 4 }}>
                          <strong style={{ fontSize: 14, fontWeight: 600 }}>{notification.title}</strong>
                          {!notification.is_read && (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: getPriorityColor(notification.priority),
                                display: "inline-block",
                              }}
                            />
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "#666", lineHeight: 1.4 }}>
                          {notification.message}
                        </p>
                        <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#999" }}>
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                padding: 12,
                borderTop: "1px solid #eee",
                textAlign: "center",
              }}
            >
              <Link
                href={userRole === "admin" ? "/notifications" : "/client/notifications"}
                style={{
                  fontSize: 13,
                  color: "#0070f3",
                  textDecoration: "none",
                }}
                onClick={() => setShowDropdown(false)}
              >
                View all notifications →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
