import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prüfe ob User Admin ist (über Umgebungsvariable)
    const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(email => email.trim().toLowerCase()) || [];
    const userEmail = session.user.email?.toLowerCase() || "";
    const isAdmin = userEmail && adminEmails.includes(userEmail);

    return NextResponse.json({
      isAdmin,
      userEmail: session.user.email,
      adminEmailsConfigured: adminEmails.length > 0,
      adminEmails: adminEmails.length > 0 ? adminEmails : "Keine Admin-Emails konfiguriert",
      message: isAdmin
        ? "Du hast Admin-Rechte!"
        : adminEmails.length === 0
        ? "ADMIN_EMAILS Umgebungsvariable ist nicht gesetzt"
        : "Du hast keine Admin-Rechte",
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json(
      { error: "Failed to check admin status" },
      { status: 500 }
    );
  }
}

