import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await supabaseRoute();

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const code = body.code?.toString().trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  // Use the existing validate_and_use_outfitter_code function
  const { data: result, error: rpcError } = await supabase.rpc(
    "validate_and_use_outfitter_code",
    {
      p_code: code,
      p_user_id: userData.user.id,
    }
  );

  if (rpcError) {
    console.error("RPC error:", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  // The function returns a table row
  const row = result?.[0];
  if (!row) {
    return NextResponse.json({ error: "No response from validation" }, { status: 500 });
  }

  return NextResponse.json({
    success: row.success,
    outfitterId: row.linked_outfitter_id ?? row.outfitter_id,
    message: row.message,
  });
}
