"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function ClientSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outfitterCode, setOutfitterCode] = useState("");

  // Client Info
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("USA");
  const [cellPhone, setCellPhone] = useState("");
  const [homePhone, setHomePhone] = useState("");
  const [email, setEmail] = useState("");
  const [occupation, setOccupation] = useState("");

  // Login
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validation
    if (!clientName.trim()) {
      setError("Full name is required");
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
      const res = await fetch("/api/auth/signup-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName,
          address,
          city,
          state,
          zip,
          country,
          cell_phone: cellPhone,
          home_phone: homePhone,
          email: email.toLowerCase().trim(),
          occupation,
          password,
          outfitter_code: outfitterCode.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Success - redirect to login or client portal
      router.push("/login?message=Account created successfully. Please log in.");
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 600, width: "100%", background: "white", padding: "40px", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
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
          <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Create Client Account</h1>
          <p style={{ color: "#666" }}>Sign up to access your hunt management portal</p>
        </div>

        {error && (
          <div style={{ background: "#ffebee", color: "#c62828", padding: 12, borderRadius: 6, marginBottom: 24 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
          {/* Outfitter Code */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Outfitter Code <span style={{ color: "#999", fontSize: 14, fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              type="text"
              name="outfitter-code"
              autoComplete="off"
              value={outfitterCode}
              onChange={(e) => setOutfitterCode(e.target.value)}
              placeholder="Enter your outfitter's code if you have one"
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
            <p style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
              If your outfitter gave you a code, enter it here to link your account.
            </p>
          </div>

          <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Contact Information</h2>
          </div>

          {/* Full Name */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Full Name <span style={{ color: "#c62828" }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Email <span style={{ color: "#c62828" }}>*</span>
            </label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* Phones */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Cell Phone</label>
              <input
                type="tel"
                name="tel"
                autoComplete="tel"
                value={cellPhone}
                onChange={(e) => setCellPhone(e.target.value)}
                placeholder="(555) 123-4567"
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Home Phone</label>
              <input
                type="tel"
                name="tel-national"
                autoComplete="tel-national"
                value={homePhone}
                onChange={(e) => setHomePhone(e.target.value)}
                placeholder="(555) 123-4567"
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Street Address</label>
            <input
              type="text"
              name="street-address"
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* City, State, Zip */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>City</label>
              <input
                type="text"
                name="address-level2"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>State</label>
              <input
                type="text"
                name="address-level1"
                autoComplete="address-level1"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="NM"
                maxLength={2}
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>ZIP</label>
              <input
                type="text"
                name="postal-code"
                autoComplete="postal-code"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="87501"
                style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Country</label>
            <input
              type="text"
              name="country"
              autoComplete="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          {/* Occupation */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Occupation</label>
            <input
              type="text"
              name="organization-title"
              autoComplete="organization-title"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              style={{ width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
            />
          </div>

          <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Account Password</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
              This password is for logging into your account (not your NMDGF account).
            </p>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Password <span style={{ color: "#c62828" }}>*</span>
            </label>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
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
              name="confirm-password"
              autoComplete="new-password"
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
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, color: "#666" }}>
          Already have an account? <Link href="/login" style={{ color: "#1a472a", fontWeight: 500 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
