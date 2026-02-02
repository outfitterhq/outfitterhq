"use client";

import { useState, useEffect, useRef } from "react";

export interface HuntCodeOption {
  code: string;
  species: string;
  unit_description: string;
  season_text: string;
  start_date: string | null;
  end_date: string | null;
}

interface DrawResult {
  id: string;
  client_email: string | null;
  client_name: string | null;
  client_dob: string | null;
  hunter_id: string | null;
  species: string;
  unit: string | null;
  tag_type: string | null;
  draw_year: number;
  result_status: "drawn" | "unsuccessful" | "alternate";
  hunt_code: string | null;
  hunt_created: boolean;
  hunt_id: string | null;
  contract_id: string | null;
  notes: string | null;
  created_at: string;
}

interface PendingApplication {
  submission_id: string;
  client_id: string;
  client_email: string;
  client_name: string;
  client_dob: string | null;
  hunter_id: string | null;
  outfitter_id: string;
  year: number;
  species: string;
  choice_index: number;
  submitted_at: string;
  status: string;
}

// Parsed row from CSV
interface ParsedCSVRow {
  firstName: string;
  lastName: string;
  cin: string;
  dob: string;
  huntCode: string;
  huntDates: string;
  species: string;
  weaponType: string;
  selected: boolean;
}

// Species code mapping (hunt code prefix -> display name)
const speciesCodeMap: { [key: string]: string } = {
  "ELK": "Elk",
  "DER": "Deer",
  "BBY": "Barbary Sheep",
  "ORX": "Oryx",
  "ANT": "Antelope",
  "IBX": "Ibex",
  "JAV": "Javelina",
  "BHS": "Bighorn Sheep",
  "MTL": "Mountain Lion",
};

// Form species -> CSV species (see lib/hunt-codes for full mapping; we add draw-specific labels)
const formSpeciesToCsvSpecies: { [key: string]: string[] } = {
  Elk: ["ELK"],
  "Mule Deer": ["DEER", "MULE DEER"],
  "Coues Deer": ["DEER", "COUES DEER"],
  Antelope: ["PRONGHORN", "ANTELOPE"],
  Oryx: ["ORYX"],
  Ibex: ["IBEX"],
  "Barbary Sheep": ["BARBARY SHEEP", "AOUAD"],
};

export default function DrawResultsPage() {
  const [results, setResults] = useState<DrawResult[]>([]);
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form state for adding new result
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    client_email: "",
    client_name: "",
    client_dob: "",
    hunter_id: "",
    species: "",
    unit: "",
    tag_type: "Rifle",
    draw_year: new Date().getFullYear(),
    result_status: "drawn" as "drawn" | "unsuccessful" | "alternate",
    hunt_code: "",
  });
  const [submitting, setSubmitting] = useState(false);
  
  // CSV upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [csvRows, setCsvRows] = useState<ParsedCSVRow[]>([]);
  const [csvYear, setCsvYear] = useState(new Date().getFullYear());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Hunt code list for auto-picker (same list as iOS; updated yearly)
  const [huntCodeOptions, setHuntCodeOptions] = useState<HuntCodeOption[]>([]);
  const [huntCodePickerOpen, setHuntCodePickerOpen] = useState(false);
  const huntCodePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showForm && huntCodeOptions.length === 0) {
      fetch("/api/hunt-codes")
        .then((r) => r.ok ? r.json() : { codes: [] })
        .then((data) => setHuntCodeOptions(data.codes || []))
        .catch(() => setHuntCodeOptions([]));
    }
  }, [showForm]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (huntCodePickerRef.current && !huntCodePickerRef.current.contains(e.target as Node)) {
        setHuntCodePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Hunt codes filtered by species and tag type (weapon). Middle digit: 1 = any legal, 2 = bow, 3 = muzzleloader.
  function getHuntCodesForPicker(): HuntCodeOption[] {
    if (!formData.species) return [];
    const csvMatches = formSpeciesToCsvSpecies[formData.species];
    if (!csvMatches) return huntCodeOptions;
    let filtered = huntCodeOptions.filter((opt) => {
      const csvSpecies = (opt.species || "").trim().toUpperCase();
      return csvMatches.some((m) => csvSpecies === m || csvSpecies.includes(m));
    });
    if (filtered.length === 0) return huntCodeOptions;
    const weaponDigit = { Rifle: "1", Archery: "2", Muzzleloader: "3" }[formData.tag_type];
    if (weaponDigit) {
      filtered = filtered.filter((opt) => {
        const parts = opt.code.split("-");
        return parts.length >= 2 && parts[1] === weaponDigit;
      });
      if (filtered.length === 0) return huntCodeOptions; // fallback to all for this species
    }
    return [...filtered].sort((a, b) => a.code.localeCompare(b.code));
  }

  // Parse CSV text into rows
  function parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let inQuotes = false;
      let current = "";
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  }

  // Get species from hunt code like ELK-1-294
  function speciesFromHuntCode(huntCode: string): string {
    const parts = huntCode.split("-");
    if (parts.length < 1) return "";
    const code = parts[0].toUpperCase();
    return speciesCodeMap[code] || code;
  }

  // Get weapon type from hunt code (1=Rifle, 2=Muzzleloader, 3=Archery)
  function weaponFromHuntCode(huntCode: string): string {
    const parts = huntCode.split("-");
    if (parts.length < 2) return "Rifle";
    switch (parts[1]) {
      case "1": return "Rifle";
      case "2": return "Muzzleloader";
      case "3": return "Archery";
      default: return "Rifle";
    }
  }

  // Convert DOB from MM/DD/YY to YYYY-MM-DD
  function convertDOB(dob: string): string {
    const match = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (!match) return "";
    const [, month, day, year] = match;
    // Assume 2000s for years < 30, 1900s otherwise
    const fullYear = parseInt(year) < 30 ? 2000 + parseInt(year) : 1900 + parseInt(year);
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Handle file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      
      const rows = parseCSV(text);
      if (rows.length < 2) {
        setError("CSV file appears to be empty");
        return;
      }
      
      const header = rows[0].map(h => h.toLowerCase());
      const body = rows.slice(1);
      
      // Find column indices - NM Lucky List format
      const firstIdx = header.findIndex(h => ["first name", "first_name", "firstname", "first"].includes(h));
      const lastIdx = header.findIndex(h => ["last name", "last_name", "lastname", "last"].includes(h));
      const cinIdx = header.findIndex(h => ["cin", "customer_id", "hunter_id"].includes(h));
      const dobIdx = header.findIndex(h => ["dob", "date_of_birth", "birthdate"].includes(h));
      const codeIdx = header.findIndex(h => ["hunt code", "hunt_code", "huntcode", "code"].includes(h));
      const datesIdx = header.findIndex(h => ["hunt dates", "hunt_dates", "dates"].includes(h));
      
      const parsed: ParsedCSVRow[] = body.map(row => {
        const huntCode = codeIdx >= 0 && codeIdx < row.length ? row[codeIdx] : "";
        return {
          firstName: firstIdx >= 0 && firstIdx < row.length ? row[firstIdx] : "",
          lastName: lastIdx >= 0 && lastIdx < row.length ? row[lastIdx] : "",
          cin: cinIdx >= 0 && cinIdx < row.length ? row[cinIdx] : "",
          dob: dobIdx >= 0 && dobIdx < row.length ? row[dobIdx] : "",
          huntCode,
          huntDates: datesIdx >= 0 && datesIdx < row.length ? row[datesIdx] : "",
          species: speciesFromHuntCode(huntCode),
          weaponType: weaponFromHuntCode(huntCode),
          selected: true,
        };
      }).filter(r => r.firstName || r.lastName);
      
      setCsvRows(parsed);
      setShowCSVUpload(true);
      setError(null);
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Toggle selection of a CSV row
  function toggleCSVRow(index: number) {
    setCsvRows(prev => prev.map((row, i) => 
      i === index ? { ...row, selected: !row.selected } : row
    ));
  }

  // Select/deselect all CSV rows
  function toggleAllCSVRows(selected: boolean) {
    setCsvRows(prev => prev.map(row => ({ ...row, selected })));
  }

  // Import selected CSV rows
  async function importSelectedRows() {
    const selectedRows = csvRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      setError("No rows selected for import");
      return;
    }
    
    setImporting(true);
    setImportProgress({ current: 0, total: selectedRows.length });
    setError(null);
    
    let successCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      setImportProgress({ current: i + 1, total: selectedRows.length });
      
      try {
        // Note: We don't have client email from the lucky list
        // The client will need to be matched by name/DOB/CIN
        const res = await fetch("/api/draw-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_email: "", // Will be matched by DB trigger
            client_name: `${row.firstName} ${row.lastName}`.trim(),
            client_dob: convertDOB(row.dob),
            hunter_id: row.cin,
            species: row.species,
            unit: "", // Not in lucky list
            tag_type: row.weaponType,
            draw_year: csvYear,
            result_status: "drawn",
            hunt_code: row.huntCode || undefined,
            notes: row.huntDates ? `Hunt Dates: ${row.huntDates}` : undefined,
          }),
        });
        
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json().catch(() => ({}));
          errors.push(`${row.firstName} ${row.lastName}: ${data.error || "Failed"}`);
        }
      } catch (e: any) {
        errors.push(`${row.firstName} ${row.lastName}: ${e.message}`);
      }
    }
    
    setImporting(false);
    
    if (successCount > 0) {
      setSuccess(`Successfully imported ${successCount} draw results!`);
      loadData();
    }
    
    if (errors.length > 0) {
      setError(`Some imports failed:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ""}`);
    }
    
    if (successCount === selectedRows.length) {
      setShowCSVUpload(false);
      setCsvRows([]);
    }
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Load existing draw results
      const resultsRes = await fetch("/api/draw-results");
      if (!resultsRes.ok) {
        throw new Error("Failed to load draw results");
      }
      const resultsData = await resultsRes.json();
      setResults(resultsData.results || []);

      // Load pending applications
      const appsRes = await fetch("/api/draw-results/applications");
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApplications(appsData.applications || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/draw-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          hunt_code: formData.hunt_code || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add draw result");
      }

      setSuccess("Draw result added! Hunt and contract created automatically.");
      setShowForm(false);
      setFormData({
        client_email: "",
        client_name: "",
        client_dob: "",
        hunter_id: "",
        species: "",
        unit: "",
        tag_type: "Rifle",
        draw_year: new Date().getFullYear(),
        result_status: "drawn",
        hunt_code: "",
      });
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function prefillFromApplication(app: PendingApplication) {
    setFormData({
      client_email: app.client_email,
      client_name: app.client_name,
      client_dob: app.client_dob || "",
      hunter_id: app.hunter_id || "",
      species: app.species || "",
      unit: "",
      tag_type: "Rifle",
      draw_year: app.year,
      result_status: "drawn",
      hunt_code: "",
    });
    setShowForm(true);
  }

  const drawnResults = results.filter(r => r.result_status === "drawn");
  const unsuccessfulResults = results.filter(r => r.result_status !== "drawn");

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Draw Results</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Enter the &quot;Lucky List&quot; - clients who won their draw tags
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "12px 24px",
              background: "#22c55e",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            📁 Upload Lucky List CSV
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setShowCSVUpload(false); }}
            style={{
              padding: "12px 24px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            {showForm ? "Cancel" : "+ Add Manually"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 16, color: "#c00" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: "#efe", padding: 12, borderRadius: 8, marginBottom: 16, color: "#060" }}>
          {success}
        </div>
      )}

      {/* CSV Upload Preview */}
      {showCSVUpload && csvRows.length > 0 && (
        <div style={{ background: "#f0f9ff", padding: 24, borderRadius: 12, marginBottom: 24, border: "1px solid #0070f3" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>📋 Lucky List Preview ({csvRows.filter(r => r.selected).length} of {csvRows.length} selected)</h2>
            <button
              onClick={() => { setShowCSVUpload(false); setCsvRows([]); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
            <div>
              <label style={{ marginRight: 8, fontWeight: 500 }}>Draw Year:</label>
              <input
                type="number"
                value={csvYear}
                onChange={(e) => setCsvYear(parseInt(e.target.value))}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4, width: 100 }}
              />
            </div>
            <button
              onClick={() => toggleAllCSVRows(true)}
              style={{ padding: "8px 16px", background: "#fff", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}
            >
              Select All
            </button>
            <button
              onClick={() => toggleAllCSVRows(false)}
              style={{ padding: "8px 16px", background: "#fff", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}
            >
              Deselect All
            </button>
          </div>
          
          <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #ddd", borderRadius: 8, background: "white" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f5f5f5", position: "sticky", top: 0 }}>
                  <th style={{ padding: 10, textAlign: "center", width: 40 }}>✓</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Name</th>
                  <th style={{ padding: 10, textAlign: "left" }}>DOB</th>
                  <th style={{ padding: 10, textAlign: "left" }}>CIN</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Hunt Code</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Species</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Weapon</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Hunt Dates</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row, idx) => (
                  <tr 
                    key={idx} 
                    style={{ 
                      borderTop: "1px solid #eee",
                      background: row.selected ? "white" : "#f9f9f9",
                      opacity: row.selected ? 1 : 0.5,
                      cursor: "pointer"
                    }}
                    onClick={() => toggleCSVRow(idx)}
                  >
                    <td style={{ padding: 10, textAlign: "center" }}>
                      <input type="checkbox" checked={row.selected} readOnly />
                    </td>
                    <td style={{ padding: 10 }}><strong>{row.firstName} {row.lastName}</strong></td>
                    <td style={{ padding: 10 }}>{row.dob}</td>
                    <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{row.cin}</td>
                    <td style={{ padding: 10, fontFamily: "monospace" }}>{row.huntCode}</td>
                    <td style={{ padding: 10 }}>{row.species}</td>
                    <td style={{ padding: 10 }}>{row.weaponType}</td>
                    <td style={{ padding: 10 }}>{row.huntDates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={importSelectedRows}
              disabled={importing || csvRows.filter(r => r.selected).length === 0}
              style={{
                padding: "14px 32px",
                background: importing ? "#ccc" : "#22c55e",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: importing ? "not-allowed" : "pointer",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {importing 
                ? `Importing ${importProgress.current}/${importProgress.total}...` 
                : `🎉 Import ${csvRows.filter(r => r.selected).length} Winners (Create Hunts + Contracts)`
              }
            </button>
            {importing && (
              <div style={{ flex: 1, background: "#ddd", borderRadius: 4, height: 8 }}>
                <div 
                  style={{ 
                    width: `${(importProgress.current / importProgress.total) * 100}%`, 
                    background: "#22c55e", 
                    height: "100%", 
                    borderRadius: 4,
                    transition: "width 0.3s"
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New Result Form */}
      {showForm && (
        <div style={{ background: "#f9f9f9", padding: 24, borderRadius: 12, marginBottom: 24, border: "1px solid #ddd" }}>
          <h2 style={{ marginTop: 0 }}>Add Draw Result</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Client Email *</label>
                <input
                  type="email"
                  required
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Date of Birth</label>
                <input
                  type="date"
                  value={formData.client_dob}
                  onChange={(e) => setFormData({ ...formData, client_dob: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Hunter ID</label>
                <input
                  type="text"
                  value={formData.hunter_id}
                  placeholder="e.g., CO-12345678"
                  onChange={(e) => setFormData({ ...formData, hunter_id: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Species *</label>
                <select
                  required
                  value={formData.species}
                  onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                >
                  <option value="">Select species...</option>
                  <option value="Elk">Elk</option>
                  <option value="Mule Deer">Mule Deer</option>
                  <option value="Coues Deer">Coues Deer</option>
                  <option value="Antelope">Antelope</option>
                  <option value="Oryx">Oryx</option>
                  <option value="Ibex">Ibex</option>
                  <option value="Barbary Sheep">Barbary Sheep</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  placeholder="e.g., 61, 44"
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div ref={huntCodePickerRef} style={{ position: "relative" }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Hunt Code</label>
                <input
                  type="text"
                  value={formData.hunt_code}
                  placeholder="Search or pick (e.g. ELK-1-294) — list updated yearly"
                  onChange={(e) => {
                    setFormData({ ...formData, hunt_code: e.target.value });
                    setHuntCodePickerOpen(true);
                  }}
                  onFocus={() => setHuntCodePickerOpen(true)}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
                {huntCodePickerOpen && huntCodeOptions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "100%",
                      marginTop: 2,
                      maxHeight: 280,
                      overflowY: "auto",
                      background: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 50,
                    }}
                  >
                    {getHuntCodesForPicker().length === 0 ? (
                      <div style={{ padding: 12, color: "#666", fontSize: 13 }}>
                        Select species and tag type above (1=any legal, 2=bow, 3=muzzleloader).
                      </div>
                    ) : (
                      getHuntCodesForPicker()
                        .filter((opt) => {
                          const q = formData.hunt_code.trim().toLowerCase();
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
                            const parts = opt.code.split("-");
                            const weaponDigit = parts.length >= 2 ? parts[1] : "1";
                            const tagType = weaponDigit === "2" ? "Archery" : weaponDigit === "3" ? "Muzzleloader" : "Rifle";
                            setFormData({ ...formData, hunt_code: opt.code, tag_type: tagType });
                            setHuntCodePickerOpen(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 12px",
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
                              — {opt.unit_description.slice(0, 50)}{opt.unit_description.length > 50 ? "…" : ""}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Tag Type</label>
                <select
                  value={formData.tag_type}
                  onChange={(e) => setFormData({ ...formData, tag_type: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                >
                  <option value="Rifle">Rifle</option>
                  <option value="Archery">Archery</option>
                  <option value="Muzzleloader">Muzzleloader</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Draw Year</label>
                <input
                  type="number"
                  value={formData.draw_year}
                  onChange={(e) => setFormData({ ...formData, draw_year: parseInt(e.target.value) })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Result</label>
                <select
                  value={formData.result_status}
                  onChange={(e) => setFormData({ ...formData, result_status: e.target.value as any })}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                >
                  <option value="drawn">Drawn (Winner)</option>
                  <option value="unsuccessful">Unsuccessful</option>
                  <option value="alternate">Alternate</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "12px 32px",
                  background: formData.result_status === "drawn" ? "#22c55e" : "#666",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 16,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Adding..." : formData.result_status === "drawn" ? "Add Winner (Create Hunt + Contract)" : "Add Result"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Applications - Grouped by Client */}
      {applications.length > 0 && (() => {
        const pendingApps = applications.filter(a => a.status === "pending");
        // Group by client
        const grouped = pendingApps.reduce((acc, app) => {
          const key = app.client_email || app.client_name;
          if (!acc[key]) {
            acc[key] = { client_name: app.client_name, client_email: app.client_email, selections: [] };
          }
          acc[key].selections.push(app);
          return acc;
        }, {} as Record<string, { client_name: string; client_email: string; selections: PendingApplication[] }>);
        
        const clients = Object.values(grouped);
        if (clients.length === 0) return null;
        
        // Filter clients by search query
        const filteredClients = clients.filter(client => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          return (
            client.client_name?.toLowerCase().includes(query) ||
            client.client_email?.toLowerCase().includes(query)
          );
        });
        
        return (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Pending Draw Applications</h2>
                <p style={{ opacity: 0.75, margin: "4px 0 0 0" }}>Click a client to enter their draw result</p>
              </div>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 14,
                  width: 280,
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0070f3"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }}
              />
            </div>
            {filteredClients.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", background: "#f9f9f9", borderRadius: 8, color: "#666" }}>
                {searchQuery.trim() ? `No clients found matching "${searchQuery}"` : "No pending applications"}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
              {filteredClients.map((client, idx) => {
                const clientKey = client.client_email || client.client_name || `client-${idx}`;
                const expanded = expandedClients[clientKey] || false;
                return (
                  <div
                    key={clientKey}
                    style={{
                      background: "white",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {/* Client header */}
                    <div
                      onClick={() => setExpandedClients(prev => ({ ...prev, [clientKey]: !expanded }))}
                      style={{
                        padding: 16,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: expanded ? "#f0f9ff" : "white",
                      }}
                      onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = "#fafafa"; }}
                      onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "white"; }}
                    >
                      <div>
                        <strong>{client.client_name}</strong>
                        <div style={{ fontSize: 14, color: "#666", marginTop: 2 }}>
                          {client.client_email}
                        </div>
                        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                          {client.selections.length} species selection{client.selections.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: 18, color: "#666" }}>
                        {expanded ? "▼" : "▶"}
                      </span>
                    </div>
                    
                    {/* Expanded selections */}
                    {expanded && (
                      <div style={{ padding: 16, borderTop: "1px solid #eee", background: "#fafafa" }}>
                        <div style={{ display: "grid", gap: 8 }}>
                          {client.selections.map((app, selIdx) => (
                            <div
                              key={`${app.submission_id}-${app.species}-${selIdx}`}
                              onClick={() => prefillFromApplication(app)}
                              style={{
                                padding: 12,
                                background: "white",
                                border: "1px solid #ddd",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
                            >
                              <div>
                                <strong>Choice #{app.choice_index + 1}: {app.species}</strong>
                                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                                  Year: {app.year}
                                </div>
                              </div>
                              <span style={{ color: "#0070f3", fontSize: 14 }}>Enter Result →</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>
        );
      })()}

      {loading ? (
        <p>Loading draw results...</p>
      ) : (
        <>
          {/* Winners (Lucky List) */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ color: "#22c55e" }}>🎉 Lucky List ({drawnResults.length})</h2>
            {drawnResults.length === 0 ? (
              <p style={{ color: "#666" }}>No draw winners entered yet.</p>
            ) : (
              <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={{ padding: 12, textAlign: "left" }}>Client</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Hunt Code</th>
                      <th style={{ padding: 12, textAlign: "left" }}>DOB</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Hunter ID</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Species</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Unit</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Tag Type</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Year</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drawnResults.map((result) => (
                      <tr key={result.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 12 }}>
                          <strong>{result.client_name || result.client_email || "Unknown"}</strong>
                          {result.client_email ? (
                            <div style={{ fontSize: 12, color: "#666" }}>{result.client_email}</div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#f59e0b" }}>⚠ No email - needs client match</div>
                          )}
                          {result.notes && (
                            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                              {result.notes.split("\n")[0]}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 12, fontFamily: "monospace", fontSize: 12 }}>{result.hunt_code || "—"}</td>
                        <td style={{ padding: 12 }}>{result.client_dob || "—"}</td>
                        <td style={{ padding: 12, fontFamily: "monospace", fontSize: 12 }}>{result.hunter_id || "—"}</td>
                        <td style={{ padding: 12 }}>{result.species}</td>
                        <td style={{ padding: 12 }}>{result.unit || "—"}</td>
                        <td style={{ padding: 12 }}>{result.tag_type || "—"}</td>
                        <td style={{ padding: 12 }}>{result.draw_year}</td>
                        <td style={{ padding: 12 }}>
                          {result.hunt_created ? (
                            <span style={{ color: "#22c55e" }}>✓ Hunt + Contract Created</span>
                          ) : result.client_email ? (
                            <span style={{ color: "#f59e0b" }}>Pending</span>
                          ) : (
                            <span style={{ color: "#666" }}>Awaiting Client Registration</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unsuccessful */}
          {unsuccessfulResults.length > 0 && (
            <div>
              <h2 style={{ color: "#666" }}>Unsuccessful ({unsuccessfulResults.length})</h2>
              <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={{ padding: 12, textAlign: "left" }}>Client</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Species</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Year</th>
                      <th style={{ padding: 12, textAlign: "left" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unsuccessfulResults.map((result) => (
                      <tr key={result.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 12 }}>{result.client_name || result.client_email}</td>
                        <td style={{ padding: 12 }}>{result.species}</td>
                        <td style={{ padding: 12 }}>{result.draw_year}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ color: "#666" }}>{result.result_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
