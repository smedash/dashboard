import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NEXTAUTH_URL + "/api/auth/link-google/callback"
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // User ID from state
  const error = searchParams.get("error");

  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/settings?error=oauth_error", request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=missing_params", request.url));
  }

  try {
    // Verify the user is still logged in
    const session = await auth();
    if (!session?.user?.id || session.user.id !== state) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(new URL("/settings?error=no_token", request.url));
    }

    // Get Google user info
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.id) {
      return NextResponse.redirect(new URL("/settings?error=no_google_id", request.url));
    }

    // Check if this Google account is already linked to another user
    const existingAccount = await prisma.account.findFirst({
      where: {
        provider: "google",
        providerAccountId: googleUser.id,
      },
    });

    if (existingAccount && existingAccount.userId !== state) {
      // Google account is linked to a different user
      return NextResponse.redirect(new URL("/settings?error=google_already_linked", request.url));
    }

    // Delete any existing Google account for this user
    await prisma.account.deleteMany({
      where: {
        userId: state,
        provider: "google",
      },
    });

    // Create new Google account link
    await prisma.account.create({
      data: {
        userId: state,
        type: "oauth",
        provider: "google",
        providerAccountId: googleUser.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        token_type: tokens.token_type,
        scope: tokens.scope,
        id_token: tokens.id_token,
      },
    });

    // Update user profile with Google info if not set
    await prisma.user.update({
      where: { id: state },
      data: {
        name: googleUser.name || undefined,
        image: googleUser.picture || undefined,
      },
    });

    return NextResponse.redirect(new URL("/settings?success=google_linked", request.url));
  } catch (error) {
    console.error("Error linking Google account:", error);
    return NextResponse.redirect(new URL("/settings?error=link_failed", request.url));
  }
}


