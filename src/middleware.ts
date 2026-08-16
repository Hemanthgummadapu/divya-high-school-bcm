import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { evaluateQuestionPaperIdentity } from "@/lib/question-paper-security-policy.mjs";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const role = token?.role as "admin" | "staff" | "student" | undefined;
    const { pathname, origin } = req.nextUrl;

    if (pathname === "/academics/question-papers/access-denied") {
      return NextResponse.next();
    }

    if (pathname.startsWith("/academics/question-papers")) {
      const decision = evaluateQuestionPaperIdentity({
        sessionPresent: Boolean(token),
        email: token?.email,
        emailVerified: token?.emailVerified,
        allowedEmailsValue: process.env.QUESTION_PAPER_ALLOWED_EMAILS,
      });

      if (!decision.allowed) {
        if (decision.status === 401) {
          const loginUrl = new URL("/login", origin);
          loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
          return NextResponse.redirect(loginUrl);
        }
        return NextResponse.redirect(
          new URL("/academics/question-papers/access-denied", origin),
        );
      }

      return NextResponse.next();
    }

    if (!role) {
      const questionPaperAccess = evaluateQuestionPaperIdentity({
        sessionPresent: Boolean(token),
        email: token?.email,
        emailVerified: token?.emailVerified,
        allowedEmailsValue: process.env.QUESTION_PAPER_ALLOWED_EMAILS,
      });
      if (questionPaperAccess.allowed) {
        return NextResponse.redirect(
          new URL("/academics/question-papers", origin),
        );
      }
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
    "/academics/question-papers",
    "/academics/question-papers/:path*",
  ],
};
