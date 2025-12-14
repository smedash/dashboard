import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NEXTAUTH_URL + "/api/auth/link-google/callback"
);

// GET - Start OAuth flow
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/webmasters.readonly",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: session.user.id, // Pass user ID in state
  });

  return NextResponse.redirect(url);
}

