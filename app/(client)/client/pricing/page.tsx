"use client";

import { useState, useEffect } from "react";

interface PricingItem {
  id: string;
  title: string;
  description?: string | null;
  amount_usd: number;
  category: string;
  species?: string | null;
  weapons?: string | null;
  included_days?: number | null;
  addon_type?: string | null;
}

const ADDONS_CATEGORY = "Add-ons";

export default function ClientPricingPage() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    try {
      const res = await fetch("/api/client/pricing");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load pricing");
      }
      const data = await res.json();
      const items = data.items || [];
      setItems(items);
      console.log("Pricing loaded - FULL DATA:", {
        count: items.length,
        items: items.map((i: any) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          amount_usd: i.amount_usd,
          category: i.category,
          species: i.species,
          weapons: i.weapons,
          included_days: i.included_days,
          addon_type: i.addon_type,
          fullItem: i,
        })),
      });
    } catch (e: any) {
      setError(String(e));
      console.error("Pricing error:", e);
    } finally {
      setLoading(false);
    }
  }

  // Group by category (same as admin)
  const categoryMap = items.reduce<Record<string, PricingItem[]>>((acc, item) => {
    const cat = item.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryEntries = Object.entries(categoryMap).sort(([a], [b]) => {
    // Put Add-ons last
    if (a === ADDONS_CATEGORY) return 1;
    if (b === ADDONS_CATEGORY) return -1;
    return a.localeCompare(b);
  });

  // Debug logging
  console.log("🔍 Pricing Page Render:", {
    loading,
    error,
    itemsCount: items.length,
    categoryEntriesCount: categoryEntries.length,
    categoryEntries: categoryEntries.map(([cat, items]) => [cat, items.length]),
    items: items.map(i => ({ id: i.id, title: i.title, category: i.category })),
  });

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading pricing...</p>
      </div>
    );
  }

  return (
    <div>
      {/* SUPER VISIBLE TEST - RED BOX AT TOP */}
      <div style={{ 
        background: "#ff0000", 
        color: "white", 
        padding: "20px", 
        marginBottom: "20px",
        fontWeight: 700,
        fontSize: "18px",
        textAlign: "center",
        border: "5px solid #000",
        position: "sticky",
        top: 0,
        zIndex: 9999
      }}>
        🚨 IF YOU SEE THIS RED BOX, NEW CODE IS DEPLOYED! 🚨
        <div style={{ fontSize: "14px", marginTop: "8px", opacity: 0.9 }}>
          Version: 2.0 - Table Layout Active - {new Date().toLocaleTimeString()}
        </div>
      </div>
      
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Pricing</h1>
        <p style={{ color: "#666" }}>
          View pricing for hunts and services. Contact your outfitter for custom quotes or package deals.
        </p>
        {/* DEBUG INFO - Remove in production */}
        <div style={{ 
          background: "#f0f0f0", 
          padding: 12, 
          borderRadius: 6, 
          marginTop: 12, 
          fontSize: 12,
          fontFamily: "monospace"
        }}>
          <strong>Debug:</strong> {items.length} items loaded, {categoryEntries.length} categories
          {items.length > 0 && (
            <div style={{ marginTop: 8 }}>
              Categories: {categoryEntries.map(([cat]) => cat).join(", ")}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {categoryEntries.length === 0 ? (
        <div style={{ 
          background: "#fff3cd", 
          border: "1px solid #ffc107", 
          borderRadius: 8, 
          padding: 24,
          textAlign: "center"
        }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>No pricing items yet.</p>
          <p style={{ margin: "8px 0 0 0", fontSize: 14, color: "#666" }}>
            Your outfitter will add pricing details here.
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#999" }}>
            Debug: API returned {items.length} items. Check browser console for details.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {categoryEntries.map(([category, categoryItems]) => (
            <section key={category} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
              <h2 style={{ marginTop: 0, marginBottom: category === ADDONS_CATEGORY ? 8 : 16 }}>
                {category}
              </h2>
              {category === ADDONS_CATEGORY && (
                <div style={{ 
                  background: "#fff3cd", 
                  border: "1px solid #ffc107", 
                  borderRadius: 8, 
                  padding: 12, 
                  marginBottom: 16 
                }}>
                  <p style={{ fontSize: 14, color: "#856404", margin: 0, fontWeight: 600 }}>
                    ⚠️ Note: Add-on prices are <strong>per item</strong> (per day, per person, etc.), not a total hunt price.
                  </p>
                  <p style={{ fontSize: 13, color: "#856404", margin: "8px 0 0 0" }}>
                    For example: "Extra Day" at $500 means $500 <strong>per additional day</strong>. "Non-Hunter" at $200 means $200 <strong>per non-hunting companion</strong>.
                  </p>
                </div>
              )}
              {category === ADDONS_CATEGORY && categoryItems.length === 0 ? (
                <p style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, color: "#666" }}>
                  No add-ons available yet.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table 
                    style={{ 
                      width: "100%", 
                      borderCollapse: "collapse",
                      border: "2px solid #1a472a", // Make table visible for debugging
                      background: "white"
                    }}
                  >
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd", background: "#f5f5f5" }}>
                        <th style={{ padding: "12px 8px", fontWeight: 600 }}>Title</th>
                        <th style={{ padding: "12px 8px", fontWeight: 600 }}>Description</th>
                        <th style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>Guide fee</th>
                        <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: 600 }}>Days</th>
                        <th style={{ padding: "12px 8px", fontWeight: 600 }}>Species</th>
                        <th style={{ padding: "12px 8px", fontWeight: 600 }}>Weapons</th>
                        {category === ADDONS_CATEGORY && (
                          <th style={{ padding: "12px 8px", fontWeight: 600 }}>Price Type</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {categoryItems.length === 0 ? (
                        <tr>
                          <td colSpan={category === ADDONS_CATEGORY ? 7 : 6} style={{ padding: "24px", textAlign: "center", color: "#666" }}>
                            No items in this category
                          </td>
                        </tr>
                      ) : (
                        categoryItems.map((item) => (
                          <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                            <td style={{ padding: "12px 8px", border: "1px solid #f0f0f0" }}>{item.title || "—"}</td>
                            <td style={{ padding: "12px 8px", maxWidth: 280, border: "1px solid #f0f0f0" }}>{item.description || "—"}</td>
                            <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600, border: "1px solid #f0f0f0" }}>
                              {item.amount_usd != null ? `$${item.amount_usd.toFixed(2)}` : "—"}
                              {category === ADDONS_CATEGORY && item.amount_usd != null && (
                                <div style={{ fontSize: 11, color: "#888", marginTop: 2, fontWeight: 400 }}>
                                  per {item.addon_type === "extra_days" ? "day" : item.addon_type === "non_hunter" || item.addon_type === "spotter" ? "person" : "item"}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "center", border: "1px solid #f0f0f0" }}>{item.included_days != null ? item.included_days : "—"}</td>
                            <td style={{ padding: "12px 8px", maxWidth: 140, border: "1px solid #f0f0f0" }}>{item.species ? item.species.replace(/,/g, ", ") : "All"}</td>
                            <td style={{ padding: "12px 8px", maxWidth: 120, border: "1px solid #f0f0f0" }}>{item.weapons ? item.weapons.replace(/,/g, ", ") : "All"}</td>
                            {category === ADDONS_CATEGORY && (
                              <td style={{ padding: "12px 8px", border: "1px solid #f0f0f0" }}>
                                {item.addon_type ? item.addon_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "—"}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#f0f7f4",
          borderRadius: 8,
          border: "1px solid #c8e6c9",
        }}
      >
        <p style={{ color: "#555", fontSize: 14 }}>
          <strong>Note:</strong> Pricing may vary based on hunt specifics, season, and package
          options. Contact your outfitter for accurate quotes and availability.
        </p>
      </div>
    </div>
  );
}
