"use client";

import { useState, useEffect } from "react";
import SpeciesPhotoPicker from "./SpeciesPhotoPicker";

interface OutfitterCode {
  id: string;
  code: string;
  single_use: boolean;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const [outfitterName, setOutfitterName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Client Portal Branding state
  const [logoUrl, setLogoUrl] = useState("");
  const [backgroundType, setBackgroundType] = useState<"color" | "image" | "per-page">("color");
  const [backgroundColor, setBackgroundColor] = useState("#f5f5f5");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [headerColor, setHeaderColor] = useState("#1a472a");
  const [perPageBackgrounds, setPerPageBackgrounds] = useState<Record<string, { type: "color" | "image"; value: string }>>({});
  const [savingBranding, setSavingBranding] = useState(false);

  // Dashboard Customization state
  const [dashboardHeroTitle, setDashboardHeroTitle] = useState("");
  const [dashboardHeroSubtitle, setDashboardHeroSubtitle] = useState("");
  const [dashboardHeroImageUrl, setDashboardHeroImageUrl] = useState("");
  const [dashboardWelcomeText, setDashboardWelcomeText] = useState("");
  const [dashboardCtaPrimaryText, setDashboardCtaPrimaryText] = useState("");
  const [dashboardCtaPrimaryUrl, setDashboardCtaPrimaryUrl] = useState("");
  const [dashboardCtaSecondaryText, setDashboardCtaSecondaryText] = useState("");
  const [dashboardCtaSecondaryUrl, setDashboardCtaSecondaryUrl] = useState("");
  const [dashboardFeatureCards, setDashboardFeatureCards] = useState<Array<{ title: string; description: string; icon?: string; href: string }>>([]);
  const [dashboardHuntShowcases, setDashboardHuntShowcases] = useState<Array<{ title: string; imageUrl?: string; href: string }>>([]);
  const [dashboardTestimonials, setDashboardTestimonials] = useState<Array<{ name: string; location: string; text: string; imageUrl?: string }>>([]);
  const [dashboardSpecialSections, setDashboardSpecialSections] = useState<Array<{ title: string; description: string; imageUrl?: string; href?: string; buttonText?: string }>>([]);
  const [dashboardPartnerLogos, setDashboardPartnerLogos] = useState<Array<{ name: string; logoUrl: string; href?: string }>>([]);
  const [dashboardContactEnabled, setDashboardContactEnabled] = useState(false);
  const [dashboardContactEmail, setDashboardContactEmail] = useState("");
  const [savingDashboard, setSavingDashboard] = useState(false);
  const [showDashboardSection, setShowDashboardSection] = useState(true); // Default to expanded

  // Success History Customization state
  const [successHistoryIntroText, setSuccessHistoryIntroText] = useState("");
  const [successHistorySpeciesPhotos, setSuccessHistorySpeciesPhotos] = useState<Record<string, string>>({});
  const [savingSuccessHistory, setSavingSuccessHistory] = useState(false);
  const [showSuccessHistorySection, setShowSuccessHistorySection] = useState(true); // Default to expanded

  // Customizable Species List state
  const [availableSpecies, setAvailableSpecies] = useState<string[]>([]);
  const [newSpeciesName, setNewSpeciesName] = useState("");
  const [savingSpecies, setSavingSpecies] = useState(false);
  const [showSpeciesSection, setShowSpeciesSection] = useState(true);

  // Outfitter codes state
  const [codes, setCodes] = useState<OutfitterCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [showCreateCode, setShowCreateCode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCodeSingleUse, setNewCodeSingleUse] = useState(false);
  const [newCodeNotes, setNewCodeNotes] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeError, setCodeError] = useState("");

  // Waiver PDF (per-outfitter)
  const [waiverDocumentPath, setWaiverDocumentPath] = useState<string | null>(null);
  const [waiverUploading, setWaiverUploading] = useState(false);
  const [waiverError, setWaiverError] = useState<string | null>(null);

  // Hunt contract: template or custom PDF (per-outfitter)
  const [huntContractDocumentPath, setHuntContractDocumentPath] = useState<string | null>(null);
  const [huntContractUploading, setHuntContractUploading] = useState(false);
  const [huntContractError, setHuntContractError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadCodes();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/outfitter");
      if (res.ok) {
        const data = await res.json();
        const outfitter = data.outfitter || {};
        setOutfitterName(outfitter.name || "");
        setLogoUrl(outfitter.client_portal_logo_url || "");
        setBackgroundType(outfitter.client_portal_background_type || "color");
        setBackgroundColor(outfitter.client_portal_background_color || "#f5f5f5");
        setBackgroundImageUrl(outfitter.client_portal_background_image_url || "");
        setHeaderColor(outfitter.client_portal_header_color || "#1a472a");
        setPerPageBackgrounds(outfitter.client_portal_per_page_backgrounds || {});
        
        // Dashboard customization
        setDashboardHeroTitle(outfitter.dashboard_hero_title || "");
        setDashboardHeroSubtitle(outfitter.dashboard_hero_subtitle || "");
        setDashboardHeroImageUrl(outfitter.dashboard_hero_image_url || "");
        setDashboardCtaPrimaryText(outfitter.dashboard_cta_primary_text || "");
        setDashboardCtaPrimaryUrl(outfitter.dashboard_cta_primary_url || "");
        setDashboardCtaSecondaryText(outfitter.dashboard_cta_secondary_text || "");
        setDashboardCtaSecondaryUrl(outfitter.dashboard_cta_secondary_url || "");
        setDashboardFeatureCards((outfitter.dashboard_feature_cards as any[]) || []);
        setDashboardHuntShowcases((outfitter.dashboard_hunt_showcases as any[]) || []);
        setDashboardTestimonials((outfitter.dashboard_testimonials as any[]) || []);
        setDashboardSpecialSections((outfitter.dashboard_special_sections as any[]) || []);
        setDashboardPartnerLogos((outfitter.dashboard_partner_logos as any[]) || []);
        setDashboardContactEnabled(outfitter.dashboard_contact_enabled || false);
        setDashboardContactEmail(outfitter.dashboard_contact_email || "");
        setDashboardWelcomeText(outfitter.dashboard_welcome_text || "");
        
        // Success History customization
        setSuccessHistoryIntroText(outfitter.success_history_intro_text || "");
        setSuccessHistorySpeciesPhotos((outfitter.success_history_species_photos as Record<string, string>) || {});
        
        // Available species list
        setAvailableSpecies((outfitter.available_species as string[]) || ["Elk", "Deer", "Antelope", "Oryx", "Ibex", "Aoudad", "Bighorn Sheep", "Bear", "Mountain Lion", "Turkey"]);
        setWaiverDocumentPath(outfitter.waiver_document_path || null);
        setHuntContractDocumentPath(outfitter.hunt_contract_document_path || null);
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCodes() {
    try {
      const res = await fetch("/api/outfitter-codes");
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch (e) {
      console.error("Failed to load codes", e);
    } finally {
      setLoadingCodes(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/outfitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: outfitterName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      alert("Settings saved!");
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBranding() {
    setSavingBranding(true);
    try {
      const res = await fetch("/api/outfitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_portal_logo_url: logoUrl || null,
          client_portal_background_type: backgroundType,
          client_portal_background_color: backgroundColor,
          client_portal_background_image_url: backgroundImageUrl || null,
          client_portal_per_page_backgrounds: backgroundType === "per-page" ? perPageBackgrounds : null,
          client_portal_header_color: headerColor,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save branding");
      }

      alert("Client portal branding saved!");
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setSavingBranding(false);
    }
  }

  function updatePerPageBackground(path: string, type: "color" | "image", value: string) {
    setPerPageBackgrounds((prev) => ({
      ...prev,
      [path]: { type, value },
    }));
  }

  function removePerPageBackground(path: string) {
    setPerPageBackgrounds((prev) => {
      const updated = { ...prev };
      delete updated[path];
      return updated;
    });
  }

  async function handleSaveDashboard() {
    setSavingDashboard(true);
    try {
      const res = await fetch("/api/outfitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboard_hero_title: dashboardHeroTitle,
          dashboard_hero_subtitle: dashboardHeroSubtitle,
          dashboard_hero_image_url: dashboardHeroImageUrl || null,
          dashboard_welcome_text: dashboardWelcomeText || null,
          dashboard_cta_primary_text: dashboardCtaPrimaryText || null,
          dashboard_cta_primary_url: dashboardCtaPrimaryUrl || null,
          dashboard_cta_secondary_text: dashboardCtaSecondaryText || null,
          dashboard_cta_secondary_url: dashboardCtaSecondaryUrl || null,
          dashboard_feature_cards: dashboardFeatureCards,
          dashboard_hunt_showcases: dashboardHuntShowcases,
          dashboard_testimonials: dashboardTestimonials,
          dashboard_special_sections: dashboardSpecialSections,
          dashboard_partner_logos: dashboardPartnerLogos,
          dashboard_contact_enabled: dashboardContactEnabled,
          dashboard_contact_email: dashboardContactEmail || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save dashboard customization");
      }

      alert("Dashboard customization saved!");
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setSavingDashboard(false);
    }
  }

  async function handleSaveSuccessHistory() {
    setSavingSuccessHistory(true);
    try {
      const res = await fetch("/api/outfitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success_history_intro_text: successHistoryIntroText || null,
          success_history_species_photos: successHistorySpeciesPhotos,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save success history customization");
      }

      alert("Success history customization saved!");
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setSavingSuccessHistory(false);
    }
  }

  async function handleSaveSpecies() {
    setSavingSpecies(true);
    try {
      const res = await fetch("/api/outfitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available_species: availableSpecies,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save species list");
      }

      alert("Species list saved!");
    } catch (e: any) {
      alert("Error: " + String(e));
    } finally {
      setSavingSpecies(false);
    }
  }

  async function handleCreateCode() {
    if (!newCode.trim() || newCode.trim().length < 3) {
      setCodeError("Code must be at least 3 characters");
      return;
    }

    setCreatingCode(true);
    setCodeError("");

    try {
      const res = await fetch("/api/outfitter-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim(),
          single_use: newCodeSingleUse,
          notes: newCodeNotes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCodeError(data.error || "Failed to create code");
        return;
      }

      // Add new code to list
      setCodes([data.code, ...codes]);
      setNewCode("");
      setNewCodeSingleUse(false);
      setNewCodeNotes("");
      setShowCreateCode(false);
    } catch (e: any) {
      setCodeError(String(e));
    } finally {
      setCreatingCode(false);
    }
  }

  async function toggleCodeActive(codeId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/outfitter-codes/${codeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (res.ok) {
        setCodes(codes.map(c => c.id === codeId ? { ...c, is_active: !isActive } : c));
      }
    } catch (e) {
      console.error("Failed to toggle code", e);
    }
  }

  async function deleteCode(codeId: string) {
    if (!confirm("Are you sure you want to delete this code?")) return;

    try {
      const res = await fetch(`/api/outfitter-codes/${codeId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setCodes(codes.filter(c => c.id !== codeId));
      }
    } catch (e) {
      console.error("Failed to delete code", e);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
      <h1 style={{ margin: 0, marginBottom: 24 }}>Settings</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Outfitter Information */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Outfitter Information</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Outfitter Name</label>
              <input
                type="text"
                value={outfitterName}
                onChange={(e) => setOutfitterName(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="Your outfitter name"
              />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 24px",
                background: "#0070f3",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>

        {/* Client Portal Branding */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Client Portal Branding</h2>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            Customize the background and colors of your client portal to match your brand.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Logo */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Outfitter Logo
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="https://example.com/your-logo.png"
              />
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                Enter a publicly accessible image URL. Recommended: PNG with transparent background, 200x60px or similar.
              </p>
              {logoUrl && (
                <div style={{ marginTop: 12, padding: 12, background: "#f9f9f9", borderRadius: 6 }}>
                  <p style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Preview:</p>
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    style={{
                      maxHeight: 60,
                      maxWidth: 200,
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Background Type */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Background Type
              </label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="backgroundType"
                    value="color"
                    checked={backgroundType === "color"}
                    onChange={(e) => setBackgroundType(e.target.value as "color" | "image" | "per-page")}
                  />
                  <span>Solid Color (Global)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="backgroundType"
                    value="image"
                    checked={backgroundType === "image"}
                    onChange={(e) => setBackgroundType(e.target.value as "color" | "image" | "per-page")}
                  />
                  <span>Background Image (Global)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="backgroundType"
                    value="per-page"
                    checked={backgroundType === "per-page"}
                    onChange={(e) => setBackgroundType(e.target.value as "color" | "image" | "per-page")}
                  />
                  <span>Per-Page Backgrounds</span>
                </label>
              </div>
            </div>

            {/* Background Color (when type is color) */}
            {backgroundType === "color" && (
              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Background Color
                </label>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{ width: 60, height: 40, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                    placeholder="#f5f5f5"
                  />
                </div>
                <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  Choose a color that matches your brand. Light colors work best for readability.
                </p>
              </div>
            )}

            {/* Background Image URL (when type is image) */}
            {backgroundType === "image" && (
              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Background Image URL
                </label>
                <input
                  type="url"
                  value={backgroundImageUrl}
                  onChange={(e) => setBackgroundImageUrl(e.target.value)}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                  placeholder="https://example.com/your-background-image.jpg"
                />
                <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  Enter a publicly accessible image URL. Recommended: 1920x1080px or larger.
                </p>
                {backgroundImageUrl && (
                  <div style={{ marginTop: 12, padding: 12, background: "#f9f9f9", borderRadius: 6 }}>
                    <p style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Preview:</p>
                    <div
                      style={{
                        width: "100%",
                        height: 150,
                        backgroundImage: `url(${backgroundImageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Per-Page Backgrounds */}
            {backgroundType === "per-page" && (
              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Per-Page Backgrounds
                </label>
                <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
                  Set different backgrounds for specific pages. Leave blank to use default color.
                </p>
                {[
                  { path: "/client", label: "Dashboard" },
                  { path: "/client/calendar", label: "Calendar" },
                  { path: "/client/documents", label: "Documents" },
                  { path: "/client/payments", label: "Payments" },
                  { path: "/client/pricing", label: "Pricing" },
                  { path: "/client/private-tags", label: "Private Tags" },
                  { path: "/client/success-history", label: "Past Success" },
                  { path: "/client/resources", label: "Resources" },
                ].map((page) => {
                  const pageBg = perPageBackgrounds[page.path] || { type: "color", value: backgroundColor };
                  return (
                    <div key={page.path} style={{ marginBottom: 16, padding: 12, background: "#f9f9f9", borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <strong style={{ fontSize: 14 }}>{page.label}</strong>
                        {perPageBackgrounds[page.path] && (
                          <button
                            onClick={() => removePerPageBackground(page.path)}
                            style={{
                              padding: "4px 8px",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              color: "#ef4444",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                          <input
                            type="radio"
                            checked={pageBg.type === "color"}
                            onChange={() => updatePerPageBackground(page.path, "color", backgroundColor)}
                          />
                          <span style={{ fontSize: 12 }}>Color</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                          <input
                            type="radio"
                            checked={pageBg.type === "image"}
                            onChange={() => updatePerPageBackground(page.path, "image", "")}
                          />
                          <span style={{ fontSize: 12 }}>Image</span>
                        </label>
                      </div>
                      {pageBg.type === "color" ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="color"
                            value={pageBg.value}
                            onChange={(e) => updatePerPageBackground(page.path, "color", e.target.value)}
                            style={{ width: 50, height: 30, border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}
                          />
                          <input
                            type="text"
                            value={pageBg.value}
                            onChange={(e) => updatePerPageBackground(page.path, "color", e.target.value)}
                            style={{ flex: 1, padding: 6, border: "1px solid #ddd", borderRadius: 4, fontSize: 12 }}
                            placeholder="#f5f5f5"
                          />
                        </div>
                      ) : (
                        <input
                          type="url"
                          value={pageBg.value}
                          onChange={(e) => updatePerPageBackground(page.path, "image", e.target.value)}
                          style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4, fontSize: 12 }}
                          placeholder="https://example.com/image.jpg"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Header Color */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Header & Footer Color
              </label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  type="color"
                  value={headerColor}
                  onChange={(e) => setHeaderColor(e.target.value)}
                  style={{ width: 60, height: 40, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={headerColor}
                  onChange={(e) => setHeaderColor(e.target.value)}
                  style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                  placeholder="#1a472a"
                />
              </div>
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                Color for the header and footer. Dark colors work best for contrast with white text.
              </p>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveBranding}
              disabled={savingBranding}
              style={{
                padding: "12px 24px",
                background: "#059669",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: savingBranding ? "not-allowed" : "pointer",
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              {savingBranding ? "Saving..." : "Save Branding Settings"}
            </button>
          </div>
        </section>

        {/* Waiver of Liability (PDF) */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ margin: 0, marginBottom: 8 }}>Waiver of Liability (PDF)</h2>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>
            Upload your waiver PDF. Clients will see this document on the Waiver of Liability page and sign via DocuSign (when configured).
          </p>
          {waiverDocumentPath && (
            <p style={{ marginBottom: 12, padding: 10, background: "#e8f5e9", borderRadius: 6, color: "#2e7d32" }}>
              Current waiver PDF is set. Upload a new file to replace it.
            </p>
          )}
          {waiverError && (
            <p style={{ color: "#c62828", marginBottom: 12 }}>{waiverError}</p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
              const file = fileInput?.files?.[0];
              if (!file) {
                setWaiverError("Please select a PDF file.");
                return;
              }
              setWaiverError(null);
              setWaiverUploading(true);
              try {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/settings/waiver-upload", {
                  method: "POST",
                  body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Upload failed");
                setWaiverDocumentPath(data.path);
                fileInput.value = "";
              } catch (err: any) {
                setWaiverError(err.message);
              } finally {
                setWaiverUploading(false);
              }
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}
          >
            <input type="file" accept=".pdf,application/pdf" style={{ padding: 8 }} />
            <button
              type="submit"
              disabled={waiverUploading}
              style={{
                padding: "10px 20px",
                background: waiverUploading ? "#999" : "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: waiverUploading ? "not-allowed" : "pointer",
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              {waiverUploading ? "Uploading..." : "Upload Waiver PDF"}
            </button>
          </form>
          <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
            Max 10MB. Create the storage bucket &quot;outfitter-documents&quot; in Supabase Dashboard if upload fails.
          </p>
        </section>

        {/* Hunt Contract: template or upload own PDF */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ margin: 0, marginBottom: 8 }}>Hunt Contract</h2>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>
            Use a <strong>Contract Template</strong> (managed below) or upload your own PDF. When clients sign, the system uses your uploaded PDF if set; otherwise it uses the hunt contract template content for DocuSign.
          </p>
          <p style={{ marginBottom: 16 }}>
            <a
              href="/contract-templates"
              style={{ color: "#1a472a", fontWeight: 600 }}
            >
              Manage Contract Templates →
            </a>
          </p>
          {huntContractDocumentPath && (
            <p style={{ marginBottom: 12, padding: 10, background: "#e8f5e9", borderRadius: 6, color: "#2e7d32" }}>
              Your custom hunt contract PDF is set. Upload a new file to replace it.
            </p>
          )}
          {huntContractError && (
            <p style={{ color: "#c62828", marginBottom: 12 }}>{huntContractError}</p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
              const file = fileInput?.files?.[0];
              if (!file) {
                setHuntContractError("Please select a PDF file.");
                return;
              }
              setHuntContractError(null);
              setHuntContractUploading(true);
              try {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/settings/hunt-contract-upload", {
                  method: "POST",
                  body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Upload failed");
                setHuntContractDocumentPath(data.path);
                fileInput.value = "";
              } catch (err: unknown) {
                setHuntContractError(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setHuntContractUploading(false);
              }
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}
          >
            <input type="file" accept=".pdf,application/pdf" style={{ padding: 8 }} />
            <button
              type="submit"
              disabled={huntContractUploading}
              style={{
                padding: "10px 20px",
                background: huntContractUploading ? "#999" : "#1a472a",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: huntContractUploading ? "not-allowed" : "pointer",
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              {huntContractUploading ? "Uploading…" : "Upload Hunt Contract PDF"}
            </button>
          </form>
          <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
            Max 10MB. If you upload a PDF, it will be used when sending hunt contracts to DocuSign for client signing.
          </p>
        </section>

        {/* Outfitter Codes */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Client Invite Codes</h2>
            <button
              onClick={() => setShowCreateCode(!showCreateCode)}
              style={{
                padding: "8px 16px",
                background: showCreateCode ? "#666" : "#0070f3",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {showCreateCode ? "Cancel" : "+ Create Code"}
            </button>
          </div>

          <p style={{ opacity: 0.7, marginBottom: 16 }}>
            Create codes that clients can use to join your outfitter when they sign up.
          </p>

          {/* Create Code Form */}
          {showCreateCode && (
            <div style={{ background: "#f9f9f9", padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Code</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, textTransform: "uppercase" }}
                    placeholder="e.g., HUNT2026 or WELCOME2026"
                    maxLength={20}
                  />
                </div>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newCodeSingleUse}
                      onChange={(e) => setNewCodeSingleUse(e.target.checked)}
                    />
                    <span style={{ fontWeight: 600 }}>Single-use only</span>
                    <span style={{ opacity: 0.6, fontSize: 14 }}>(each client can only use it once)</span>
                  </label>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Notes (optional)</label>
                  <input
                    type="text"
                    value={newCodeNotes}
                    onChange={(e) => setNewCodeNotes(e.target.value)}
                    style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                    placeholder="e.g., Spring 2026 promotion"
                  />
                </div>

                {codeError && (
                  <p style={{ color: "red", margin: 0 }}>{codeError}</p>
                )}

                <button
                  onClick={handleCreateCode}
                  disabled={creatingCode}
                  style={{
                    padding: "10px 24px",
                    background: "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: creatingCode ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    alignSelf: "flex-start",
                  }}
                >
                  {creatingCode ? "Creating..." : "Create Code"}
                </button>
              </div>
            </div>
          )}

          {/* Codes List */}
          {loadingCodes ? (
            <p>Loading codes...</p>
          ) : codes.length === 0 ? (
            <p style={{ opacity: 0.6, fontStyle: "italic" }}>No codes created yet. Create your first code above!</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ddd" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Code</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Notes</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px" }}>
                      <code style={{ 
                        background: "#f0f0f0", 
                        padding: "4px 8px", 
                        borderRadius: 4,
                        fontWeight: 600,
                        fontSize: 14
                      }}>
                        {code.code}
                      </code>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {code.single_use ? "Single-use" : "Multi-use"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: code.is_active ? "#dcfce7" : "#fee2e2",
                        color: code.is_active ? "#166534" : "#991b1b",
                      }}>
                        {code.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "12px", opacity: 0.7 }}>
                      {code.notes || "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <button
                        onClick={() => toggleCodeActive(code.id, code.is_active)}
                        style={{
                          padding: "4px 12px",
                          background: "transparent",
                          border: "1px solid #ddd",
                          borderRadius: 4,
                          cursor: "pointer",
                          marginRight: 8,
                        }}
                      >
                        {code.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => deleteCode(code.id)}
                        style={{
                          padding: "4px 12px",
                          background: "transparent",
                          border: "1px solid #ef4444",
                          color: "#ef4444",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Dashboard Customization */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Client Dashboard Customization</h2>
              <p style={{ opacity: 0.7, marginTop: 4 }}>
                Customize your client dashboard to match your brand and showcase your services.
              </p>
            </div>
            <button
              onClick={() => setShowDashboardSection(!showDashboardSection)}
              style={{
                padding: "8px 16px",
                background: showDashboardSection ? "#666" : "#0070f3",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {showDashboardSection ? "Collapse" : "Expand"}
            </button>
          </div>

          {showDashboardSection && (
            <DashboardCustomizationForm
              heroTitle={dashboardHeroTitle}
              setHeroTitle={setDashboardHeroTitle}
              heroSubtitle={dashboardHeroSubtitle}
              setHeroSubtitle={setDashboardHeroSubtitle}
              heroImageUrl={dashboardHeroImageUrl}
              setHeroImageUrl={setDashboardHeroImageUrl}
              welcomeText={dashboardWelcomeText}
              setWelcomeText={setDashboardWelcomeText}
              ctaPrimaryText={dashboardCtaPrimaryText}
              setCtaPrimaryText={setDashboardCtaPrimaryText}
              ctaPrimaryUrl={dashboardCtaPrimaryUrl}
              setCtaPrimaryUrl={setDashboardCtaPrimaryUrl}
              ctaSecondaryText={dashboardCtaSecondaryText}
              setCtaSecondaryText={setDashboardCtaSecondaryText}
              ctaSecondaryUrl={dashboardCtaSecondaryUrl}
              setCtaSecondaryUrl={setDashboardCtaSecondaryUrl}
              featureCards={dashboardFeatureCards}
              setFeatureCards={setDashboardFeatureCards}
              huntShowcases={dashboardHuntShowcases}
              setHuntShowcases={setDashboardHuntShowcases}
              testimonials={dashboardTestimonials}
              setTestimonials={setDashboardTestimonials}
              specialSections={dashboardSpecialSections}
              setSpecialSections={setDashboardSpecialSections}
              partnerLogos={dashboardPartnerLogos}
              setPartnerLogos={setDashboardPartnerLogos}
              contactEnabled={dashboardContactEnabled}
              setContactEnabled={setDashboardContactEnabled}
              contactEmail={dashboardContactEmail}
              setContactEmail={setDashboardContactEmail}
              onSave={handleSaveDashboard}
              saving={savingDashboard}
            />
          )}
        </section>

        {/* Success History Customization */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Past Success Page Customization</h2>
              <p style={{ opacity: 0.7, marginTop: 4 }}>
                Customize the Past Success page with intro text and species photos.
              </p>
            </div>
            <button
              onClick={() => setShowSuccessHistorySection(!showSuccessHistorySection)}
              style={{
                padding: "8px 16px",
                background: showSuccessHistorySection ? "#666" : "#0070f3",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {showSuccessHistorySection ? "Collapse" : "Expand"}
            </button>
          </div>

          {showSuccessHistorySection && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Available Species List - First step: configure which species you offer */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Available Species</h3>
                <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>
                  Customize which species your outfitter offers. Different states have different animals available. 
                  This list is used throughout the system (calendar, contracts, success history, etc.).
                </p>
                
                {/* Current Species List */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {availableSpecies.map((species, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 10,
                          background: "#f9fafb",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <span style={{ flex: 1, fontWeight: 600 }}>{species}</span>
                        <button
                          onClick={() => {
                            const updated = availableSpecies.filter((_, i) => i !== index);
                            setAvailableSpecies(updated);
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "transparent",
                            border: "1px solid #ef4444",
                            color: "#ef4444",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Species */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={newSpeciesName}
                    onChange={(e) => setNewSpeciesName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSpeciesName.trim()) {
                        e.preventDefault();
                        if (!availableSpecies.includes(newSpeciesName.trim())) {
                          setAvailableSpecies([...availableSpecies, newSpeciesName.trim()]);
                          setNewSpeciesName("");
                        }
                      }
                    }}
                    style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                    placeholder="Enter species name (e.g., Moose, Pronghorn, etc.)"
                  />
                  <button
                    onClick={() => {
                      if (newSpeciesName.trim() && !availableSpecies.includes(newSpeciesName.trim())) {
                        setAvailableSpecies([...availableSpecies, newSpeciesName.trim()]);
                        setNewSpeciesName("");
                      }
                    }}
                    disabled={!newSpeciesName.trim() || availableSpecies.includes(newSpeciesName.trim())}
                    style={{
                      padding: "10px 20px",
                      background: newSpeciesName.trim() && !availableSpecies.includes(newSpeciesName.trim()) ? "#059669" : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: newSpeciesName.trim() && !availableSpecies.includes(newSpeciesName.trim()) ? "pointer" : "not-allowed",
                      fontWeight: 600,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Intro Text */}
              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Intro Text (appears above species photos)
                </label>
                <textarea
                  value={successHistoryIntroText}
                  onChange={(e) => setSuccessHistoryIntroText(e.target.value)}
                  rows={4}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                  placeholder="View real harvests from hunts in the same units, with the same weapons, and same species. This helps you see what's possible before booking."
                />
                <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  This text appears at the top of the Past Success page, above the species photo gallery.
                </p>
              </div>

              {/* Species Photos */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Species Photos</h3>
                <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
                  Add photos for each species. These will appear as clickable cards that filter the success records.
                  You can enter a URL or browse your photo library to select from uploaded photos.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                  {availableSpecies.map((species) => (
                    <div key={species} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
                      <SpeciesPhotoPicker
                        species={species}
                        currentUrl={successHistorySpeciesPhotos[species] || ""}
                        onSelect={(url) => {
                          setSuccessHistorySpeciesPhotos({
                            ...successHistorySpeciesPhotos,
                            [species]: url,
                          });
                        }}
                        onRemove={() => {
                          const updated = { ...successHistorySpeciesPhotos };
                          delete updated[species];
                          setSuccessHistorySpeciesPhotos(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={handleSaveSpecies}
                  disabled={savingSpecies}
                  style={{
                    padding: "12px 24px",
                    background: "#0070f3",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: savingSpecies ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {savingSpecies ? "Saving..." : "Save Species List"}
                </button>
                <button
                  onClick={handleSaveSuccessHistory}
                  disabled={savingSuccessHistory}
                  style={{
                    padding: "12px 24px",
                    background: "#059669",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: savingSuccessHistory ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {savingSuccessHistory ? "Saving..." : "Save Success History Settings"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Year Closeout Section */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Year Closeout</h2>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            Export year snapshot and archive/reset documents for a new year. This will export all Clients, Guides, and Pre-Draw Contracts to CSV/JSON files, then clear client/guide documents so you can start fresh. Client & guide logins remain.
          </p>
          <YearCloseoutSection />
        </section>

        {/* Pre-Draw Export Section */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Export Pre-Draw Applications</h2>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            Export all clients who selected "I authorize G3 to submit" into a CSV (Excel) with all Pre-Draw contract + license fields and the $75 fee applied where relevant.
          </p>
          <PreDrawExportSection />
        </section>

        {/* Account Section */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Account</h2>
          <p style={{ opacity: 0.7 }}>Account settings and preferences coming soon.</p>
        </section>
      </div>
    </main>
  );
}

// Year Closeout Component
function YearCloseoutSection() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/year-closeout?year=${year}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Export failed");
      }

      // Download all files
      for (const [key, file] of Object.entries(data.files)) {
        const fileData = file as { filename: string; content: string; mimeType: string };
        const blob = new Blob([Uint8Array.from(atob(fileData.content), c => c.charCodeAt(0))], { type: fileData.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileData.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setMessage(`Exported ${Object.keys(data.files).length} files successfully.`);
    } catch (error: any) {
      setMessage(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleArchiveAndReset = async () => {
    if (!confirm("Close Out Year? This will export all data first, then clear client/guide documents so you can start fresh. Client & guide logins remain.")) {
      return;
    }

    setResetting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/year-closeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(year) }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Archive & reset failed");
      }

      // Download all files
      for (const [key, file] of Object.entries(data.files)) {
        const fileData = file as { filename: string; content: string; mimeType: string };
        const blob = new Blob([Uint8Array.from(atob(fileData.content), c => c.charCodeAt(0))], { type: fileData.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileData.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setMessage(`Archived and reset complete. ${Object.keys(data.files).length} files downloaded.`);
    } catch (error: any) {
      setMessage(`Archive & reset failed: ${error.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Year to Close</label>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          style={{ width: 200, padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
        />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleExport}
          disabled={exporting || resetting}
          style={{
            padding: "12px 24px",
            background: exporting ? "#999" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: exporting || resetting ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {exporting ? "Exporting…" : "Export Year Snapshot (CSV + JSON)"}
        </button>

        <button
          onClick={handleArchiveAndReset}
          disabled={exporting || resetting}
          style={{
            padding: "12px 24px",
            background: resetting ? "#999" : "#dc2626",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: exporting || resetting ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {resetting ? "Archiving…" : "Close Out Year (Archive & Reset Documents)"}
        </button>
      </div>

      {message && (
        <p style={{ 
          padding: 12, 
          background: message.includes("failed") ? "#fee2e2" : "#dcfce7", 
          color: message.includes("failed") ? "#991b1b" : "#166534",
          borderRadius: 6,
          margin: 0
        }}>
          {message}
        </p>
      )}
    </div>
  );
}

// Pre-Draw Export Component
function PreDrawExportSection() {
  const [exporting, setExporting] = useState(false);
  const [exportCount, setExportCount] = useState(0);
  const [message, setMessage] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/export-predraw");
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Export failed");
      }

      // Download file
      const fileData = data.file as { filename: string; content: string; mimeType: string };
      const blob = new Blob([Uint8Array.from(atob(fileData.content), c => c.charCodeAt(0))], { type: fileData.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportCount(data.count);
      setMessage(`Exported ${data.count} authorized G3 applications successfully.`);
    } catch (error: any) {
      setMessage(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          padding: "12px 24px",
          background: exporting ? "#999" : "#059669",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: exporting ? "not-allowed" : "pointer",
          fontWeight: 600,
          alignSelf: "flex-start",
        }}
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </button>

      {exportCount > 0 && (
        <p style={{ color: "#666", margin: 0 }}>
          {exportCount} records exported.
        </p>
      )}

      {message && (
        <p style={{ 
          padding: 12, 
          background: message.includes("failed") ? "#fee2e2" : "#dcfce7", 
          color: message.includes("failed") ? "#991b1b" : "#166534",
          borderRadius: 6,
          margin: 0
        }}>
          {message}
        </p>
      )}
    </div>
  );
}

// Dashboard Customization Form Component
function DashboardCustomizationForm({
  heroTitle,
  setHeroTitle,
  heroSubtitle,
  setHeroSubtitle,
  heroImageUrl,
  setHeroImageUrl,
  welcomeText,
  setWelcomeText,
  ctaPrimaryText,
  setCtaPrimaryText,
  ctaPrimaryUrl,
  setCtaPrimaryUrl,
  ctaSecondaryText,
  setCtaSecondaryText,
  ctaSecondaryUrl,
  setCtaSecondaryUrl,
  featureCards,
  setFeatureCards,
  huntShowcases,
  setHuntShowcases,
  testimonials,
  setTestimonials,
  specialSections,
  setSpecialSections,
  partnerLogos,
  setPartnerLogos,
  contactEnabled,
  setContactEnabled,
  contactEmail,
  setContactEmail,
  onSave,
  saving,
}: {
  heroTitle: string;
  setHeroTitle: (v: string) => void;
  heroSubtitle: string;
  setHeroSubtitle: (v: string) => void;
  heroImageUrl: string;
  setHeroImageUrl: (v: string) => void;
  welcomeText: string;
  setWelcomeText: (v: string) => void;
  ctaPrimaryText: string;
  setCtaPrimaryText: (v: string) => void;
  ctaPrimaryUrl: string;
  setCtaPrimaryUrl: (v: string) => void;
  ctaSecondaryText: string;
  setCtaSecondaryText: (v: string) => void;
  ctaSecondaryUrl: string;
  setCtaSecondaryUrl: (v: string) => void;
  featureCards: Array<{ title: string; description: string; icon?: string; href: string }>;
  setFeatureCards: (v: Array<{ title: string; description: string; icon?: string; href: string }>) => void;
  huntShowcases: Array<{ title: string; imageUrl?: string; href: string }>;
  setHuntShowcases: (v: Array<{ title: string; imageUrl?: string; href: string }>) => void;
  testimonials: Array<{ name: string; location: string; text: string; imageUrl?: string }>;
  setTestimonials: (v: Array<{ name: string; location: string; text: string; imageUrl?: string }>) => void;
  specialSections: Array<{ title: string; description: string; imageUrl?: string; href?: string; buttonText?: string }>;
  setSpecialSections: (v: Array<{ title: string; description: string; imageUrl?: string; href?: string; buttonText?: string }>) => void;
  partnerLogos: Array<{ name: string; logoUrl: string; href?: string }>;
  setPartnerLogos: (v: Array<{ name: string; logoUrl: string; href?: string }>) => void;
  contactEnabled: boolean;
  setContactEnabled: (v: boolean) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Hero Section */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Hero Section</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Hero Title</label>
            <input
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Premier Hunting Outfitter in New Mexico & Arizona"
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Hero Subtitle</label>
            <textarea
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Welcome to G3 Outfitters, your premier hunting outfitter..."
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Hero Background Image URL (optional)</label>
            <input
              type="url"
              value={heroImageUrl}
              onChange={(e) => setHeroImageUrl(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="https://example.com/hero-image.jpg"
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Welcome Text (below hero section)</label>
            <textarea
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Additional welcome message or description that appears below the hero section..."
            />
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              This text appears in a card below the hero section, before feature cards.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Buttons */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Call-to-Action Buttons</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Primary Button Text</label>
            <input
              type="text"
              value={ctaPrimaryText}
              onChange={(e) => setCtaPrimaryText(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Book a Hunt"
            />
            <input
              type="url"
              value={ctaPrimaryUrl}
              onChange={(e) => setCtaPrimaryUrl(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, marginTop: 8 }}
              placeholder="URL (e.g., /book-a-hunt)"
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Secondary Button Text</label>
            <input
              type="text"
              value={ctaSecondaryText}
              onChange={(e) => setCtaSecondaryText(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              placeholder="Contact Us"
            />
            <input
              type="url"
              value={ctaSecondaryUrl}
              onChange={(e) => setCtaSecondaryUrl(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, marginTop: 8 }}
              placeholder="URL (e.g., /contact)"
            />
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <EditableArraySection
        title="Feature Cards"
        items={featureCards}
        onItemsChange={setFeatureCards}
        renderItem={(item, index, onUpdate, onDelete) => (
          <div key={index} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Feature Card {index + 1}</strong>
              <button onClick={onDelete} style={{ padding: "4px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                Delete
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                placeholder="Title (e.g., Book a Hunt)"
                value={item.title}
                onChange={(e) => onUpdate({ ...item, title: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <textarea
                placeholder="Description"
                value={item.description}
                onChange={(e) => onUpdate({ ...item, description: e.target.value })}
                rows={2}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="text"
                placeholder="Icon (emoji, e.g., 🎯)"
                value={item.icon || ""}
                onChange={(e) => onUpdate({ ...item, icon: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="text"
                placeholder="Link URL (e.g., /client/calendar)"
                value={item.href}
                onChange={(e) => onUpdate({ ...item, href: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>
        )}
        defaultItem={{ title: "", description: "", icon: "", href: "" }}
      />

      {/* Hunt Showcases */}
      <EditableArraySection
        title="Hunt Showcases"
        items={huntShowcases}
        onItemsChange={setHuntShowcases}
        renderItem={(item, index, onUpdate, onDelete) => (
          <div key={index} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Hunt Showcase {index + 1}</strong>
              <button onClick={onDelete} style={{ padding: "4px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                Delete
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                placeholder="Title (e.g., Arizona Trophy Elk Hunts)"
                value={item.title}
                onChange={(e) => onUpdate({ ...item, title: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="url"
                placeholder="Image URL"
                value={item.imageUrl || ""}
                onChange={(e) => onUpdate({ ...item, imageUrl: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="text"
                placeholder="Link URL"
                value={item.href}
                onChange={(e) => onUpdate({ ...item, href: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>
        )}
        defaultItem={{ title: "", imageUrl: "", href: "" }}
      />

      {/* Testimonials */}
      <EditableArraySection
        title="Client Testimonials"
        items={testimonials}
        onItemsChange={setTestimonials}
        renderItem={(item, index, onUpdate, onDelete) => (
          <div key={index} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Testimonial {index + 1}</strong>
              <button onClick={onDelete} style={{ padding: "4px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                Delete
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                placeholder="Testimonial text"
                value={item.text}
                onChange={(e) => onUpdate({ ...item, text: e.target.value })}
                rows={3}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="text"
                placeholder="Client Name"
                value={item.name}
                onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="text"
                placeholder="Location (e.g., Missouri)"
                value={item.location}
                onChange={(e) => onUpdate({ ...item, location: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="url"
                placeholder="Photo URL (optional)"
                value={item.imageUrl || ""}
                onChange={(e) => onUpdate({ ...item, imageUrl: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>
        )}
        defaultItem={{ name: "", location: "", text: "", imageUrl: "" }}
      />

      {/* Special Sections */}
      <EditableArraySection
        title="Special Sections (e.g., Exotics, Predator Hunts)"
        items={specialSections}
        onItemsChange={setSpecialSections}
        renderItem={(item, index, onUpdate, onDelete) => (
          <div key={index} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Special Section {index + 1}</strong>
              <button onClick={onDelete} style={{ padding: "4px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                Delete
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                placeholder="Title (e.g., Hunt Exotics with Us)"
                value={item.title}
                onChange={(e) => onUpdate({ ...item, title: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <textarea
                placeholder="Description"
                value={item.description}
                onChange={(e) => onUpdate({ ...item, description: e.target.value })}
                rows={3}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="url"
                placeholder="Image URL"
                value={item.imageUrl || ""}
                onChange={(e) => onUpdate({ ...item, imageUrl: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="text"
                placeholder="Button Text (e.g., Learn More)"
                value={item.buttonText || ""}
                onChange={(e) => onUpdate({ ...item, buttonText: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="text"
                placeholder="Link URL"
                value={item.href || ""}
                onChange={(e) => onUpdate({ ...item, href: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>
        )}
        defaultItem={{ title: "", description: "", imageUrl: "", href: "", buttonText: "" }}
      />

      {/* Partner Logos */}
      <EditableArraySection
        title="Partner Logos"
        items={partnerLogos}
        onItemsChange={setPartnerLogos}
        renderItem={(item, index, onUpdate, onDelete) => (
          <div key={index} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Partner {index + 1}</strong>
              <button onClick={onDelete} style={{ padding: "4px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                Delete
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                placeholder="Partner Name"
                value={item.name}
                onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="url"
                placeholder="Logo URL"
                value={item.logoUrl}
                onChange={(e) => onUpdate({ ...item, logoUrl: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <input
                type="url"
                placeholder="Partner Website URL (optional)"
                value={item.href || ""}
                onChange={(e) => onUpdate({ ...item, href: e.target.value })}
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>
        )}
        defaultItem={{ name: "", logoUrl: "", href: "" }}
      />

      {/* Contact Form */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Contact Form</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={contactEnabled}
              onChange={(e) => setContactEnabled(e.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>Enable contact form on dashboard</span>
          </label>
          {contactEnabled && (
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="contact@youroutfitter.com"
              />
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                Contact form submissions will be sent to this email address.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          padding: "12px 24px",
          background: "#059669",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: saving ? "not-allowed" : "pointer",
          fontWeight: 600,
          alignSelf: "flex-start",
        }}
      >
        {saving ? "Saving..." : "Save Dashboard Customization"}
      </button>
    </div>
  );
}

// Reusable component for editable arrays
function EditableArraySection<T extends Record<string, any>>({
  title,
  items,
  onItemsChange,
  renderItem,
  defaultItem,
}: {
  title: string;
  items: T[];
  onItemsChange: (items: T[]) => void;
  renderItem: (item: T, index: number, onUpdate: (item: T) => void, onDelete: () => void) => React.ReactNode;
  defaultItem: T;
}) {
  function addItem() {
    onItemsChange([...items, { ...defaultItem }]);
  }

  function updateItem(index: number, updatedItem: T) {
    const newItems = [...items];
    newItems[index] = updatedItem;
    onItemsChange(newItems);
  }

  function deleteItem(index: number) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <button
          onClick={addItem}
          style={{
            padding: "8px 16px",
            background: "#059669",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add {title.slice(0, -1)}
        </button>
      </div>
      {items.length === 0 ? (
        <p style={{ opacity: 0.6, fontStyle: "italic" }}>No {title.toLowerCase()} added yet. Click "Add" to create one.</p>
      ) : (
        items.map((item, index) => renderItem(item, index, (updated) => updateItem(index, updated), () => deleteItem(index)))
      )}
    </div>
  );
}
