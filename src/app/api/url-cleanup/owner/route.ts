import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  isValidOwnerEmail,
  looksLikePath,
  normalizeOwnerPrefix,
  ownerFilterWhere,
  ownerPrefixWhere,
  parseOwnerFilter,
} from "@/lib/url-cleanup/owner";

const MAX_TEXT = 200;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const person = sp.get("person")?.trim() ?? "";
  const owner = parseOwnerFilter(sp.get("owner"));
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 50), 200);

  const prefix = q && looksLikePath(q) ? normalizeOwnerPrefix(q) : null;
  const scope: Prisma.UrlInventoryWhereInput[] = [];
  if (prefix) {
    scope.push(ownerPrefixWhere(prefix));
  } else if (q) {
    scope.push({
      OR: [
        { url: { contains: q, mode: "insensitive" } },
        { urlKey: { contains: q.toLowerCase() } },
      ],
    });
  }

  const filtered = [...scope];
  const ownerWhere = ownerFilterWhere(owner);
  if (ownerWhere) filtered.push(ownerWhere);
  if (person) {
    filtered.push({
      OR: [
        { ownerName: { contains: person, mode: "insensitive" } },
        { ownerEmail: { contains: person, mode: "insensitive" } },
      ],
    });
  }

  const scopeWhere: Prisma.UrlInventoryWhereInput = scope.length ? { AND: scope } : {};
  const where: Prisma.UrlInventoryWhereInput = filtered.length ? { AND: filtered } : {};
  const withoutWhere = ownerFilterWhere("without")!;

  const [total, rows, scopeTotal, scopeWithout, owners] = await Promise.all([
    prisma.urlInventory.count({ where }),
    prisma.urlInventory.findMany({
      where,
      orderBy: { urlKey: "asc" },
      skip: page * pageSize,
      take: pageSize,
      select: {
        id: true,
        url: true,
        urlKey: true,
        country: true,
        language: true,
        ownerName: true,
        ownerEmail: true,
        ownerUpdatedAt: true,
      },
    }),
    prisma.urlInventory.count({ where: scopeWhere }),
    prisma.urlInventory.count({ where: { AND: [scopeWhere, withoutWhere] } }),
    prisma.urlInventory.groupBy({
      by: ["ownerName", "ownerEmail"],
      where: ownerFilterWhere("with")!,
      _count: { _all: true },
      orderBy: { ownerName: "asc" },
      take: 500,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    rows,
    prefix,
    scope: { total: scopeTotal, withoutOwner: scopeWithout },
    owners: owners.map((o) => ({ name: o.ownerName, email: o.ownerEmail, count: o._count._all })),
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      ids?: string[];
      prefix?: string;
      onlyWithoutOwner?: boolean;
      ownerName?: string;
      ownerEmail?: string;
    };

    const ownerName = (body.ownerName ?? "").trim().slice(0, MAX_TEXT) || null;
    const ownerEmail = (body.ownerEmail ?? "").trim().toLowerCase().slice(0, MAX_TEXT) || null;
    if (ownerEmail && !isValidOwnerEmail(ownerEmail)) {
      return NextResponse.json({ error: "Ungültige Mailadresse" }, { status: 400 });
    }

    let where: Prisma.UrlInventoryWhereInput;
    if (typeof body.prefix === "string" && body.prefix.trim()) {
      const prefix = normalizeOwnerPrefix(body.prefix);
      if (!prefix) {
        return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
      }
      where = ownerPrefixWhere(prefix);
      if (body.onlyWithoutOwner) where = { AND: [where, ownerFilterWhere("without")!] };
    } else {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string" && id) : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: "ids oder prefix erforderlich" }, { status: 400 });
      }
      where = { id: { in: ids } };
    }

    const cleared = !ownerName && !ownerEmail;
    const result = await prisma.urlInventory.updateMany({
      where,
      data: { ownerName, ownerEmail, ownerUpdatedAt: cleared ? null : new Date() },
    });

    return NextResponse.json({ updated: result.count });
  } catch (e) {
    console.error("[url-cleanup/owner]", e);
    return NextResponse.json({ error: "Update fehlgeschlagen" }, { status: 500 });
  }
}
