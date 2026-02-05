import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Check if this is a password reset flow (recovery token in URL)
  // Supabase may redirect to home page with token in hash or query params, or with ?code= (PKCE)
  if (pathname === "/") {
    const url = new URL(req.url);
    
    // Check for PKCE code - if we have a code on the root path, redirect to callback
    // The callback will handle it and redirect to /reset-password if it's a password reset
    const code = url.searchParams.get("code");
    if (code) {
      // Redirect to callback route - it will detect if it's a password reset and handle accordingly
      // We'll assume it might be a password reset and let the callback decide
      const callbackUrl = new URL("/auth/callback", url.origin);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("type", "recovery"); // Assume recovery for codes on root path
      callbackUrl.searchParams.set("next", "/reset-password");
      return NextResponse.redirect(callbackUrl);
    }
    
    // Check query params for recovery token (non-PKCE flow)
    const type = url.searchParams.get("type");
    const accessToken = url.searchParams.get("access_token");
    const refreshToken = url.searchParams.get("refresh_token");
    
    if (type === "recovery" && accessToken && refreshToken) {
      // Redirect to reset-password with token in hash
      const resetUrl = new URL("/reset-password", url.origin);
      resetUrl.hash = `access_token=${accessToken}&refresh_token=${refreshToken}&type=recovery`;
      return NextResponse.redirect(resetUrl);
    }
    
    // Check if URL contains hash fragment (we can't read hash server-side, but we can check if it's likely a recovery)
    // If the URL has a hash, let client-side handle it (home page will redirect)
  }
  
  // Set a header so layouts can detect the pathname
  const response = NextResponse.next();
  
  // For accept-invite pages, set multiple headers so the layout can detect it
  if (pathname.includes("/guide/accept-invite") || pathname.includes("/cook/accept-invite")) {
    response.headers.set("x-pathname", pathname);
    response.headers.set("x-url", req.url);
    response.headers.set("x-invoke-path", pathname);
    response.headers.set("x-forwarded-uri", req.url);
  }
  
  return response;
}

export const config = {
  matcher: [
    "/",
    "/guide/:path*",
    "/cook/:path*",
  ],
};
