import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/admin/mobile/")) {
    const origin = req.headers.get("origin") ?? "";
    const allowOrigin =
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin === "https://www.maremovals.com" ||
      origin === "https://maremovals.com"
        ? origin
        : "https://www.maremovals.com";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };

    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    const res = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.headers.set(key, value);
    });
    return res;
  }

  if (!req.auth) {
    // Driver routes go to driver login, everything else to admin login
    const isDriver = pathname.startsWith("/driver/");
    const loginPath = isDriver ? "/driver-login" : "/auth/login";
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role guard for /driver/* (logged-in but wrong role)
  if (pathname.startsWith("/driver/")) {
    if (req.auth.user?.role !== "DRIVER" && req.auth.user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/driver-login?error=role", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/driver/dashboard/:path*",
    "/driver/jobs/:path*",
    "/driver/my-jobs/:path*",
    "/driver/messages/:path*",
    "/api/bookings/:path*",
    "/api/admin/:path*",
  ],
};
