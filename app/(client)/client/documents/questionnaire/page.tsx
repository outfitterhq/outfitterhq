"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface QuestionnaireData {
  full_name: string;
  mailing_address: string;
  contact_phone: string;
  email: string;
  dob: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  global_rescue_member_number: string;
  food_allergies: string;
  food_preferences: string;
  drink_preferences: string;
  specific_accommodation: string;
  physical_limitations: string;
  health_concerns: string;
  general_notes: string;
}

const defaultData: QuestionnaireData = {
  full_name: "",
  mailing_address: "",
  contact_phone: "",
  email: "",
  dob: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  global_rescue_member_number: "",
  food_allergies: "",
  food_preferences: "",
  drink_preferences: "",
  specific_accommodation: "",
  physical_limitations: "",
  health_concerns: "",
  general_notes: "",
};

export default function QuestionnairePage() {
  const router = useRouter();
  const [data, setData] = useState<QuestionnaireData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isExisting, setIsExisting] = useState(false);

  useEffect(() => {
    loadExisting();
  }, []);

  async function loadExisting() {
    try {
      const res = await fetch("/api/client/questionnaire");
      let merged = { ...defaultData };
      if (res.ok) {
        const json = await res.json();
        if (json.questionnaire) {
          merged = {
            full_name: json.questionnaire.full_name || "",
            mailing_address: json.questionnaire.mailing_address || "",
            contact_phone: json.questionnaire.contact_phone || "",
            email: json.questionnaire.email || "",
            dob: json.questionnaire.dob || "",
            emergency_contact_name: json.questionnaire.emergency_contact_name || "",
            emergency_contact_phone: json.questionnaire.emergency_contact_phone || "",
            global_rescue_member_number: json.questionnaire.global_rescue_member_number || "",
            food_allergies: json.questionnaire.food_allergies || "",
            food_preferences: json.questionnaire.food_preferences || "",
            drink_preferences: json.questionnaire.drink_preferences || "",
            specific_accommodation: json.questionnaire.specific_accommodation || "",
            physical_limitations: json.questionnaire.physical_limitations || "",
            health_concerns: json.questionnaire.health_concerns || "",
            general_notes: json.questionnaire.general_notes || "",
          };
          setIsExisting(true);
        }
      }
      // Auto-fill empty fields from client profile (like iOS autoFillFromAccount)
      const profileRes = await fetch("/api/client/profile");
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (!merged.full_name?.trim() && profile.full_name) merged.full_name = profile.full_name;
        if (!merged.email?.trim() && profile.email) merged.email = profile.email;
        if (!merged.contact_phone?.trim() && profile.phone) merged.contact_phone = profile.phone;
        if (!merged.mailing_address?.trim() && profile.mailing_address) merged.mailing_address = profile.mailing_address;
        if (!merged.dob && profile.date_of_birth) merged.dob = profile.date_of_birth;
      }
      setData(merged);
    } catch (e) {
      console.error("Failed to load existing questionnaire:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof QuestionnaireData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate required fields
    if (!data.full_name.trim()) {
      setError("Full name is required");
      return;
    }
    if (!data.contact_phone.trim()) {
      setError("Contact phone is required");
      return;
    }
    if (!data.email.trim()) {
      setError("Email is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/client/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save questionnaire");
      }

      setSuccess(true);
      setIsExisting(true);
      
      // Redirect after a moment
      setTimeout(() => {
        router.push("/client/documents");
      }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/documents"
          style={{ color: "var(--client-accent, #1a472a)", textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Documents
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Pre-Hunt Questionnaire
        </h1>
        <p style={{ color: "#666" }}>
          Please fill out this form with your information. This helps us prepare for your hunt
          and ensure your safety and comfort.
        </p>
        {isExisting && (
          <p style={{ color: "var(--client-accent, #1a472a)", fontWeight: 500, marginTop: 8 }}>
            You've already submitted this form. You can update your information below.
          </p>
        )}
      </div>

      {success && (
        <div
          style={{
            background: "#e8f5e9",
            color: "#2e7d32",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          Questionnaire saved successfully! Redirecting...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Contact Information */}
        <FormSection title="Contact Information">
          <FormRow>
            <FormField
              label="Full Name"
              required
              value={data.full_name}
              onChange={(v) => handleChange("full_name", v)}
              placeholder="John Smith"
              autoComplete="name"
            />
            <FormField
              label="Email"
              type="email"
              required
              value={data.email}
              onChange={(v) => handleChange("email", v)}
              placeholder="john@example.com"
              autoComplete="email"
            />
          </FormRow>
          <FormRow>
            <FormField
              label="Contact Phone"
              type="tel"
              required
              value={data.contact_phone}
              onChange={(v) => handleChange("contact_phone", v)}
              placeholder="(555) 123-4567"
              autoComplete="tel"
            />
            <FormField
              label="Date of Birth"
              type="date"
              value={data.dob}
              onChange={(v) => handleChange("dob", v)}
              autoComplete="bday"
            />
          </FormRow>
          <FormField
            label="Mailing Address"
            value={data.mailing_address}
            onChange={(v) => handleChange("mailing_address", v)}
            placeholder="123 Main St, City, State 12345"
            fullWidth
            autoComplete="street-address"
          />
        </FormSection>

        {/* Emergency Contact */}
        <FormSection title="Emergency Contact">
          <FormRow>
            <FormField
              label="Emergency Contact Name"
              value={data.emergency_contact_name}
              onChange={(v) => handleChange("emergency_contact_name", v)}
              placeholder="Jane Smith"
              autoComplete="name"
            />
            <FormField
              label="Emergency Contact Phone"
              type="tel"
              value={data.emergency_contact_phone}
              onChange={(v) => handleChange("emergency_contact_phone", v)}
              placeholder="(555) 987-6543"
              autoComplete="tel"
            />
          </FormRow>
          <FormField
            label="Global Rescue Member Number"
            value={data.global_rescue_member_number}
            onChange={(v) => handleChange("global_rescue_member_number", v)}
            placeholder="Optional - if you have membership"
            hint="Global Rescue provides emergency evacuation services"
            fullWidth
          />
        </FormSection>

        {/* Food & Beverage Preferences */}
        <FormSection title="Food & Beverage Preferences">
          <FormField
            label="Food Allergies"
            value={data.food_allergies}
            onChange={(v) => handleChange("food_allergies", v)}
            placeholder="List any food allergies..."
            multiline
            fullWidth
          />
          <FormField
            label="Food Preferences"
            value={data.food_preferences}
            onChange={(v) => handleChange("food_preferences", v)}
            placeholder="Dietary preferences, restrictions, favorites..."
            multiline
            fullWidth
          />
          <FormField
            label="Drink Preferences"
            value={data.drink_preferences}
            onChange={(v) => handleChange("drink_preferences", v)}
            placeholder="Coffee, tea, water preferences..."
            hint="Note: Alcoholic beverages are not provided"
            multiline
            fullWidth
          />
        </FormSection>

        {/* Health & Accommodations */}
        <FormSection title="Health & Accommodations">
          <FormField
            label="Specific Accommodations Needed"
            value={data.specific_accommodation}
            onChange={(v) => handleChange("specific_accommodation", v)}
            placeholder="Any specific lodging or accessibility needs..."
            multiline
            fullWidth
          />
          <FormField
            label="Physical Limitations"
            value={data.physical_limitations}
            onChange={(v) => handleChange("physical_limitations", v)}
            placeholder="Any mobility issues, injuries, or physical limitations we should know about..."
            multiline
            fullWidth
          />
          <FormField
            label="Health Concerns"
            value={data.health_concerns}
            onChange={(v) => handleChange("health_concerns", v)}
            placeholder="Medical conditions, medications, or health concerns..."
            multiline
            fullWidth
          />
        </FormSection>

        {/* General Notes */}
        <FormSection title="Additional Information">
          <FormField
            label="General Notes"
            value={data.general_notes}
            onChange={(v) => handleChange("general_notes", v)}
            placeholder="Anything else you'd like us to know..."
            multiline
            fullWidth
          />
        </FormSection>

        {/* Submit Button */}
        <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "14px 32px",
              background: saving ? "#ccc" : "var(--client-accent, #1a472a)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : isExisting ? "Update Questionnaire" : "Submit Questionnaire"}
          </button>
          <Link
            href="/client/documents"
            style={{
              padding: "14px 24px",
              background: "white",
              color: "#666",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontSize: 16,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--client-accent, #1a472a)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  fullWidth?: boolean;
  hint?: string;
  autoComplete?: string;
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  multiline,
  fullWidth,
  hint,
  autoComplete,
}: FormFieldProps) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 15,
    border: "1px solid #ddd",
    borderRadius: 6,
    outline: "none",
  };

  return (
    <div style={{ marginBottom: fullWidth ? 16 : 0 }}>
      <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
        {label}
        {required && <span style={{ color: "#c62828", marginLeft: 4 }}>*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          autoComplete={autoComplete}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={inputStyle}
          autoComplete={autoComplete}
        />
      )}
      {hint && (
        <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{hint}</p>
      )}
    </div>
  );
}
