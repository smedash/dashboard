import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "SME Dashboard <auth@tasketeer.com>",
    }),
    // Google is handled separately via /api/auth/link-google for account linking
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Prüfe nur für Resend (Magic Link) Provider
      if (account?.provider === "resend" && user.email) {
        // Prüfe, ob User in der Datenbank existiert
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // User existiert nicht - verweigere Anmeldung
          return false;
        }
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
    error: "/login",
  },
  session: {
    strategy: "database",
  },
});
