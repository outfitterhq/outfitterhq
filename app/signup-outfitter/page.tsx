"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function OutfitterSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Outfitter Business Info
  const [outfitterName, setOutfitterName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [businessZip, setBusinessZip] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  // Owner/Admin Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Login
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validation
    if (!outfitterName.trim()) {
      setError("Outfitter name is required");
      setLoading(false);
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outfitter_name: outfitterName,
          business_address: businessAddress,
          business_city: businessCity,
          business_state: businessState,
          business_zip: businessZip,
          business_phone: businessPhone,
          business_email: businessEmail,
          website,
          description,
          first_name: firstName,
          last_name: lastName,
          email: email.toLowerCase().trim(),
          phone,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Success - redirect to login
      router.push("/login?message=Outfitter account created successfully. Please log in.");
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 700, width: "100%", background: "white", padding: "40px", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <Link href="/" style={{ display: "inline-block", textDecoration: "none", marginBottom: 16 }}>
            <Image
              src="/outfitterhq-logo.png"
              alt="Outfitter HQ"
              width={200}
              height={67}
              style={{ height: "auto", maxHeight: "60px", width: "auto" }}
              priority
            />
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Create Outfitter Account</h1>
          <p style={{ color: "#666" }}>Set up your outfitting business on the platform</p>
        </div>

        {error && (
          <div style={{ background: "#ffebee", color: "#c62828", padding: 12, borderRadius: 6, marginBottom: 24 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Business Information</h2>
          </div>

          {/* Outfitter Name */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Outfitter/Business Name <span style={{ color: "#c62828" }}>*</span>
            </label>
            <input
              type="text"
              value={outfitterName}
              onChange={(e) => setOutfitterName(e.target.value)}
              required
              placeholder="Your Outfitter Name"
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* Business Address */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Business Address</label>
            <input
              type="text"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="123 Main Street"
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* City, State, Zip */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>City</label>
              <input
                type="text"
                value={businessCity}
                onChange={(e) => setBusinessCity(e.target.value)}
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>State</label>
              <input
                type="text"
                value={businessState}
                onChange={(e) => setBusinessState(e.target.value)}
                placeholder="NM"
                maxLength={2}
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>ZIP</label>
              <input
                type="text"
                value={businessZip}
                onChange={(e) => setBusinessZip(e.target.value)}
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
          </div>

          {/* Business Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Business Phone</label>
              <input
                type="tel"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="(555) 123-4567"
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Business Email</label>
              <input
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="info@outfitter.com"
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.outfitter.com"
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Business Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your outfitting business..."
              rows={4}
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit" }}
            />
          </div>

          <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Owner/Admin Information</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
              This will be the primary admin account for your outfitter business.
            </p>
          </div>

          {/* Owner Name */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
          </div>

          {/* Owner Contact */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Email <span style={{ color: "#c62828" }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
            <p style={{ marginTop: 4, fontSize: 12, color: "#666" }}>This will be your login email.</p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Account Password</h2>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Password <span style={{ color: "#c62828" }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Confirm Password <span style={{ color: "#c62828" }}>*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#ccc" : "#1a472a",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 8,
            }}
          >
            {loading ? "Creating Account..." : "Create Outfitter Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, color: "#666" }}>
          Already have an account? <Link href="/login" style={{ color: "#1a472a", fontWeight: 500 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
