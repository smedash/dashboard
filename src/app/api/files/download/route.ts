import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDownloadUrl } from "@vercel/blob";

/**
 * Authenticated download route for private Vercel Blob files.
 *
 * Usage: GET /api/files/download?url=<encodedBlobUrl>
 *
 * Verifies the user is authenticated, then returns a time-limited
 * signed URL for the requested blob. The client can use this URL
 * directly in <img src>, <a href>, or fetch() calls.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blobUrl = request.nextUrl.searchParams.get("url");

    if (!blobUrl) {
      return NextResponse.json(
        { error: "URL-Parameter ist erforderlich" },
        { status: 400 }
      );
    }

    // Validate that the URL is a legitimate Vercel Blob URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(blobUrl);
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL" },
        { status: 400 }
      );
    }

    const allowedHosts = [
      ".public.blob.vercel-storage.com",
      ".blob.vercel-storage.com",
    ];

    const isVercelBlob = allowedHosts.some((host) =>
      parsedUrl.hostname.endsWith(host)
    );

    if (!isVercelBlob) {
      return NextResponse.json(
        { error: "Nur Vercel-Blob-URLs sind erlaubt" },
        { status: 403 }
      );
    }

    // Get a time-limited signed download URL
    const downloadUrl = await getDownloadUrl(blobUrl);

    // Redirect to signed URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Fehler beim Generieren der Download-URL" },
      { status: 500 }
    );
  }
}
