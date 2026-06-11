import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { keyword } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json({ error: "Keyword ist erforderlich" }, { status: 400 });
    }

    const normalizedKeyword = keyword.trim().toLowerCase();

    const existing = await prisma.keywordQuestion.findUnique({
      where: { keyword: normalizedKeyword },
    });

    if (existing) {
      return NextResponse.json({
        id: existing.id,
        keyword: existing.keyword,
        questions: JSON.parse(existing.questions),
        createdAt: existing.createdAt.toISOString(),
        cached: true,
      });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Generiere die 20 häufigsten und relevantesten Fragen, die Nutzer zu dem Keyword "${normalizedKeyword}" stellen. Die Fragen sollen typische Suchanfragen widerspiegeln, die echte Nutzer in Google eingeben würden.

Antworte ausschließlich mit einem JSON-Array von 20 Strings, ohne zusätzlichen Text oder Erklärungen. Beispielformat:
["Frage 1?", "Frage 2?", ...]

Die Fragen sollen auf Deutsch sein, es sei denn das Keyword ist eindeutig englischsprachig.`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "Keine Antwort von Anthropic erhalten" }, { status: 500 });
    }

    let questions: string[];
    try {
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Kein JSON-Array gefunden");
      }
      questions = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("Ungültiges Array");
      }
    } catch {
      return NextResponse.json(
        { error: "Antwort konnte nicht als JSON geparsed werden", raw: textContent.text },
        { status: 500 }
      );
    }

    const saved = await prisma.keywordQuestion.create({
      data: {
        keyword: normalizedKeyword,
        questions: JSON.stringify(questions),
      },
    });

    return NextResponse.json({
      id: saved.id,
      keyword: saved.keyword,
      questions,
      createdAt: saved.createdAt.toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Questions API error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allQuestions = await prisma.keywordQuestion.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      allQuestions.map((q) => ({
        id: q.id,
        keyword: q.keyword,
        questions: JSON.parse(q.questions),
        createdAt: q.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Questions GET error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
    }

    await prisma.keywordQuestion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Questions DELETE error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
