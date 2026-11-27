import { NextRequest, NextResponse } from "next/server";
import { getExcludedBrands, saveExcludedBrands } from "@/lib/keyword-map/brands";
import { requireUser } from "@/lib/keyword-map/server";

export const maxDuration = 120;

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    return NextResponse.json({ excludedBrands: await getExcludedBrands() });
  } catch (e) {
    console.error("[keyword-mapping/settings] GET", e);
    return NextResponse.json({ error: "Einstellungen konnten nicht geladen werden" }, { status: 500 });
  }
}

/** Body: `{ excludedBrands: string[] }`; wendet die Liste sofort auf alle bestehenden Gap-Analysen an. */
export async function PUT(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json().catch(() => ({}))) as { excludedBrands?: unknown };
    if (!Array.isArray(body.excludedBrands) || body.excludedBrands.some((b) => typeof b !== "string")) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }
    const result = await saveExcludedBrands(body.excludedBrands as string[]);
    return NextResponse.json({ excludedBrands: result.brands, excluded: result.excluded, restored: result.restored });
  } catch (e) {
    console.error("[keyword-mapping/settings] PUT", e);
    return NextResponse.json({ error: "Einstellungen konnten nicht gespeichert werden" }, { status: 500 });
  }
}
