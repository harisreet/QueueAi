import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("queuecare_token")?.value;
  const role = request.cookies.get("queuecare_role")?.value;

  const { pathname } = request.nextUrl;

  // Check if pathname starts with any of the dashboard paths
  const dashboardRoutes = ["/admin", "/doctor", "/patient", "/reception"];
  const isDashboardRoute = dashboardRoutes.some((route) => pathname.startsWith(route));

  if (isDashboardRoute) {
    if (!token || !role) {
      // Redirect to login if unauthenticated
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Role protection mapping
    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL(getRoleDashboard(role), request.url));
    }
    if (pathname.startsWith("/doctor") && role !== "doctor") {
      return NextResponse.redirect(new URL(getRoleDashboard(role), request.url));
    }
    if (pathname.startsWith("/reception") && role !== "receptionist") {
      return NextResponse.redirect(new URL(getRoleDashboard(role), request.url));
    }
    if (pathname.startsWith("/patient") && role !== "patient") {
      return NextResponse.redirect(new URL(getRoleDashboard(role), request.url));
    }
  }

  // Redirect authenticated users trying to access login/signup pages
  if ((pathname === "/login" || pathname === "/signup") && token && role) {
    return NextResponse.redirect(new URL(getRoleDashboard(role), request.url));
  }

  return NextResponse.next();
}

function getRoleDashboard(role: string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "doctor":
      return "/doctor";
    case "receptionist":
      return "/reception";
    default:
      return "/patient";
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/doctor/:path*",
    "/patient/:path*",
    "/reception/:path*",
    "/login",
    "/signup",
  ],
};
