"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Client {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  source?: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadClients();
  }, [search]);

  async function loadClients() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.set("search", search);
      }
      const res = await fetch(`/api/clients?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load clients");
      }
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function getClientName(client: Client): string {
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return client.email;
  }

  function getClientDisplay(client: Client): string {
    const name = getClientName(client);
    if (name === client.email) {
      return client.email;
    }
    return `${name} (${client.email})`;
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Clients</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Search and manage client information, contracts, and hunt history.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Search bar */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontSize: 16,
          }}
        />
      </div>

      {loading ? (
        <p>Loading clients...</p>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#666" }}>
          <p>No clients found.</p>
          {search && (
            <p style={{ fontSize: 14, marginTop: 8 }}>
              Try a different search term or clear the search to see all clients.
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Name</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Email</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Phone</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Location</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f9f9f9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                  }}
                >
                  <td style={{ padding: 12 }}>
                    <strong>{getClientName(client)}</strong>
                  </td>
                  <td style={{ padding: 12 }}>{client.email}</td>
                  <td style={{ padding: 12 }}>
                    {client.phone || <span style={{ color: "#999" }}>—</span>}
                  </td>
                  <td style={{ padding: 12 }}>
                    {client.city || client.state ? (
                      `${client.city || ""}${client.city && client.state ? ", " : ""}${client.state || ""}`
                    ) : (
                      <span style={{ color: "#999" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    <Link
                      href={`/clients/${encodeURIComponent(client.email)}`}
                      style={{
                        padding: "6px 12px",
                        background: "#0070f3",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: 6,
                        fontSize: 14,
                        display: "inline-block",
                      }}
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
