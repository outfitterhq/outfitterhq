"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AcceptInviteContent() {
  const sp = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  // Support multiple param names (some Supabase flows use token instead of token_hash)
  // Supabase invite links often put tokens in the URL hash fragment, not query params
  const outfitterIdFromUrl = sp.get("outfitter_id") ?? "";
  const [resolvedOutfitterId, setResolvedOutfitterId] = useState(outfitterIdFromUrl);
  const outfitter_id = resolvedOutfitterId || outfitterIdFromUrl;
  
  // Check both query params and hash fragment for type and token
  // Supabase links put tokens in the hash fragment: #access_token=...&type=invite&token_hash=...
  // We'll parse hash in useEffect since it's client-side only
  const [type, setType] = useState(sp.get("type") ?? "");
  const [token_hash, setTokenHash] = useState(sp.get("token_hash") ?? sp.get("token") ?? "");

  const [stage, setStage] = useState<"verifying" | "form" | "saving" | "done" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  // Required-ish for onboarding
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  // Contact
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  // Guide info
  const [notes, setNotes] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  const [hasGuideLicense, setHasGuideLicense] = useState(false);
  const [hasCPRCard, setHasCPRCard] = useState(false);
  const [hasLeaveNoTrace, setHasLeaveNoTrace] = useState(false);

  const canSubmit = fullName.trim().length >= 2 && password.length >= 8 && !!outfitter_id;

  // Parse hash fragment on client side (must be in useEffect)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.substring(1); // Remove #
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        // Hash params take precedence (Supabase puts them there)
        const hashType = hashParams.get("type");
        const hashToken = hashParams.get("token_hash") ?? hashParams.get("token");
        if (hashType) setType(hashType);
        if (hashToken) setTokenHash(hashToken);
        
        // Also check for access_token in hash (Supabase sometimes uses this for direct session)
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          // If we have tokens in hash, set session directly
          console.log("Found access_token and refresh_token in hash - setting session directly");
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(() => {
            console.log("✅ Session set from hash tokens");
          }).catch((err) => {
            console.warn("Failed to set session from hash:", err);
          });
        }
      }
    }
  }, []); // Run once on mount

  useEffect(() => {
    (async () => {
      try {
        setError(null);

        // If outfitter_id missing from URL (e.g. link truncated), try to resolve from user's guide membership
        let effectiveOutfitterId = outfitterIdFromUrl || resolvedOutfitterId;
        if (!effectiveOutfitterId) {
          const { data: session } = await supabase.auth.getSession();
          if (session?.session) {
            const { data: user } = await supabase.auth.getUser();
            if (user?.user) {
              const { data: guideMemberships } = await supabase
                .from("outfitter_memberships")
                .select("outfitter_id")
                .eq("user_id", user.user.id)
                .eq("role", "guide")
                .in("status", ["invited", "active"]);
              const list = (guideMemberships ?? []) as { outfitter_id: string }[];
              if (list.length > 0) {
                effectiveOutfitterId = list[0].outfitter_id;
                setResolvedOutfitterId(effectiveOutfitterId);
              }
            }
          }
        }
        if (!effectiveOutfitterId) {
          throw new Error("Missing outfitter_id in invite link. Please use the full link from your email.");
        }

        // Parse hash once at start so we have token/type for verification (avoids race with
        // separate useEffect that sets state from hash; Supabase puts tokens in #fragment)
        let effectiveToken = token_hash;
        let effectiveType = type;
        if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const hashToken = hashParams.get("token_hash") ?? hashParams.get("token");
          const hashType = hashParams.get("type");
          if (hashToken) effectiveToken = hashToken;
          if (hashType) effectiveType = hashType;
          // Sync session from hash if present (Supabase sometimes puts tokens in hash)
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }).catch((err) => console.warn("Failed to set session from hash:", err));
          }
        }

        // CRITICAL: Supabase invite links only switch sessions if there's no active session
        // If an admin is logged in, we need to sign them out first, then verify the invite
        // This ensures the invite link works regardless of who's logged in
        
        // Check if there's an existing session (admin might be logged in)
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          const { data: existingUser } = await supabase.auth.getUser();
          // If current user is NOT the guide we're inviting, sign them out
          if (existingUser?.user) {
            const { data: existingMembership } = await supabase
              .from("outfitter_memberships")
              .select("role")
              .eq("user_id", existingUser.user.id)
              .eq("outfitter_id", effectiveOutfitterId)
              .eq("role", "guide")
              .maybeSingle();
            
            // If current user is not the guide, sign them out so invite can switch session
            if (!existingMembership || existingMembership.role !== "guide") {
              console.log("Signing out current user to allow invite session switch...");
              await supabase.auth.signOut();
              // Wait a moment for signout to complete
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
        
        // Verify the invite/recovery token - this will switch to the guide session
        // Recovery links work the same as invite links - they switch sessions when verified
        // Use effectiveToken/effectiveType (from hash or state) so we have token on first run
        if (effectiveToken) {
          try {
            // Try the type from URL, or try both if type is unclear
            const typesToTry = effectiveType ? [effectiveType] : ["invite", "recovery"];
            
            let verified = false;
            for (const verifyType of typesToTry) {
              const { data, error: otpErr } = await supabase.auth.verifyOtp({ 
                type: verifyType as "invite" | "recovery", 
                token_hash: effectiveToken 
              });
              
              if (!otpErr) {
                console.log(`✅ Successfully verified ${verifyType} token`);
                verified = true;
                
                // If verifyOtp returned a session, it's already set
                // If not, wait a moment for session to be created
                if (data?.session) {
                  console.log("✅ Session received from verifyOtp");
                  // Wait for session to propagate
                  await new Promise((r) => setTimeout(r, 300));
                } else {
                  console.log("⚠️ No session in verifyOtp response - waiting for session...");
                  // Wait longer for session to be created
                  await new Promise((r) => setTimeout(r, 800));
                }
                break;
              } else {
                console.log(`⚠️ ${verifyType} verification failed:`, otpErr.message);
              }
            }
            
            if (!verified) {
              console.warn("All OTP verification attempts failed, but continuing to check session...");
            }
          } catch (verifyErr) {
            console.warn("OTP verification exception:", verifyErr);
            // Continue - we'll check session below
          }
        } else {
          console.warn("No token found in URL (query or hash) - checking if session is already active...");
        }

        // Wait for session to switch to the guide user
        // After verifyOtp, the session should be created automatically
        let sessionSwitched = false;
        let currentUserEmail = "";
        let membershipFound = null;
        
        // Wait up to 10 seconds for session to be created
        for (let i = 0; i < 50; i++) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            const { data: userData, error: userErr } = await supabase.auth.getUser();
            if (userData?.user && !userErr) {
              currentUserEmail = userData.user.email || "";
              
              // Check if this user has a guide membership for this outfitter
              const { data: membership } = await supabase
                .from("outfitter_memberships")
                .select("role, status")
                .eq("user_id", userData.user.id)
                .eq("outfitter_id", effectiveOutfitterId)
                .maybeSingle();
              
              membershipFound = membership;
              
              // Session is switched if user has guide membership (invited or active)
              if (membership?.role === "guide" && (membership.status === "invited" || membership.status === "active")) {
                sessionSwitched = true;
                console.log(`✅ Session verified for guide: ${currentUserEmail}`);
                break;
              }
            }
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        if (!sessionSwitched) {
          // If no session switched, provide helpful error
          const errorMsg = 
            `Unable to verify guide session.\n\n` +
            `Current user: ${currentUserEmail || "not logged in"}\n` +
            `Token found: ${effectiveToken ? "yes" : "no"}\n` +
            `Link type: ${effectiveType || "unknown"}\n` +
            `Membership found: ${membershipFound ? `role=${membershipFound.role}, status=${membershipFound.status}` : "none"}\n\n`;
          
          if (!effectiveToken) {
            throw new Error(
              errorMsg +
              `The invite link is missing the authentication token.\n` +
              `This usually means the link was copied incorrectly or expired.\n` +
              `Please ask the admin to send a new invite link.`
            );
          } else {
            throw new Error(
              errorMsg +
              `The invite link should automatically switch your session to the guide user.\n` +
              `If you're an admin, try:\n` +
              `1. Opening the link in an incognito/private browser window, OR\n` +
              `2. Logging out first, then clicking the invite link again.\n\n` +
              `The system will automatically sign you out and switch to the guide session.`
            );
          }
        }

        setStage("form");
      } catch (e: any) {
        setStage("error");
        setError(String(e?.message ?? e));
      }
    })();
  }, [supabase, type, token_hash, outfitter_id]); // type and token_hash are now state, so this will re-run when they change

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setStage("saving");
      setError(null);

      // CRITICAL: Verify we're updating the password for the CORRECT user (the guide, not the admin)
      // When an invite link is clicked, Supabase switches the session to the invited user
      // But if the admin clicks it in the same browser, we need to ensure the session switched
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        throw new Error(`Cannot verify current user: ${userErr?.message || "No user found"}`);
      }
      const currentUser = userData.user;
      
      // Check if this user has a guide membership for this outfitter (invited or active)
      const { data: membership, error: memCheckErr } = await supabase
        .from("outfitter_memberships")
        .select("user_id, role, status")
        .eq("user_id", currentUser.id)
        .eq("outfitter_id", outfitter_id)
        .maybeSingle();
      
      if (memCheckErr) {
        throw new Error(`Failed to verify membership: ${memCheckErr.message}`);
      }
      
      // Allow if user has a guide membership (invited or active status)
      const isGuide = membership?.role === "guide";
      const isInvitedOrActive = membership?.status === "invited" || membership?.status === "active";
      
      if (!membership || !isGuide || !isInvitedOrActive) {
        throw new Error(
          `Session verification failed. Current user: ${currentUser.email}.\n` +
          `Expected: Guide with invited/active membership for outfitter ${outfitter_id}.\n` +
          `Found: ${membership ? `role=${membership.role}, status=${membership.status}` : "no membership"}.\n\n` +
          `IMPORTANT: If you're an admin, you must open the invite link in an incognito/private window, ` +
          `or log out first. Invite links switch your session to the guide user.`
        );
      }
      
      console.log(`✅ Verified: Setting password for guide user ${currentUser.email} (${currentUser.id})`);
      
      // Set password for the verified guide user
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        // If the error is about password being the same, that's actually OK - user already has this password
        if (pwErr.message?.toLowerCase().includes("new password should be different")) {
          // User already has this password set, continue with onboarding
          console.log("User already has this password, continuing with onboarding");
        } else {
          throw new Error(`Failed to set password: ${pwErr.message}`);
        }
      }

      // Complete onboarding in Edge Function
      // Use fetch directly to get the actual response body on error
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No session token available");

      const fnUrl = `${baseUrl}/functions/v1/guide-complete-onboarding`;
      
      const response = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          outfitter_id,
          full_name: fullName.trim(),

          phone: phone.trim() || null,
          address_line1: address1.trim() || null,
          address_line2: address2.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,

          notes: notes.trim() || null,

          vehicle_year: vehicleYear.trim() || null,
          vehicle_make: vehicleMake.trim() || null,
          vehicle_model: vehicleModel.trim() || null,
          vehicle_color: vehicleColor.trim() || null,
          vehicle_plate: vehiclePlate.trim() || null,

          has_guide_license: hasGuideLicense,
          has_cpr_card: hasCPRCard,
          has_leave_no_trace: hasLeaveNoTrace,
        }),
      });

      const responseData = await response.json().catch(() => ({ error: "Failed to parse response" }));

      if (!response.ok) {
        throw new Error(
          `Edge Function error (${response.status}): ${JSON.stringify(responseData, null, 2)}`
        );
      }

      if (!responseData?.ok) {
        throw new Error(`Onboarding did not return ok:true. Response: ${JSON.stringify(responseData, null, 2)}`);
      }

      // Set tenant cookie + role hint cookie (best-effort)
      await fetch("/api/tenant/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitter_id }),
      }).catch(() => {});

      await fetch("/api/session/bootstrap", { method: "POST" }).catch(() => {});

      setStage("done");
    } catch (e: any) {
      setStage("error");
      setError(String(e?.message ?? e));
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Guide Account Setup</h1>

      {stage === "verifying" && <p>Verifying invite…</p>}

      {stage === "error" && (
        <>
          <p style={{ color: "crimson", fontWeight: 800 }}>Setup failed</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 12, borderRadius: 10, maxHeight: "400px", overflow: "auto" }}>
            {error ?? "Unknown error"}
          </pre>

          <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <p style={{ marginTop: 0, fontWeight: 800 }}>Debug info</p>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>
{JSON.stringify(
  { 
    outfitter_id, 
    type, 
    token_hash_present: !!token_hash,
    token_hash_length: token_hash?.length || 0,
    full_name: fullName || "(not set)",
    has_password: password.length > 0,
    window_hash_preview: typeof window !== "undefined" ? window.location.hash.substring(0, 150) : "N/A"
  },
  null,
  2
)}
            </pre>
          </div>

          <p style={{ marginTop: 10 }}>Try reopening the invite link, or ask the outfitter to resend it.</p>
          <button
            onClick={() => {
              setStage("form");
              setError(null);
            }}
            style={{
              marginTop: 12,
              padding: "10px 20px",
              background: "#007AFF",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </>
      )}

      {stage === "form" && (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 18 }}>
          <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Account</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Full name *</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Create password (8+ characters) *</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
            </div>
          </section>

          <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Contact</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Address line 1</span>
                <input value={address1} onChange={(e) => setAddress1(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Address line 2</span>
                <input value={address2} onChange={(e) => setAddress2(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>City</span>
                  <input value={city} onChange={(e) => setCity(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>State</span>
                  <input value={state} onChange={(e) => setState(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Zip</span>
                  <input value={zip} onChange={(e) => setZip(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
              </div>
            </div>
          </section>

          <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Guide details</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Notes</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Vehicle year</span>
                  <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Make</span>
                  <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Model</span>
                  <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Color</span>
                  <input value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Plate</span>
                  <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
                </label>
                <div />
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={hasGuideLicense} onChange={(e) => setHasGuideLicense(e.target.checked)} />
                Has guide license
              </label>
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={hasCPRCard} onChange={(e) => setHasCPRCard(e.target.checked)} />
                Has CPR card
              </label>
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={hasLeaveNoTrace} onChange={(e) => setHasLeaveNoTrace(e.target.checked)} />
                Has Leave No Trace
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{ padding: 14, borderRadius: 12, border: "1px solid #111", opacity: canSubmit ? 1 : 0.5 }}
          >
            Finish Setup
          </button>
        </form>
      )}

      {stage === "saving" && <p>Saving…</p>}

      {stage === "done" && (
        <>
          <p style={{ fontWeight: 900 }}>✅ Account setup complete.</p>
          <p style={{ marginTop: 8 }}>You can now log into the HuntCo app with your email + password.</p>
          <p style={{ marginTop: 8, opacity: 0.8 }}>This website is for owners/admins only.</p>
        </>
      )}
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}><p>Loading...</p></main>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
