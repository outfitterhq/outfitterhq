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
    <div className="pro-page-container">
      <div className="pro-section-header" style={{ marginBottom: 32 }}>
        <h1 className="pro-section-title">Clients</h1>
        <p className="pro-section-subtitle">
          Search and manage client information, contracts, and hunt history.
        </p>
      </div>

      {error && (
        <div className="pro-alert pro-alert-error">
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
          className="pro-input"
        />
      </div>

      {loading ? (
        <div className="pro-loading">
          <div className="pro-spinner"></div>
          <span>Loading clients...</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="pro-empty-state">
          <div className="pro-empty-state-icon">👥</div>
          <h3 className="pro-empty-state-title">No clients found</h3>
          <p className="pro-empty-state-description">
            {search ? (
              <>Try a different search term or clear the search to see all clients.</>
            ) : (
              <>Get started by adding your first client or inviting them to create an account.</>
            )}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="pro-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <strong style={{ color: "var(--color-gray-900)" }}>{getClientName(client)}</strong>
                  </td>
                  <td style={{ color: "var(--color-gray-600)" }}>{client.email}</td>
                  <td>
                    {client.phone || <span style={{ color: "var(--color-gray-400)" }}>—</span>}
                  </td>
                  <td style={{ color: "var(--color-gray-600)" }}>
                    {client.city || client.state ? (
                      `${client.city || ""}${client.city && client.state ? ", " : ""}${client.state || ""}`
                    ) : (
                      <span style={{ color: "var(--color-gray-400)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/clients/${encodeURIComponent(client.email)}`}
                      className="pro-button pro-button-primary"
                      style={{ fontSize: 13, padding: "6px 14px" }}
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
    </div>
  );
}
