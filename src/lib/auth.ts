import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { assertServerOnly } from "@/lib/assert-server-only";
import {
  isVerifiedGoogleIdentity,
  normalizeEmail,
  parseAllowedEmails,
} from "@/lib/question-paper-security-policy.mjs";

assertServerOnly("NextAuth configuration");

const ADMIN_EMAILS = [
  "saihemanth.gummadapu@gmail.com",
  "info@divyahighschool.co.in",
];
const STAFF_EMAILS = ["teacher1@gmail.com", "teacher2@gmail.com"];
const STUDENT_EMAILS = ["student1@gmail.com"];

function getRole(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  if (ADMIN_EMAILS.includes(normalizedEmail)) return "admin";
  if (STAFF_EMAILS.includes(normalizedEmail)) return "staff";
  if (STUDENT_EMAILS.includes(normalizedEmail)) return "student";
  return null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const normalizedEmail = normalizeEmail(user.email);
      const questionPaperAllowlist = parseAllowedEmails(
        process.env.QUESTION_PAPER_ALLOWED_EMAILS,
      );
      const isQuestionPaperAccount =
        questionPaperAllowlist.configured &&
        questionPaperAllowlist.emails.has(normalizedEmail);
      if (
        !isVerifiedGoogleIdentity({
          provider: account?.provider,
          profile,
          email: normalizedEmail,
        }) ||
        (!getRole(normalizedEmail) && !isQuestionPaperAccount)
      ) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account) {
        token.emailVerified = isVerifiedGoogleIdentity({
          provider: account.provider,
          profile,
          email: token.email,
        });
      }

      if (user?.email) {
        const role = getRole(user.email);
        if (role) token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "admin" | "staff" | "student";
        session.user.emailVerified = token.emailVerified === true;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
