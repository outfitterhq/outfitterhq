import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

interface GuideHunt {
  id: string;
  title: string | null;
  species: string | null;
  unit: string | null;
  weapon: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  client_email: string | null;
  camp_name: string | null;
}

interface GuideHuntsResponse {
  guide: {
    user_id: string;
    username: string;
    name: string;
  };
  closedOut: GuideHunt[];
  notClosedOut: GuideHunt[];
}

export default async function GuideHuntsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseRoute();
  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes.user) {
    redirect("/login");
  }

  const store = await cookies();
  const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
  if (!outfitterId) {
    redirect("/select-outfitter");
  }

  // Load hunts data directly (same logic as API route)
  let huntsData: GuideHuntsResponse | null = null;
  let error: string | null = null;

  try {
    // Get guide info to find their username/email
    const { data: guideData, error: guideError } = await supabase
      .from("guides")
      .select("username, email, user_id")
      .eq("user_id", id)
      .eq("outfitter_id", outfitterId)
      .single();

    if (guideError || !guideData) {
      error = "Guide not found";
    } else {
      const guideUsername = guideData.username || guideData.email || "";

      // Get all hunts assigned to this guide
      const { data: hunts, error: huntsError } = await supabase
        .from("calendar_events")
        .select("id, title, species, unit, weapon, start_time, end_time, status, client_email, camp_name")
        .eq("outfitter_id", outfitterId)
        .eq("guide_username", guideUsername)
        .order("start_time", { ascending: false });

      if (huntsError) {
        error = huntsError.message;
      } else {
        // Get all closeouts for these hunts
        const huntIds = (hunts || []).map((h: any) => h.id);
        let closeouts: any[] = [];
        let closeoutsError = null;
        
        if (huntIds.length > 0) {
          const result = await supabase
            .from("hunt_closeouts")
            .select("hunt_id, id, submitted_at, is_locked")
            .in("hunt_id", huntIds);
          closeouts = result.data || [];
          closeoutsError = result.error;
        }

        if (closeoutsError) {
          error = closeoutsError.message;
        } else {
          // Create a set of hunt IDs that have closeouts
          const closeoutHuntIds = new Set((closeouts || []).map((c: any) => c.hunt_id));

          // Separate hunts into closed out and not closed out
          const closedOut = (hunts || []).filter((h: any) => closeoutHuntIds.has(h.id));
          const notClosedOut = (hunts || []).filter((h: any) => !closeoutHuntIds.has(h.id));

          huntsData = {
            guide: {
              user_id: id,
              username: guideUsername,
              name: guideData.username || guideData.email || "Guide",
            },
            closedOut: closedOut.map((h: any) => ({
              id: h.id,
              title: h.title,
              species: h.species,
              unit: h.unit,
              weapon: h.weapon,
              start_time: h.start_time,
              end_time: h.end_time,
              status: h.status,
              client_email: h.client_email,
              camp_name: h.camp_name,
            })),
            notClosedOut: notClosedOut.map((h: any) => ({
              id: h.id,
              title: h.title,
              species: h.species,
              unit: h.unit,
              weapon: h.weapon,
              start_time: h.start_time,
              end_time: h.end_time,
              status: h.status,
              client_email: h.client_email,
              camp_name: h.camp_name,
            })),
          };
        }
      }
    }
  } catch (e: any) {
    error = String(e);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <a
          href="/guides"
          style={{
            color: "#0070f3",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 16,
            display: "inline-block",
          }}
        >
          ← Back to Guides
        </a>
        <h1 style={{ marginTop: 8, marginBottom: 4 }}>
          {huntsData?.guide.name || "Guide"} - Hunts
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          View hunts that have been closed out and hunts that still need closeout
        </p>
      </div>

      {error ? (
        <div
          style={{
            padding: 16,
            background: "#fee",
            borderRadius: 8,
            color: "#c00",
            marginBottom: 24,
          }}
        >
          Error: {error}
        </div>
      ) : huntsData ? (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Not Closed Out Section */}
          <section
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 20,
              background: "#fff",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>
              Hunts Not Closed Out ({huntsData.notClosedOut.length})
            </h2>
            {huntsData.notClosedOut.length === 0 ? (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                No hunts pending closeout
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {huntsData.notClosedOut.map((hunt) => (
                  <HuntCard key={hunt.id} hunt={hunt} />
                ))}
              </div>
            )}
          </section>

          {/* Closed Out Section */}
          <section
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 20,
              background: "#fff",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>
              Closed Out Hunts ({huntsData.closedOut.length})
            </h2>
            {huntsData.closedOut.length === 0 ? (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                No closed out hunts
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {huntsData.closedOut.map((hunt) => (
                  <HuntCard key={hunt.id} hunt={hunt} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
          Loading...
        </div>
      )}
    </main>
  );
}

function HuntCard({ hunt }: { hunt: GuideHunt }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const dateRange =
    hunt.start_time && hunt.end_time
      ? `${formatDate(hunt.start_time)} - ${formatDate(hunt.end_time)}`
      : hunt.start_time
        ? formatDate(hunt.start_time)
        : "";

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        padding: 16,
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
            {hunt.title || "Hunt"}
          </h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: "#666" }}>
            {hunt.species && <span>Species: {hunt.species}</span>}
            {hunt.weapon && <span>Weapon: {hunt.weapon}</span>}
            {hunt.unit && <span>Unit: {hunt.unit}</span>}
          </div>
          {dateRange && (
            <div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
              {dateRange}
            </div>
          )}
          {hunt.client_email && (
            <div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
              Client: {hunt.client_email}
            </div>
          )}
        </div>
        {hunt.status && (
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              background:
                hunt.status === "Pending Closeout"
                  ? "#fff3cd"
                  : hunt.status === "Completed"
                    ? "#d4edda"
                    : "#e2e3e5",
              color:
                hunt.status === "Pending Closeout"
                  ? "#856404"
                  : hunt.status === "Completed"
                    ? "#155724"
                    : "#383d41",
            }}
          >
            {hunt.status}
          </span>
        )}
      </div>
    </div>
  );
}
