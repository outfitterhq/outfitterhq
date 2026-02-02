import { NextResponse } from "next/server";

/**
 * Redirect to the hunt packet page where the guide can view and download
 * contract, questionnaire, and guide documents individually.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const origin = url.origin;
  return NextResponse.redirect(`${origin}/guide/packet/${id}`);
}
