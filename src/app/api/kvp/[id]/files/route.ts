import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { canEdit } from "@/lib/rbac";

// GET - Alle Dateien eines KVP abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const files = await prisma.kVPFile.findMany({
      where: { urlId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching KVP files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

// POST - Datei(en) zu einem KVP hochladen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Bearbeiten" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prüfe ob der KVP existiert
    const kvpUrl = await prisma.kVPUrl.findFirst({
      where: { id },
    });

    if (!kvpUrl) {
      return NextResponse.json(
        { error: "KVP nicht gefunden" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Keine Dateien ausgewählt" },
        { status: 400 }
      );
    }

    // Max 10 Dateien gleichzeitig
    if (files.length > 10) {
      return NextResponse.json(
        { error: "Maximal 10 Dateien gleichzeitig hochladen" },
        { status: 400 }
      );
    }

    const ALLOWED_TYPES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ];
    const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

    const uploadedFiles = [];

    for (const file of files) {
      // Max 10MB pro Datei
      if (file.size > 10 * 1024 * 1024) {
        continue;
      }

      // Dateityp prüfen (MIME-Type + Dateiendung)
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
        continue;
      }

      // Upload zu Vercel Blob
      const blob = await put(`kvp/${id}/${file.name}`, file, {
        access: "public",
        addRandomSuffix: true,
      });

      // Speichere Referenz in der Datenbank
      const kvpFile = await prisma.kVPFile.create({
        data: {
          urlId: id,
          fileName: file.name,
          fileUrl: blob.url,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
        },
      });

      uploadedFiles.push(kvpFile);
    }

    return NextResponse.json({ files: uploadedFiles });
  } catch (error) {
    console.error("Error uploading files:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    );
  }
}

// DELETE - Eine Datei löschen (fileId als Query-Parameter)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Bearbeiten" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId ist erforderlich" },
        { status: 400 }
      );
    }

    // Finde die Datei
    const file = await prisma.kVPFile.findFirst({
      where: {
        id: fileId,
        urlId: id,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "Datei nicht gefunden" },
        { status: 404 }
      );
    }

    // Lösche aus Vercel Blob
    try {
      await del(file.fileUrl);
    } catch (error) {
      console.error("Error deleting from Vercel Blob:", error);
      // Auch wenn Blob-Löschung fehlschlägt, DB-Eintrag trotzdem entfernen
    }

    // Lösche aus der Datenbank
    await prisma.kVPFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
