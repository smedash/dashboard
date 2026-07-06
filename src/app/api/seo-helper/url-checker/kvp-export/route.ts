import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, keyword, failedChecks } = await request.json();

    if (!url || !failedChecks || !Array.isArray(failedChecks)) {
      return NextResponse.json({ error: "url und failedChecks[] sind erforderlich" }, { status: 400 });
    }

    // Check if KVP URL already exists for this user
    const existing = await prisma.kVPUrl.findFirst({
      where: { userId: session.user.id, url },
    });

    let kvpUrl;
    if (existing) {
      kvpUrl = existing;
    } else {
      // Create KVP entry
      kvpUrl = await prisma.kVPUrl.create({
        data: {
          userId: session.user.id,
          url,
          focusKeyword: keyword || "URL Checker",
          category: null,
        },
      });
    }

    // Create comment with failed checks as optimization tasks
    const taskLines = failedChecks.map((check: { factor: string; recommendation: string; leakAttribute: string }, i: number) =>
      `${i + 1}. **${check.factor}** (${check.leakAttribute})\n   ${check.recommendation}`
    ).join('\n\n');

    const commentText = `## URL Ranking Factor Checker - Optimierungsbedarf\n\nDatum: ${new Date().toLocaleDateString('de-DE')}\n${keyword ? `Keyword: ${keyword}\n` : ''}\n### Aufgaben:\n\n${taskLines}`;

    await prisma.kVPComment.create({
      data: {
        urlId: kvpUrl.id,
        text: commentText,
      },
    });

    return NextResponse.json({
      kvpUrlId: kvpUrl.id,
      created: !existing,
      tasksCount: failedChecks.length,
    });
  } catch (error) {
    console.error("[url-checker/kvp-export]", error);
    return NextResponse.json({ error: "Fehler beim KVP-Export." }, { status: 500 });
  }
}
