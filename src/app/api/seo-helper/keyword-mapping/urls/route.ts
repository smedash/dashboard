import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";

const MAX_URLS = 1000;

/** URLs per Liste zu einem Projekt hinzufügen; bereits vorhandene URLs werden übersprungen. */
export async function POST(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json()) as { projectId?: string; urls?: string[] };
    const projectId = body.projectId?.trim();
    if (!projectId) return NextResponse.json({ error: "projectId fehlt" }, { status: 400 });

    const project = await prisma.keywordMapProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const urls = [
      ...new Set(
        (Array.isArray(body.urls) ? body.urls : [])
          .map((u) => (typeof u === "string" ? u.trim() : ""))
          .filter((u) => {
            try {
              const parsed = new URL(u);
              return parsed.protocol === "https:" || parsed.protocol === "http:";
            } catch {
              return false;
            }
          })
      ),
    ];
    if (urls.length === 0) return NextResponse.json({ error: "Keine gültigen URLs" }, { status: 400 });
    if (urls.length > MAX_URLS) {
      return NextResponse.json({ error: `Maximal ${MAX_URLS} URLs pro Anfrage` }, { status: 400 });
    }

    const result = await prisma.keywordMapUrl.createMany({
      data: urls.map((url) => ({ projectId, url })),
      skipDuplicates: true,
    });
    await prisma.keywordMapProject.update({ where: { id: projectId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ created: result.count, skipped: urls.length - result.count });
  } catch (e) {
    console.error("[keyword-mapping/urls] POST", e);
    return NextResponse.json({ error: "URLs konnten nicht hinzugefügt werden" }, { status: 500 });
  }
}

/** Mehrere URLs löschen. */
export async function DELETE(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];
    if (ids.length === 0) return NextResponse.json({ deleted: 0 });
    const result = await prisma.keywordMapUrl.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    console.error("[keyword-mapping/urls] DELETE", e);
    return NextResponse.json({ error: "URLs konnten nicht gelöscht werden" }, { status: 500 });
  }
}
