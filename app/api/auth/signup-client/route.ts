import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const body = await req.json();

    const {
      client_name,
      address,
      city,
      state,
      zip,
      country,
      cell_phone,
      home_phone,
      email,
      occupation,
      password,
      outfitter_code,
    } = body;

    // Validation
    if (!email || !password || !client_name) {
      return NextResponse.json({ error: "Email, password, and name are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // 2. Find outfitter if code provided
    let outfitterId: string | null = null;
    let codeId: string | null = null;
    if (outfitter_code) {
      const { data: codeData } = await supabase
        .from("outfitter_codes")
        .select("id, outfitter_id, single_use, is_active, expires_at")
        .eq("code", outfitter_code.trim().toUpperCase())
        .eq("is_active", true)
        .single();

      if (codeData) {
        // Check expiration
        if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
          return NextResponse.json({ error: "This outfitter code has expired" }, { status: 400 });
        }

        outfitterId = codeData.outfitter_id;
        codeId = codeData.id;

        // Check if single-use code was already used
        if (codeData.single_use) {
          const { data: existingUse } = await supabase
            .from("outfitter_code_uses")
            .select("id")
            .eq("code_id", codeData.id)
            .single();

          if (existingUse) {
            return NextResponse.json({ error: "This outfitter code has already been used" }, { status: 400 });
          }
        }
      }
    }

    // 3. Parse name into first/last
    const nameParts = client_name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 4. Create client record
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .insert({
        email: email.toLowerCase().trim(),
        first_name: firstName,
        last_name: lastName,
        phone: cell_phone || home_phone || null,
        address_line1: address || null,
        city: city || null,
        state: state || null,
        postal_code: zip || null,
        outfitter_id: outfitterId,
      })
      .select()
      .single();

    if (clientError) {
      // If client creation fails, try to clean up auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `Failed to create client: ${clientError.message}` }, { status: 500 });
    }

    // 5. If outfitter code was used, create link and mark code as used
    if (outfitter_code && outfitterId && codeId) {
      // Get code data again to check single_use status
      const { data: codeData } = await supabase
        .from("outfitter_codes")
        .select("id, single_use")
        .eq("id", codeId)
        .single();

      if (codeData) {
        // Create client-outfitter link
        await supabase.from("client_outfitter_links").insert({
          client_id: clientData.id,
          outfitter_id: outfitterId,
          linked_via_code_id: codeData.id,
        });

        // Mark code as used if single-use
        if (codeData.single_use) {
          await supabase.from("outfitter_code_uses").insert({
            code_id: codeData.id,
            user_id: authData.user.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      user_id: authData.user.id,
      client_id: clientData.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
