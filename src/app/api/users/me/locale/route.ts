import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/i18n/config";

// PUT /api/users/me/locale - Bevorzugte Sprache des eingeloggten Users speichern
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { locale } = await request.json().catch(() => ({}));
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Ungültige Sprache" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale },
  });

  return NextResponse.json({ locale });
}
