"use client";

export default function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.3)",
        color: "white",
        padding: "6px 12px",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      Log Out
    </button>
  );
}
