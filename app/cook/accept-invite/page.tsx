"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AcceptCookInviteContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const outfitterIdFromUrl = sp.get("outfitter_id") ?? "";
  const [resolvedOutfitterId, setResolvedOutfitterId] = useState(outfitterIdFromUrl);
  const outfitter_id = resolvedOutfitterId || outfitterIdFromUrl;
  
  const [type, setType] = useState(sp.get("type") ?? "");
  const [token_hash, setTokenHash] = useState(sp.get("token_hash") ?? sp.get("token") ?? "");

  const [stage, setStage] = useState<"verifying" | "form" | "saving" | "done" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const canSubmit = fullName.trim().length >= 2 && password.length >= 8 && !!outfitter_id;

  // Parse hash fragment on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.substring(1);
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const hashType = hashParams.get("type");
        const hashToken = hashParams.get("token_hash") ?? hashParams.get("token");
        if (hashType) setType(hashType);
        if (hashToken) setTokenHash(hashToken);
        
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
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
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError(null);

        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          const { data: existingUser } = await supabase.auth.getUser();
          if (existingUser?.user) {
            // If outfitter_id missing from URL, get it from the user's cook membership
            let effectiveOutfitterId = outfitterIdFromUrl;
            if (!effectiveOutfitterId) {
              const { data: cookMemberships } = await supabase
                .from("outfitter_memberships")
                .select("outfitter_id")
                .eq("user_id", existingUser.user.id)
                .eq("role", "cook")
                .in("status", ["invited", "active"]);
              const list = (cookMemberships ?? []) as { outfitter_id: string }[];
              if (list.length > 0) {
                effectiveOutfitterId = list[0].outfitter_id;
                setResolvedOutfitterId(effectiveOutfitterId);
              }
            }

            if (effectiveOutfitterId) {
              const { data: existingMembership } = await supabase
                .from("outfitter_memberships")
                .select("user_id, role, status")
                .eq("outfitter_id", effectiveOutfitterId)
                .eq("user_id", existingUser.user.id)
                .maybeSingle();

              const mem = existingMembership as { role?: string; status?: string } | null;
              if (mem?.role === "cook" && mem?.status === "active") {
                // Already set up, set cookie and go to cook dashboard
                const form = new FormData();
                form.set("outfitter_id", effectiveOutfitterId);
                await fetch("/api/tenant/select", { method: "POST", body: form });
                router.push("/cook");
                return;
              }
              
              // Set outfitter cookie immediately so it's available throughout the flow
              // This ensures the outfitter is "selected" even before form submission
              if (mem?.role === "cook" && (mem?.status === "invited" || mem?.status === "active")) {
                try {
                  const form = new FormData();
                  form.set("outfitter_id", effectiveOutfitterId);
                  await fetch("/api/tenant/select", { method: "POST", body: form });
                  console.log("✅ Outfitter cookie set for cook invite:", effectiveOutfitterId);
                } catch (cookieErr) {
                  console.warn("Failed to set outfitter cookie (non-fatal):", cookieErr);
                }
              }
              
              setResolvedOutfitterId(effectiveOutfitterId);
              // We have an outfitter (from URL or membership); show form
              setStage("form");
              return;
            } else {
              setError("No outfitter could be found for your invite. Please use the link from your email.");
              setStage("error");
              return;
            }
          }
        }

        const effectiveId = resolvedOutfitterId || outfitterIdFromUrl;
        if (!effectiveId) {
          setError("Missing outfitter in invite link. Please use the full link from your email.");
          setStage("error");
          return;
        }

        // Set outfitter cookie immediately if we have outfitter_id from URL
        // This ensures the outfitter is "selected" even before form submission
        if (effectiveId) {
          try {
            const form = new FormData();
            form.set("outfitter_id", effectiveId);
            await fetch("/api/tenant/select", { method: "POST", body: form });
            console.log("✅ Outfitter cookie set from URL:", effectiveId);
            setResolvedOutfitterId(effectiveId);
          } catch (cookieErr) {
            console.warn("Failed to set outfitter cookie (non-fatal):", cookieErr);
          }
        }

        // Verify the invite token
        if (token_hash && type === "invite") {
          setStage("form");
        } else {
          const { data: session } = await supabase.auth.getSession();
          if (session?.session) {
            setStage("form");
          } else {
            setError("Invalid invite link. Please check the link and try again.");
            setStage("error");
          }
        }
      } catch (e: any) {
        setError(e.message || "Failed to verify invite");
        setStage("error");
      }
    })();
  }, [outfitterIdFromUrl, outfitter_id, token_hash, type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStage("saving");
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        throw new Error("No active session. Please use the invite link from your email.");
      }

      const user = session.user;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: fullName.trim(),
          email: user.email,
          phone: phone.trim() || null,
        }, { onConflict: "id" });

      if (profileError) {
        console.warn("Profile update error (non-fatal):", profileError);
      }

      // Update password if provided
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password,
        });

        if (passwordError) {
          throw new Error(`Failed to set password: ${passwordError.message}`);
        }
      }

      // Update membership status to active
      const { error: membershipError } = await supabase
        .from("outfitter_memberships")
        .update({
          status: "active",
          accepted_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("outfitter_id", outfitter_id)
        .eq("role", "cook");

      if (membershipError) {
        throw new Error(`Failed to activate membership: ${membershipError.message}`);
      }

      // Update cook profile if it exists (normalize email for case-insensitive match)
      const emailLower = (user.email ?? "").toLowerCase();
      const { error: cookProfileError } = await supabase
        .from("cook_profiles")
        .update({
          name: fullName.trim(),
          contact_phone: phone.trim() || null,
          contact_email: emailLower,
        })
        .eq("outfitter_id", outfitter_id)
        .eq("contact_email", emailLower);

      // Non-fatal if cook profile doesn't exist yet
      if (cookProfileError) {
        console.warn("Cook profile update error (non-fatal):", cookProfileError);
      }

      setStage("done");

      // Set outfitter cookie so /cook dashboard works, then redirect
      const form = new FormData();
      form.set("outfitter_id", outfitter_id);
      await fetch("/api/tenant/select", { method: "POST", body: form });

      setTimeout(() => {
        router.push("/cook");
      }, 2000);
    } catch (e: any) {
      setError(e.message || "Failed to complete setup");
      setStage("form");
    }
  }

  if (stage === "verifying") {
    return (
      <div style={{ maxWidth: 500, margin: "50px auto", padding: 20 }}>
        <h1>Verifying Invite...</h1>
        <p>Please wait while we verify your invite link.</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div style={{ maxWidth: 500, margin: "50px auto", padding: 20 }}>
        <h1>Error</h1>
        <p style={{ color: "red" }}>{error || "An error occurred"}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div style={{ maxWidth: 500, margin: "50px auto", padding: 20 }}>
        <h1>✅ Account Created!</h1>
        <p>Your cook account has been set up successfully. Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: "50px auto", padding: 20 }}>
      <h1>Complete Your Cook Account</h1>
      <p>Please fill in your information to complete your account setup.</p>

      {error && (
        <div style={{ padding: 12, backgroundColor: "#fee", border: "1px solid #fcc", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#c00" }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Full Name <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            required
            minLength={2}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Phone (optional)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Password <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          />
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Must be at least 8 characters long</p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || stage === "saving"}
          style={{
            padding: "12px 24px",
            backgroundColor: canSubmit && stage !== "saving" ? "#0070f3" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: canSubmit && stage !== "saving" ? "pointer" : "not-allowed",
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {stage === "saving" ? "Creating Account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

export default function AcceptCookInvitePage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 500, margin: "50px auto", padding: 20 }}>
        <h1>Loading...</h1>
        <p>Please wait.</p>
      </div>
    }>
      <AcceptCookInviteContent />
    </Suspense>
  );
}
