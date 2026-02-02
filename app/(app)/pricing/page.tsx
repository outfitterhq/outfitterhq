"use client";

import { useState, useEffect } from "react";
import type { PricingItem, AddonType } from "@/lib/types/pricing";

const SPECIES_OPTIONS = ["Elk", "Deer", "Mule Deer", "Coues Deer", "Antelope", "Oryx", "Ibex", "Barbary Sheep", "Aoudad", "Bighorn Sheep"];
const WEAPON_OPTIONS = ["Rifle", "Archery", "Muzzleloader"];

const CATEGORY_OPTIONS = ["General", "Add-ons"];

const ADDON_TYPE_OPTIONS: { value: AddonType; label: string }[] = [
  { value: "extra_days", label: "Extra days" },
  { value: "non_hunter", label: "Non-hunter" },
  { value: "spotter", label: "Spotter" },
  { value: null, label: "Other (custom)" },
];

export default function PricingPage() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<PricingItem | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pricing");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load pricing");
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this pricing item?")) return;
    try {
      const res = await fetch(`/api/pricing/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await loadItems();
    } catch (e: any) {
      alert("Error: " + String(e));
    }
  }

  // Group by category; show Add-ons last (under guide fees)
  const ADDONS_CATEGORY = "Add-ons";
  const byCategory = new Map<string, PricingItem[]>();
  items.forEach((item) => {
    const cat = item.category || "General";
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(item);
  });
  const categoryEntries = Array.from(byCategory.entries()).sort(([a], [b]) => {
    if (a === ADDONS_CATEGORY) return 1;
    if (b === ADDONS_CATEGORY) return -1;
    return a.localeCompare(b);
  });
  // Always show Add-ons section (with empty state when no items)
  const hasAddonsSection = categoryEntries.some(([c]) => c === ADDONS_CATEGORY);
  if (!hasAddonsSection) {
    categoryEntries.push([ADDONS_CATEGORY, []]);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Guide fees</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Manage guide fee packages (species, weapon, days). Tag prices are set on Tags for Sale—this page is for the guided hunt fee clients choose after they buy a tag.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setShowEditor(true);
          }}
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
          + New guide fee
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {showEditor && (
        <ItemEditor
          item={editingItem}
          onClose={() => {
            setShowEditor(false);
            setEditingItem(null);
          }}
          onSave={async () => {
            await loadItems();
            setShowEditor(false);
            setEditingItem(null);
          }}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {categoryEntries.map(([category, categoryItems]) => (
            <section key={category} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
              <h2 style={{ marginTop: 0, marginBottom: category === ADDONS_CATEGORY ? 8 : 16 }}>
                {category}
              </h2>
              {category === ADDONS_CATEGORY && (
                <p style={{ marginBottom: 16, fontSize: 14, opacity: 0.8 }}>
                  Optional add-ons to the guide fee (e.g. extra days, non-hunters). Clients can add these when completing their hunt contract.
                </p>
              )}
              {category === ADDONS_CATEGORY && categoryItems.length === 0 ? (
                <p style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, color: "#666" }}>
                  No add-ons yet. Click <strong>+ New guide fee</strong> above and set <strong>Category</strong> to &quot;Add-ons&quot; to add items like &quot;Additional Day(s)&quot; (per day) and &quot;Non-Hunter&quot; (per person).
                </p>
              ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "12px 8px" }}>Title</th>
                      <th style={{ padding: "12px 8px" }}>Description</th>
                      <th style={{ padding: "12px 8px", textAlign: "right" }}>Guide fee</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>Days</th>
                      <th style={{ padding: "12px 8px" }}>Species</th>
                      <th style={{ padding: "12px 8px" }}>Weapons</th>
                      <th style={{ padding: "12px 8px", width: 120 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "12px 8px" }}>{item.title}</td>
                        <td style={{ padding: "12px 8px", maxWidth: 280 }}>{item.description || "—"}</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>${item.amount_usd.toFixed(2)}</td>
                        <td style={{ padding: "12px 8px", textAlign: "center" }}>{item.included_days != null ? item.included_days : "—"}</td>
                        <td style={{ padding: "12px 8px", maxWidth: 140 }}>{item.species ? item.species.replace(/,/g, ", ") : "All"}</td>
                        <td style={{ padding: "12px 8px", maxWidth: 120 }}>{item.weapons ? item.weapons.replace(/,/g, ", ") : "All"}</td>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setShowEditor(true);
                              }}
                              style={{
                                padding: "6px 12px",
                                background: "#f0f0f0",
                                border: "1px solid #ddd",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              style={{
                                padding: "6px 12px",
                                background: "#fee",
                                border: "1px solid #fcc",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </section>
          ))}
          {items.length === 0 && (
            <p style={{ textAlign: "center", opacity: 0.6, padding: 40 }}>No pricing items yet. Create one to get started.</p>
          )}
        </div>
      )}
    </main>
  );
}

function parseCsv(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function ItemEditor({
  item,
  onClose,
  onSave,
}: {
  item: PricingItem | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [amount, setAmount] = useState(item?.amount_usd?.toString() || "");
  const [category, setCategory] = useState(item?.category || "General");
  const [addonType, setAddonType] = useState<AddonType>(item?.addon_type ?? null);
  const [includedDays, setIncludedDays] = useState(item?.included_days != null ? String(item.included_days) : "");
  const [speciesSelected, setSpeciesSelected] = useState<Set<string>>(
    () => new Set(parseCsv(item?.species))
  );
  const [weaponsSelected, setWeaponsSelected] = useState<Set<string>>(
    () => new Set(parseCsv(item?.weapons))
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSpeciesSelected(new Set(parseCsv(item?.species)));
    setWeaponsSelected(new Set(parseCsv(item?.weapons)));
    setAddonType(item?.addon_type ?? null);
  }, [item?.id, item?.species, item?.weapons, item?.addon_type]);

  const toggleSpecies = (s: string) => {
    setSpeciesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };
  const toggleWeapon = (w: string) => {
    setWeaponsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  async function handleSave() {
    if (!title.trim() || !amount) {
      alert("Title and amount are required");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      alert("Amount must be a valid number");
      return;
    }

    setLoading(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        amount_usd: amountNum,
        category: category.trim() || "General",
        addon_type: (category.trim() || "").toLowerCase() === "add-ons" ? addonType : null,
        included_days: includedDays.trim() ? (parseInt(includedDays, 10) || null) : null,
        species: speciesSelected.size > 0 ? Array.from(speciesSelected).join(",") : null,
        weapons: weaponsSelected.size > 0 ? Array.from(weaponsSelected).join(",") : null,
      };

      const url = item ? `/api/pricing/${item.id}` : "/api/pricing";
      const method = item ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      onSave();
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 10000,
        paddingTop: 48,
        paddingBottom: 24,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: "90%",
          marginBottom: 24,
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{item ? "Edit Item" : "New Item"}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Category</label>
            <select
              value={category || "General"}
              onChange={(e) => setCategory(e.target.value || "General")}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {category && !CATEGORY_OPTIONS.includes(category) && (
                <option value={category}>{category} (current)</option>
              )}
            </select>
            <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Use <strong>Add-ons</strong> for extra days, non-hunter, spotter, etc. Those appear in a separate &quot;Add-ons&quot; section under guide fees for clients.
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Add-on type {category?.toLowerCase() !== "add-ons" && "(only used when Category is Add-ons)"}
            </label>
            <select
              value={addonType ?? ""}
              onChange={(e) => setAddonType((e.target.value || null) as AddonType)}
              disabled={(category || "").toLowerCase() !== "add-ons"}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ddd",
                borderRadius: 6,
                ...((category || "").toLowerCase() !== "add-ons" ? { opacity: 0.7, cursor: "not-allowed" } : {}),
              }}
            >
              {ADDON_TYPE_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              When Category is <strong>Add-ons</strong>, choose: <strong>Extra days</strong>, <strong>Non-hunter</strong>, <strong>Spotter</strong>, or Other.
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Amount (USD) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Included days (optional)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={includedDays}
              onChange={(e) => setIncludedDays(e.target.value)}
              placeholder="e.g. 5 for 5-day guided hunt"
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
            <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Number of hunt days included (guided hunts typically 3–7). Leave blank to match any length. Used for auto-picking bill on contracts.</p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Species (optional)</label>
            <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 8 }}>Leave all unchecked to apply to any species. Otherwise only hunts with these species will use this price.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
              {SPECIES_OPTIONS.map((s) => (
                <label key={s} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={speciesSelected.has(s)}
                    onChange={() => toggleSpecies(s)}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Weapons (optional)</label>
            <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 8 }}>Leave all unchecked to apply to any weapon. Otherwise only hunts with these weapon types will use this price.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
              {WEAPON_OPTIONS.map((w) => (
                <label key={w} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={weaponsSelected.has(w)}
                    onChange={() => toggleWeapon(w)}
                  />
                  <span>{w}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6, minHeight: 80 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading || !title.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
