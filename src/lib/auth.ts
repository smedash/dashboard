import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "./prisma";
import { sendMagicLinkEmail } from "./resend";

// Erstelle einen erweiterten PrismaAdapter mit robuster Token-Verarbeitung
const basePrismaAdapter = PrismaAdapter(prisma);

const customAdapter = {
  ...basePrismaAdapter,
  // Überschreibe useVerificationToken um Race Conditions zu vermeiden
  // (z.B. wenn E-Mail-Clients Links prefetchen oder User doppelt klicken)
  async useVerificationToken(params: { identifier: string; token: string }) {
    try {
      // Versuche den Token zu finden und zu löschen
      const verificationToken = await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: params.identifier,
            token: params.token,
          },
        },
      });
      return verificationToken;
    } catch (error) {
      // Token existiert nicht mehr - das ist OK (wurde bereits verwendet)
      // Gib null zurück, damit NextAuth den Fehler "Verification" anzeigt
      // anstatt einen Server-Error zu werfen
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2025"
      ) {
        // P2025 = "Record to delete does not exist"
        console.warn(
          "[Auth] Verification token not found - may have been used already:",
          params.identifier
        );
        return null;
      }
      // Andere Fehler weiterwerfen
      throw error;
    }
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: customAdapter,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "SME Dashboard <mail@tasketeer.com>",
      // Custom sendVerificationRequest: Sendet Link zur Zwischenseite statt direkt zum Callback
      // Dies verhindert, dass Security-Scanner den Token "verbrauchen"
      sendVerificationRequest: async ({ identifier: email, url }) => {
        // Extrahiere Token und CallbackUrl aus der Original-URL
        const originalUrl = new URL(url);
        const token = originalUrl.searchParams.get("token");
        const callbackUrl = originalUrl.searchParams.get("callbackUrl") || "/";

        // Erstelle URL zur Zwischenseite (auth-confirm)
        // Der User muss dort aktiv auf "Anmelden" klicken
        const baseUrl = originalUrl.origin;
        const confirmUrl = new URL("/auth-confirm", baseUrl);
        confirmUrl.searchParams.set("token", token || "");
        confirmUrl.searchParams.set("email", email);
        confirmUrl.searchParams.set("callbackUrl", callbackUrl);

        // Sende E-Mail mit Link zur Zwischenseite
        await sendMagicLinkEmail({
          to: email,
          url: confirmUrl.toString(),
        });
      },
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
        // Rolle aus der Datenbank laden
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        session.user.role = dbUser?.role || "member";
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
