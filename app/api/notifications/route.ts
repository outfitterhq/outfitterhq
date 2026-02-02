import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRoute } from "@/lib/supabase/server";
import { OUTFITTER_COOKIE } from "@/lib/tenant";

/**
 * GET: Get notifications for current user
 * Query params: ?unread_only=true&limit=50
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const userEmail = userRes.user.email;

    // Build query
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    // Filter out expired notifications
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const { data: notifications, error } = await query;

    if (error) {
      // If table doesn't exist or permission denied, return empty array instead of error
      if (
        (error.message?.includes("relation") && error.message?.includes("does not exist")) ||
        error.code === "42501" || // permission denied
        error.message?.includes("permission denied")
      ) {
        console.warn("Notifications table error (missing table or permission):", error.message);
        return NextResponse.json({
          notifications: [],
          unreadCount: 0,
        });
      }
      console.error("Notifications API error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_email", userEmail)
      .eq("is_read", false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    // If count query fails (table doesn't exist or permission denied), just return 0
    if (
      countError && (
        countError.message?.includes("does not exist") ||
        countError.code === "42501" ||
        countError.message?.includes("permission denied")
      )
    ) {
      return NextResponse.json({
        notifications: notifications || [],
        unreadCount: 0,
      });
    }

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Create a notification (admin only)
 */
export async function POST(req: Request) {
  try {
    const supabase = await supabaseRoute();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const store = await cookies();
    const outfitterId = store.get(OUTFITTER_COOKIE)?.value;
    if (!outfitterId) {
      return NextResponse.json({ error: "No outfitter selected" }, { status: 400 });
    }

    // Verify admin access
    const { data: membership } = await supabase
      .from("outfitter_memberships")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("outfitter_id", outfitterId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const {
      user_email,
      notification_type,
      title,
      message,
      action_url,
      related_id,
      related_type,
      priority = "normal",
      expires_at,
      metadata,
    } = body;

    if (!user_email || !notification_type || !title || !message) {
      return NextResponse.json(
        { error: "user_email, notification_type, title, and message are required" },
        { status: 400 }
      );
    }

    // Create notification using RPC function
    const { data, error } = await supabase.rpc("create_notification", {
      p_outfitter_id: outfitterId,
      p_user_email: user_email,
      p_notification_type: notification_type,
      p_title: title,
      p_message: message,
      p_action_url: action_url || null,
      p_related_id: related_id || null,
      p_related_type: related_type || null,
      p_priority: priority,
      p_expires_at: expires_at || null,
      p_metadata: metadata || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notification_id: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
