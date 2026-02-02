import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

/**
 * GET /api/client/profile
 * Returns the current user's client record for pre-filling forms (questionnaire, pre-draw, etc.).
 * Used by the web client portal to match iOS autoFillFromAccount / applyProfileIfNeeded behavior.
 */
export async function GET() {
  const supabase = await supabaseRoute();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = userData.user.email;
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(
      "id, email, first_name, last_name, phone, address_line1, city, state, postal_code, date_of_birth"
    )
    .eq("email", userEmail)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Client record not found" }, { status: 404 });
  }

  const first = client.first_name ?? "";
  const last = client.last_name ?? "";
  const fullName = [first, last].filter(Boolean).join(" ").trim() || undefined;

  // Build mailing address line (city, state zip) for questionnaire pre-fill
  const parts: string[] = [];
  if (client.address_line1) parts.push(client.address_line1);
  const cityLine = [client.city, client.state, client.postal_code].filter(Boolean).join(", ");
  if (cityLine) parts.push(cityLine);
  const mailingAddress = parts.length ? parts.join("\n") : undefined;

  return NextResponse.json({
    id: client.id,
    email: client.email ?? undefined,
    first_name: client.first_name ?? undefined,
    last_name: client.last_name ?? undefined,
    full_name: fullName,
    phone: client.phone ?? undefined,
    address_line1: client.address_line1 ?? undefined,
    city: client.city ?? undefined,
    state: client.state ?? undefined,
    postal_code: client.postal_code ?? undefined,
    mailing_address: mailingAddress,
    date_of_birth: client.date_of_birth ?? undefined,
  });
}
