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
    const property: string = body.property;
    const period: string = body.period || "28d";

    if (!property) {
      return NextResponse.json({ error: "property is required" }, { status: 400 });
    }

    const existing = await prisma.keywordUrlJob.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["pending", "processing"] },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Es laeuft bereits ein Keyword-URL-Job", job: existing },
        { status: 409 }
      );
    }

    const job = await prisma.keywordUrlJob.create({
      data: {
        userId: session.user.id,
        property,
        period,
      },
    });

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error creating keyword-url job:", error);
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

    const job = await prisma.keywordUrlJob.findFirst({
      where: {
        userId: session.user.id,
        ...(property ? { property } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ job: job || null });
  } catch (error) {
    console.error("Error fetching keyword-url job:", error);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
