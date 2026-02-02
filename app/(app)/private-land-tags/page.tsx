"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { PrivateLandTag, TagSpecies, TagType } from "@/lib/types/private-tags";
import { SPECIES_OPTIONS, WEAPON_OPTIONS } from "@/lib/types/private-tags";
import type { HuntCodeOption } from "@/lib/hunt-codes";
import { filterHuntCodesBySpeciesAndWeapon, weaponDigitToTagType } from "@/lib/hunt-codes";

const TAG_TYPE_OPTIONS: { value: TagType; label: string }[] = [
  { value: "private_land", label: "Private Land" },
  { value: "unit_wide", label: "Unit Wide" },
];

export default function TagsForSalePage() {
  const [tags, setTags] = useState<PrivateLandTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTag, setEditingTag] = useState<PrivateLandTag | null>(null);
  const [filterSpecies, setFilterSpecies] = useState<string>("all");

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/private-tags?include_hunts=1");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load tags");
      }
      const data = await res.json();
      setTags(data.tags || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTag(id: string) {
    if (!confirm("Delete this tag?")) return;
    try {
      const res = await fetch(`/api/private-tags/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await loadTags();
    } catch (e: any) {
      alert("Error: " + String(e));
    }
  }

  const filteredTags =
    filterSpecies === "all"
      ? tags
      : tags.filter((t) => t.species === filterSpecies);

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Tags for Sale</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Manage tags for sale (Private Land or Unit Wide). Add new tags with the button below.</p>
        </div>
        <button
          onClick={() => {
            setEditingTag(null);
            setShowEditor(true);
          }}
          style={{
            padding: "12px 24px",
            background: "#1a472a",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          ＋ Add tag for sale
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {/* Purchased tags: quick link to open hunt & generate contract (tag-for-sale flow, not draw) */}
      {tags.some((t) => !t.is_available && t.client_email) && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
            background: "#f0f7f4",
            border: "1px solid #1a472a",
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 700, color: "#1a472a" }}>
            Purchased tags – create event & contract
          </h2>
          <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#555" }}>
            When a client buys a tag, a hunt is created automatically. Open the hunt below to set hunt code/dates (for unit-wide) and generate the contract.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tags
              .filter((t) => !t.is_available && t.client_email)
              .map((tag) => (
                <div
                  key={tag.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    padding: 12,
                    background: "white",
                    borderRadius: 8,
                    border: "1px solid #c8e6c9",
                  }}
                >
                  <div>
                    <strong>{tag.tag_name}</strong> • {tag.species}
                    {tag.unit && ` • Unit ${tag.unit}`}
                    <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                      Sold to {tag.client_email}
                      {tag.hunt_status && (
                        <span style={{ marginLeft: 8 }}>
                          • Hunt status: {tag.hunt_status}
                        </span>
                      )}
                    </div>
                  </div>
                  {tag.hunt_id ? (
                    <Link
                      href={`/calendar?event=${tag.hunt_id}`}
                      style={{
                        padding: "10px 20px",
                        background: "#1a472a",
                        color: "white",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Open hunt & generate contract
                    </Link>
                  ) : (
                    <span style={{ fontSize: 13, color: "#999" }}>
                      Hunt not found (run migration 055 if needed)
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8, fontWeight: 600 }}>Filter by species:</label>
        <select
          value={filterSpecies}
          onChange={(e) => setFilterSpecies(e.target.value)}
          style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6 }}
        >
          <option value="all">All Species</option>
          {SPECIES_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {showEditor && (
        <TagEditor
          tag={editingTag}
          onClose={() => {
            setShowEditor(false);
            setEditingTag(null);
          }}
          onSave={async () => {
            await loadTags();
            setShowEditor(false);
            setEditingTag(null);
          }}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", borderRadius: 12 }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>Tag Name</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>Type</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>State</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>Species</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>Unit</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>Hunt Code</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd", textAlign: "right" }}>Tag price</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>Available</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd" }}>Sold to</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #ddd", width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag) => (
                <tr key={tag.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600 }}>{tag.tag_name}</td>
                  <td style={{ padding: "12px 8px" }}>
                    {tag.tag_type === "unit_wide" ? "Unit Wide" : "Private Land"}
                  </td>
                  <td style={{ padding: "12px 8px" }}>{tag.state}</td>
                  <td style={{ padding: "12px 8px" }}>{tag.species}</td>
                  <td style={{ padding: "12px 8px" }}>{tag.unit || "—"}</td>
                  <td style={{ padding: "12px 8px", maxWidth: 200 }}>
                    {tag.tag_type === "unit_wide"
                      ? (tag.hunt_code_options ? tag.hunt_code_options.replace(/,/g, ", ") : "—")
                      : (tag.hunt_code || "—")}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>
                    {tag.price ? `$${tag.price.toFixed(2)}` : "—"}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: tag.is_available ? "#d4edda" : "#f8d7da",
                        color: tag.is_available ? "#155724" : "#721c24",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {tag.is_available ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", fontSize: 13 }}>
                    {!tag.is_available && tag.client_email ? tag.client_email : "—"}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!tag.is_available && tag.hunt_id && (
                        <Link
                          href={`/calendar?event=${tag.hunt_id}`}
                          style={{
                            padding: "6px 12px",
                            background: "#1a472a",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          Open hunt & contract
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setEditingTag(tag);
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
                        onClick={() => deleteTag(tag.id)}
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
          {filteredTags.length === 0 && (
            <p style={{ textAlign: "center", opacity: 0.6, padding: 40 }}>
              No tags yet. Click <strong>Add tag for sale</strong> above to create your first tag. Set the tag price (what the client pays for the tag); guide fees are set on the Pricing page.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function TagEditor({
  tag,
  onClose,
  onSave,
}: {
  tag: PrivateLandTag | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [tagName, setTagName] = useState(tag?.tag_name || "");
  const [state, setState] = useState(tag?.state || "NM");
  const [species, setSpecies] = useState<TagSpecies>(tag?.species || "Elk");
  const [unit, setUnit] = useState(tag?.unit || "");
  const [tagType, setTagType] = useState<TagType>(tag?.tag_type || "private_land");
  const parseOptions = (s: string | null | undefined) => {
    if (!s?.trim()) return ["", "", ""];
    const parts = s.split(",").map((p) => p.trim()).slice(0, 3);
    return [parts[0] || "", parts[1] || "", parts[2] || ""];
  };
  const [weapon, setWeapon] = useState<"Rifle" | "Archery" | "Muzzleloader">(
    tag?.hunt_code ? (() => {
      const parts = tag.hunt_code.split("-");
      return weaponDigitToTagType(parts.length >= 2 ? parts[1] : "1");
    })() : "Rifle"
  );
  const [huntCode, setHuntCode] = useState(tag?.hunt_code || "");
  const [huntCodeOption1, setHuntCodeOption1] = useState(parseOptions(tag?.hunt_code_options)[0]);
  const [huntCodeOption2, setHuntCodeOption2] = useState(parseOptions(tag?.hunt_code_options)[1]);
  const [huntCodeOption3, setHuntCodeOption3] = useState(parseOptions(tag?.hunt_code_options)[2]);
  const [unitWidePickerSlot, setUnitWidePickerSlot] = useState<1 | 2 | 3 | null>(null);
  const unitWidePickerRef = useRef<HTMLDivElement>(null);
  const [price, setPrice] = useState(tag?.price?.toString() || "");
  const [isAvailable, setIsAvailable] = useState(tag?.is_available !== undefined ? tag.is_available : true);
  const [notes, setNotes] = useState(tag?.notes || "");
  const [loading, setLoading] = useState(false);
  const [huntCodeOptions, setHuntCodeOptions] = useState<HuntCodeOption[]>([]);
  const [huntCodePickerOpen, setHuntCodePickerOpen] = useState(false);
  const huntCodePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/hunt-codes")
      .then((r) => (r.ok ? r.json() : { codes: [] }))
      .then((data) => setHuntCodeOptions(data.codes || []))
      .catch(() => setHuntCodeOptions([]));
  }, []);

  useEffect(() => {
    if (tag?.hunt_code_options) {
      const opts = parseOptions(tag.hunt_code_options);
      setHuntCodeOption1(opts[0]);
      setHuntCodeOption2(opts[1]);
      setHuntCodeOption3(opts[2]);
    } else {
      setHuntCodeOption1("");
      setHuntCodeOption2("");
      setHuntCodeOption3("");
    }
  }, [tag?.id, tag?.hunt_code_options]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (huntCodePickerRef.current && !huntCodePickerRef.current.contains(e.target as Node)) {
        setHuntCodePickerOpen(false);
      }
      if (unitWidePickerRef.current && !unitWidePickerRef.current.contains(e.target as Node)) {
        setUnitWidePickerSlot(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const huntCodesForPicker = filterHuntCodesBySpeciesAndWeapon(huntCodeOptions, species, weapon);

  async function handleSave() {
    if (!tagName.trim()) {
      alert("Tag name is required");
      return;
    }
    if (tagType === "unit_wide") {
      const opts = [huntCodeOption1.trim(), huntCodeOption2.trim(), huntCodeOption3.trim()].filter(Boolean);
      if (opts.length === 0) {
        alert("Unit Wide tags need at least one hunt code option. Add all 3 so clients can choose.");
        return;
      }
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        tag_name: tagName.trim(),
        state: state.trim() || "NM",
        species,
        unit: unit.trim() || null,
        tag_type: tagType,
        price: price ? parseFloat(price) : null,
        is_available: isAvailable,
        notes: notes.trim() || null,
      };
      if (tagType === "unit_wide") {
        body.hunt_code_options = [huntCodeOption1.trim(), huntCodeOption2.trim(), huntCodeOption3.trim()]
          .filter(Boolean)
          .join(",");
      } else {
        body.hunt_code = huntCode.trim() || null;
      }

      const url = tag ? `/api/private-tags/${tag.id}` : "/api/private-tags";
      const method = tag ? "PUT" : "POST";

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
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "60px 16px 24px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 600,
          width: "100%",
          maxHeight: "calc(100vh - 84px)",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{tag ? "Edit Tag" : "New Tag"}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Tag Name *</label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="NM"
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Species *</label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value as TagSpecies)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              >
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Type</label>
              <select
                value={tagType}
                onChange={(e) => setTagType(e.target.value as TagType)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              >
                {TAG_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Private Land or Unit Wide</p>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Weapon</label>
              <select
                value={weapon}
                onChange={(e) => setWeapon(e.target.value as "Rifle" | "Archery" | "Muzzleloader")}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              >
                {WEAPON_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>1=any legal, 2=bow, 3=muzzleloader</p>
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="GMU or area"
            />
          </div>

          {tagType === "unit_wide" ? (
            <div ref={unitWidePickerRef} style={{ position: "relative" }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Hunt code options (3 choices for client)</label>
              <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 8 }}>
                Add up to 3 hunt codes. When the client purchases this tag, they will choose one; that code is used for the contract.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { value: huntCodeOption1, set: setHuntCodeOption1, slot: 1 as const, label: "Option 1" },
                  { value: huntCodeOption2, set: setHuntCodeOption2, slot: 2 as const, label: "Option 2" },
                  { value: huntCodeOption3, set: setHuntCodeOption3, slot: 3 as const, label: "Option 3" },
                ].map(({ value, set, slot, label }) => (
                  <div key={label} style={{ position: "relative" }}>
                    <label style={{ display: "block", marginBottom: 2, fontSize: 13, color: "#555" }}>{label}</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        onFocus={() => setUnitWidePickerSlot(slot)}
                        style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                        placeholder="e.g. ELK-1-294 or click Pick"
                      />
                      <button
                        type="button"
                        onClick={() => setUnitWidePickerSlot(unitWidePickerSlot === slot ? null : slot)}
                        style={{
                          padding: "8px 12px",
                          background: unitWidePickerSlot === slot ? "#1a472a" : "#eee",
                          color: unitWidePickerSlot === slot ? "white" : "#333",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Pick
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {unitWidePickerSlot !== null && huntCodeOptions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    maxHeight: 220,
                    overflowY: "auto",
                    background: "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 50,
                  }}
                >
                  {huntCodesForPicker.length === 0 ? (
                    <div style={{ padding: 12, color: "#666", fontSize: 13 }}>Select species and weapon above.</div>
                  ) : (
                    huntCodesForPicker.map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => {
                          if (unitWidePickerSlot === 1) setHuntCodeOption1(opt.code);
                          if (unitWidePickerSlot === 2) setHuntCodeOption2(opt.code);
                          if (unitWidePickerSlot === 3) setHuntCodeOption3(opt.code);
                          setUnitWidePickerSlot(null);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 12px",
                          textAlign: "left",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          fontSize: 13,
                          borderBottom: "1px solid #eee",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      >
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{opt.code}</span>
                        {opt.unit_description && (
                          <span style={{ color: "#666", marginLeft: 8, fontSize: 12 }}>— {opt.unit_description.slice(0, 50)}{opt.unit_description.length > 50 ? "…" : ""}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div ref={huntCodePickerRef} style={{ position: "relative" }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Hunt Code (optional)</label>
              <input
                type="text"
                value={huntCode}
                onChange={(e) => {
                  setHuntCode(e.target.value);
                  setHuntCodePickerOpen(true);
                }}
                onFocus={() => setHuntCodePickerOpen(true)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="Pick by species + weapon above"
              />
              {huntCodePickerOpen && huntCodeOptions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "100%",
                    marginTop: 2,
                    maxHeight: 260,
                    overflowY: "auto",
                    background: "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 50,
                  }}
                >
                  {huntCodesForPicker.length === 0 ? (
                    <div style={{ padding: 12, color: "#666", fontSize: 13 }}>
                      Select species and weapon above to see hunt codes.
                    </div>
                  ) : (
                    huntCodesForPicker
                      .filter((opt) => {
                        const q = huntCode.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          opt.code.toLowerCase().includes(q) ||
                          (opt.species && opt.species.toLowerCase().includes(q)) ||
                          (opt.unit_description && opt.unit_description.toLowerCase().includes(q))
                        );
                      })
                      .map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => {
                            setHuntCode(opt.code);
                            setWeapon(weaponDigitToTagType(opt.code.split("-")[1] || "1"));
                            setHuntCodePickerOpen(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "8px 12px",
                            textAlign: "left",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            fontSize: 13,
                            borderBottom: "1px solid #eee",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f0f7ff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "none";
                          }}
                        >
                          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{opt.code}</span>
                          {opt.unit_description && (
                            <span style={{ color: "#666", marginLeft: 8, fontSize: 12 }}>
                              — {opt.unit_description.slice(0, 45)}
                              {opt.unit_description.length > 45 ? "…" : ""}
                            </span>
                          )}
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Tag price (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 500"
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              />
              <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>What the client pays for the tag. Guide fees are set on the Pricing page.</p>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Available</label>
              <div style={{ paddingTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                  />
                  <span>Tag is available</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            disabled={loading || !tagName.trim()}
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading || !tagName.trim() ? "not-allowed" : "pointer",
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
