import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ADMIN_EMAILS = [
  "saihemanth.gummadapu@gmail.com",
  "info@divyahighschool.co.in",
];
const STAFF_EMAILS = ["teacher1@gmail.com", "teacher2@gmail.com"];
const STUDENT_EMAILS = ["student1@gmail.com"];

type Role = "admin" | "staff" | "student";

function getRoleForEmail(email?: string | null): Role | null {
  if (!email) return null;
  if (ADMIN_EMAILS.includes(email)) return "admin";
  if (STAFF_EMAILS.includes(email)) return "staff";
  if (STUDENT_EMAILS.includes(email)) return "student";
  return null;
}

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const role = getRoleForEmail(user.email);
      return !!role;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const role = getRoleForEmail(user.email);
        if (role) {
          (token as any).role = role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

