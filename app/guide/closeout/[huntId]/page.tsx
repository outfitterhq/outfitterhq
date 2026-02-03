"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { PendingCloseoutHunt, HuntCloseoutInput, HuntPhoto } from "@/lib/types/hunt-closeout";
import { PHOTO_CATEGORIES, WEAPON_TYPES } from "@/lib/types/hunt-closeout";

export default function HuntCloseoutPage() {
  const router = useRouter();
  const params = useParams();
  const huntId = params.huntId as string;

  const [hunt, setHunt] = useState<PendingCloseoutHunt | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [harvested, setHarvested] = useState(false);
  const [species, setSpecies] = useState("");
  const [weapon, setWeapon] = useState<string>("");
  const [unit, setUnit] = useState("");
  const [state, setState] = useState("");
  const [huntDates, setHuntDates] = useState<string[]>([]);
  const [successSummary, setSuccessSummary] = useState("");
  const [animalQualityNotes, setAnimalQualityNotes] = useState("");

  // Photo state
  const [photos, setPhotos] = useState<Array<{
    file: File;
    preview: string;
    category: string;
    approvedForMarketing: boolean;
    isPrivate: boolean;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHuntData();
  }, [huntId]);

  async function loadHuntData() {
    try {
      setLoading(true);
      // Get hunt details from pending closeout list or calendar
      const res = await fetch(`/api/hunts/pending-closeout`);
      if (!res.ok) throw new Error("Failed to load hunts");
      const data = await res.json();
      const foundHunt = data.hunts?.find((h: PendingCloseoutHunt) => h.hunt_id === huntId);
      
      if (!foundHunt) {
        // Try to get from calendar
        const calRes = await fetch(`/api/calendar/${huntId}`);
        if (calRes.ok) {
          const calData = await calRes.json();
          if (calData.event) {
            setHunt({
              hunt_id: calData.event.id,
              hunt_title: calData.event.title,
              client_email: calData.event.client_email,
              species: calData.event.species,
              unit: calData.event.unit,
              weapon: calData.event.weapon,
              start_time: calData.event.start_date,
              end_time: calData.event.end_date,
              days_pending: 0,
            });
            // Pre-fill form from hunt data
            setSpecies(calData.event.species || "");
            setWeapon(calData.event.weapon || "");
            setUnit(calData.event.unit || "");
          }
        } else {
          setError("Hunt not found");
        }
      } else {
        setHunt(foundHunt);
        // Pre-fill form
        setSpecies(foundHunt.species || "");
        setWeapon(foundHunt.weapon || "");
        setUnit(foundHunt.unit || "");
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotos((prev) => [
            ...prev,
            {
              file,
              preview: e.target?.result as string,
              category: "Harvest",
              approvedForMarketing: true,
              isPrivate: false,
            },
          ]);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function handlePhotoRemove(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePhotoUpdate(index: number, field: string, value: any) {
    setPhotos((prev) =>
      prev.map((photo, i) => (i === index ? { ...photo, [field]: value } : photo))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!successSummary.trim()) {
        throw new Error("Success summary is required");
      }
      if (photos.length === 0) {
        throw new Error("At least one photo is required");
      }

      const formData = new FormData();
      formData.append("harvested", harvested.toString());
      if (species) formData.append("species", species);
      if (weapon) formData.append("weapon", weapon);
      if (unit) formData.append("unit", unit);
      if (state) formData.append("state", state);
      if (huntDates.length > 0) formData.append("hunt_dates", JSON.stringify(huntDates));
      formData.append("success_summary", successSummary); // Required field
      if (animalQualityNotes) formData.append("animal_quality_notes", animalQualityNotes);

      // Add photos
      photos.forEach((photo, i) => {
        formData.append("photos", photo.file);
        formData.append(`photo_${i}_category`, photo.category);
        formData.append(`photo_${i}_approved_for_marketing`, photo.approvedForMarketing.toString());
        formData.append(`photo_${i}_is_private`, photo.isPrivate.toString());
      });

      const res = await fetch(`/api/hunts/${huntId}/closeout`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit closeout");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/guide");
      }, 2000);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (error && !hunt) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <p style={{ color: "#dc2626" }}>{error}</p>
        <Link href="/guide" style={{ color: "#059669", textDecoration: "underline" }}>
          ← Back to Guide Portal
        </Link>
      </main>
    );
  }

  if (success) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <div style={{ padding: 24, background: "#d1fae5", borderRadius: 8, marginBottom: 16 }}>
          <h2 style={{ color: "#059669", marginTop: 0 }}>✅ Closeout Submitted Successfully!</h2>
          <p>The hunt has been closed and photos have been uploaded.</p>
        </div>
        <Link href="/guide" style={{ color: "#059669", textDecoration: "underline" }}>
          ← Back to Guide Portal
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/guide" style={{ color: "#059669", textDecoration: "underline" }}>
          ← Back to Guide Portal
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginTop: 16, marginBottom: 8 }}>
          Complete Hunt Closeout
        </h1>
        {hunt && (
          <p style={{ opacity: 0.8, marginBottom: 0 }}>
            {hunt.hunt_title} • {hunt.days_pending} days pending
          </p>
        )}
      </div>

      {error && (
        <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Success Details */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Success Details</h2>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Harvested? <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  checked={harvested === true}
                  onChange={() => setHarvested(true)}
                />
                Yes
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  checked={harvested === false}
                  onChange={() => setHarvested(false)}
                />
                No
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Species</label>
              <input
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="Elk, Deer, etc."
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Weapon</label>
              <select
                value={weapon}
                onChange={(e) => setWeapon(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              >
                <option value="">Select...</option>
                {WEAPON_TYPES.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit number"
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              />
            </div>
          </div>
        </section>

        {/* Hunt Summary */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Hunt Summary</h2>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Success Summary <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              value={successSummary}
              onChange={(e) => setSuccessSummary(e.target.value)}
              placeholder="Brief summary of the hunt..."
              rows={4}
              required
              style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
            />
          </div>

          {harvested && (
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Animal Quality Notes
              </label>
              <input
                type="text"
                value={animalQualityNotes}
                onChange={(e) => setAnimalQualityNotes(e.target.value)}
                placeholder="e.g., 6x6 bull, 320-340 score range"
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              />
            </div>
          )}
        </section>

        {/* Photo Upload */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
            Photos <span style={{ color: "#dc2626" }}>*</span>
          </h2>
          <p style={{ opacity: 0.8, marginBottom: 16 }}>
            Upload at least one photo. Minimum 1, maximum 10 photos.
          </p>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoAdd}
            ref={fileInputRef}
            style={{ display: "none" }}
            id="photo-upload-input"
          />
          <label
            htmlFor="photo-upload-input"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#059669",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            📷 Upload Photos
          </label>

          {photos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {photos.map((photo, index) => (
                <div key={index} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 8 }}>
                  <img
                    src={photo.preview}
                    alt={`Photo ${index + 1}`}
                    style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 4, marginBottom: 8 }}
                  />
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Category</label>
                    <select
                      value={photo.category}
                      onChange={(e) => handlePhotoUpdate(index, "category", e.target.value)}
                      style={{ width: "100%", padding: 4, fontSize: 12, border: "1px solid #ccc", borderRadius: 4 }}
                    >
                      {PHOTO_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={photo.approvedForMarketing}
                        onChange={(e) => handlePhotoUpdate(index, "approvedForMarketing", e.target.checked)}
                      />
                      Marketing
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={photo.isPrivate}
                        onChange={(e) => handlePhotoUpdate(index, "isPrivate", e.target.checked)}
                      />
                      Private
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePhotoRemove(index)}
                    style={{
                      width: "100%",
                      padding: 4,
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Submit */}
        <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" }}>
          <Link
            href="/guide"
            style={{
              padding: "12px 24px",
              border: "1px solid #ccc",
              borderRadius: 8,
              textDecoration: "none",
              color: "#333",
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || photos.length === 0 || !successSummary.trim()}
            style={{
              padding: "12px 24px",
              background: submitting || photos.length === 0 || !successSummary.trim() ? "#ccc" : "#059669",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: submitting || photos.length === 0 || !successSummary.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "Submitting..." : "Submit Closeout"}
          </button>
        </div>
      </form>
    </main>
  );
}
