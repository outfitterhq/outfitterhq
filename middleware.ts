import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Set a header so layouts can detect the pathname
  const response = NextResponse.next();
  
  // For accept-invite pages, set a header so the layout knows to allow through
  if (pathname.includes("/guide/accept-invite") || pathname.includes("/cook/accept-invite")) {
    response.headers.set("x-pathname", pathname);
    response.headers.set("x-url", req.url);
  }
  
  return response;
}

export const config = {
  matcher: [
    "/guide/:path*",
    "/cook/:path*",
  ],
};
