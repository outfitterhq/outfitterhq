"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEAPON_TYPES } from "@/lib/types/hunt-closeout";

export default function ManualSuccessEntryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [huntTitle, setHuntTitle] = useState("");
  const [guideUsername, setGuideUsername] = useState("");
  const [species, setSpecies] = useState("");
  const [weapon, setWeapon] = useState("");
  const [unit, setUnit] = useState("");
  const [state, setState] = useState("");
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear().toString());
  const [successSummary, setSuccessSummary] = useState("");
  const [animalQualityNotes, setAnimalQualityNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoCategories, setPhotoCategories] = useState<Record<number, string>>({});
  const [photoMarketing, setPhotoMarketing] = useState<Record<number, boolean>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Ensure outfitter is selected (cookie name is hc_outfitter; API also checks server-side)
      const checkRes = await fetch("/api/outfitter");
      if (!checkRes.ok) {
        const err = await checkRes.json().catch(() => ({}));
        throw new Error(err.error || "No outfitter selected. Please select an outfitter from the menu first.");
      }

      // Create a dummy hunt_id (we'll create a calendar event for this)
      const huntId = crypto.randomUUID();

      // Create FormData for closeout submission
      const formData = new FormData();
      formData.append("hunt_id", huntId);
      formData.append("harvested", "true");
      formData.append("species", species);
      formData.append("weapon", weapon);
      formData.append("unit", unit);
      formData.append("state", state);
      formData.append("season_year", seasonYear);
      formData.append("guide_username", guideUsername);
      formData.append("success_summary", successSummary);
      formData.append("animal_quality_notes", animalQualityNotes);
      formData.append("is_manual_entry", "true");

      // Add photos (API expects photo_0_category, photo_0_approved_for_marketing, etc.)
      photos.forEach((photo, index) => {
        formData.append("photos", photo);
        formData.append(`photo_${index}_category`, photoCategories[index] || "Harvest");
        formData.append(`photo_${index}_approved_for_marketing`, photoMarketing[index] ? "true" : "false");
      });

      // First, create a calendar event for this manual entry
      const eventRes = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: huntTitle || `${species} - Unit ${unit}`,
          start_date: new Date(parseInt(seasonYear), 0, 1).toISOString(),
          end_date: new Date(parseInt(seasonYear), 11, 31).toISOString(),
          guide_username: guideUsername,
          species: species,
          unit: unit,
          weapon: weapon,
          status: "Closed",
          audience: "internalOnly", // Manual entries are internal only
        }),
      });

      if (!eventRes.ok) {
        const data = await eventRes.json();
        throw new Error(data.error || "Failed to create calendar event");
      }

      const eventData = await eventRes.json();
      const actualHuntId = eventData.event.id;

      // Update formData with actual hunt_id
      formData.set("hunt_id", actualHuntId);

      // Submit closeout
      const res = await fetch(`/api/hunts/${actualHuntId}/closeout`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create success record");
      }

      router.push("/success-library");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setPhotos([...photos, ...files]);
    files.forEach((_, index) => {
      const photoIndex = photos.length + index;
      setPhotoCategories((prev) => ({ ...prev, [photoIndex]: "Harvest" }));
      setPhotoMarketing((prev) => ({ ...prev, [photoIndex]: true }));
    });
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index));
    const newCategories = { ...photoCategories };
    const newMarketing = { ...photoMarketing };
    delete newCategories[index];
    delete newMarketing[index];
    // Reindex
    const reindexedCategories: Record<number, string> = {};
    const reindexedMarketing: Record<number, boolean> = {};
    photos.forEach((_, i) => {
      if (i < index) {
        reindexedCategories[i] = photoCategories[i];
        reindexedMarketing[i] = photoMarketing[i];
      } else if (i > index) {
        reindexedCategories[i - 1] = photoCategories[i];
        reindexedMarketing[i - 1] = photoMarketing[i];
      }
    });
    setPhotoCategories(reindexedCategories);
    setPhotoMarketing(reindexedMarketing);
  }

  return (
    <main style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Add Manual Success Record</h1>
      <p style={{ opacity: 0.8, marginBottom: 32 }}>
        Add a past success record manually. This is useful for importing historical data.
      </p>

      {error && (
        <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8, marginBottom: 24 }}>
          <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Hunt Title <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={huntTitle}
            onChange={(e) => setHuntTitle(e.target.value)}
            required
            style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
            placeholder="e.g., Elk Hunt - Unit 15"
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Guide Username <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={guideUsername}
            onChange={(e) => setGuideUsername(e.target.value)}
            required
            style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Species <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              required
              style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
              placeholder="e.g., Elk"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Weapon <span style={{ color: "red" }}>*</span>
            </label>
            <select
              value={weapon}
              onChange={(e) => setWeapon(e.target.value)}
              required
              style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Unit <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              State <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
              style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
              placeholder="e.g., New Mexico"
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Season Year <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="number"
            value={seasonYear}
            onChange={(e) => setSeasonYear(e.target.value)}
            required
            min="2000"
            max={new Date().getFullYear() + 1}
            style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Success Summary
          </label>
          <textarea
            value={successSummary}
            onChange={(e) => setSuccessSummary(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
            placeholder="Brief description of the hunt success..."
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Animal Quality Notes
          </label>
          <textarea
            value={animalQualityNotes}
            onChange={(e) => setAnimalQualityNotes(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
            placeholder="e.g., 6x6 bull, 320+ score"
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Photos (optional for manual entry; add 1–10 for best results)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoAdd}
            style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4 }}
          />
          
          {photos.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {photos.map((photo, index) => (
                <div
                  key={index}
                  style={{
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    display: "flex",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Photo ${index + 1}`}
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 4 }}
                  />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Category</label>
                      <select
                        value={photoCategories[index] || "Harvest"}
                        onChange={(e) =>
                          setPhotoCategories((prev) => ({ ...prev, [index]: e.target.value }))
                        }
                        style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
                      >
                        <option value="Harvest">Harvest</option>
                        <option value="Landscape">Landscape</option>
                        <option value="Camp">Camp</option>
                        <option value="Client + Guide">Client + Guide</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={photoMarketing[index] ?? true}
                        onChange={(e) =>
                          setPhotoMarketing((prev) => ({ ...prev, [index]: e.target.checked }))
                        }
                      />
                      Approved for Marketing
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    style={{
                      padding: "8px 12px",
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: "12px 24px",
              background: "#e5e7eb",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "12px 24px",
              background: isSubmitting ? "#ccc" : "#059669",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isSubmitting ? "Creating..." : "Create Success Record"}
          </button>
        </div>
      </form>
    </main>
  );
}
