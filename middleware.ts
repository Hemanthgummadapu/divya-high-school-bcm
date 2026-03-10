import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const role = token?.role as "admin" | "staff" | "student" | undefined;
    const { pathname, origin } = req.nextUrl;

    if (!role) {
      const loginUrl = new URL("/login", origin);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname.startsWith("/admin-portal")) {
      if (role === "student") {
        return NextResponse.redirect(new URL("/student-portal", origin));
      }
      if (role === "staff") {
        return NextResponse.redirect(new URL("/staff-portal", origin));
      }
    }

    if (pathname.startsWith("/staff-portal")) {
      if (role === "student") {
        return NextResponse.redirect(new URL("/student-portal", origin));
      }
    }

    if (pathname.startsWith("/student-portal")) {
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin-portal", origin));
      }
      if (role === "staff") {
        return NextResponse.redirect(new URL("/staff-portal", origin));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
    "/admin-portal",
    "/admin-portal/:path*",
    "/staff-portal",
    "/staff-portal/:path*",
    "/student-portal",
    "/student-portal/:path*",
  ],
};

