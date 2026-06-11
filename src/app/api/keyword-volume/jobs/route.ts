import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const keywords: string[] = body.keywords;
    const property: string = body.property;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "keywords array is required" }, { status: 400 });
    }
    if (!property) {
      return NextResponse.json({ error: "property is required" }, { status: 400 });
    }

    const existing = await prisma.keywordVolumeJob.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["pending", "processing"] },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Es laeuft bereits ein Suchvolumen-Job", job: existing },
        { status: 409 }
      );
    }

    const uniqueKeywords = [...new Set(keywords.map((k) => k.toLowerCase().trim()))].filter(Boolean);

    const job = await prisma.keywordVolumeJob.create({
      data: {
        userId: session.user.id,
        property,
        keywords: JSON.stringify(uniqueKeywords),
        totalKeywords: uniqueKeywords.length,
        location: body.location || "Switzerland",
        language: body.language || "German",
      },
    });

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error creating keyword volume job:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const property = request.nextUrl.searchParams.get("property");

    const job = await prisma.keywordVolumeJob.findFirst({
      where: {
        userId: session.user.id,
        ...(property ? { property } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ job: job || null });
  } catch (error) {
    console.error("Error fetching keyword volume job:", error);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
