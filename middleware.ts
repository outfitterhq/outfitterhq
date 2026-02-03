import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
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
    "/guide/:path*",
    "/cook/:path*",
  ],
};
