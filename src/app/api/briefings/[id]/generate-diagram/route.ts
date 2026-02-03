import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAgentur } from "@/lib/rbac";
import OpenAI from "openai";
import { put, del } from "@vercel/blob";

// POST - Diagramm aus bodyContent generieren und in Vercel Blob speichern
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Nur Agentur-User können Diagramme generieren
    if (!isAgentur(user.role)) {
      return NextResponse.json({ error: "Nur für Agentur-Nutzer verfügbar" }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key nicht konfiguriert" },
        { status: 500 }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Vercel Blob Token nicht konfiguriert" },
        { status: 500 }
      );
    }

    const { id } = await params;

    // Briefing laden
    const briefing = await prisma.briefing.findUnique({
      where: { id },
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    // Prüfen ob bodyContent vorhanden ist
    if (!briefing.bodyContent) {
      return NextResponse.json(
        { error: "Kein Fliesstext/Struktur vorhanden. Bitte zuerst das Feld 'Fliesstext/Struktur' ausfüllen." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Prompt für die Bildgenerierung erstellen
    const imagePrompt = buildImagePrompt(briefing);

    // Bild mit DALL-E generieren
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024", // Breites Format für Diagramme
      quality: "standard",
      style: "natural",
    });

    const imageUrl = imageResponse.data[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Fehler bei der Bildgenerierung" },
        { status: 500 }
      );
    }

    // Bild herunterladen
    const imageResponseFetch = await fetch(imageUrl);
    if (!imageResponseFetch.ok) {
      return NextResponse.json(
        { error: "Fehler beim Herunterladen des generierten Bildes" },
        { status: 500 }
      );
    }

    const imageBlob = await imageResponseFetch.blob();

    // Altes Diagramm löschen falls vorhanden
    if (briefing.diagramUrl) {
      try {
        await del(briefing.diagramUrl);
      } catch (deleteError) {
        console.error("Error deleting old diagram:", deleteError);
        // Weiter machen auch wenn Löschen fehlschlägt
      }
    }

    // Neues Bild in Vercel Blob speichern
    const filename = `briefings/${briefing.id}/diagram-${Date.now()}.png`;
    const blob = await put(filename, imageBlob, {
      access: "public",
      contentType: "image/png",
    });

    // Briefing mit neuer diagramUrl aktualisieren
    const updatedBriefing = await prisma.briefing.update({
      where: { id },
      data: { diagramUrl: blob.url },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      briefing: updatedBriefing,
      diagramUrl: blob.url,
    });
  } catch (error) {
    console.error("Error generating diagram:", error);
    return NextResponse.json(
      { error: "Fehler bei der Diagramm-Generierung" },
      { status: 500 }
    );
  }
}

// DELETE - Diagramm löschen
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Nur Agentur-User können Diagramme löschen
    if (!isAgentur(user.role)) {
      return NextResponse.json({ error: "Nur für Agentur-Nutzer verfügbar" }, { status: 403 });
    }

    const { id } = await params;

    const briefing = await prisma.briefing.findUnique({
      where: { id },
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    // Diagramm aus Blob löschen
    if (briefing.diagramUrl) {
      try {
        await del(briefing.diagramUrl);
      } catch (deleteError) {
        console.error("Error deleting diagram from blob:", deleteError);
      }
    }

    // diagramUrl im Briefing auf null setzen
    const updatedBriefing = await prisma.briefing.update({
      where: { id },
      data: { diagramUrl: null },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ briefing: updatedBriefing });
  } catch (error) {
    console.error("Error deleting diagram:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Diagramms" },
      { status: 500 }
    );
  }
}

interface BriefingData {
  title: string;
  briefingType: string;
  focusKeyword: string | null;
  bodyContent: string | null;
  h1: string | null;
  mainParagraph: string | null;
  topicCluster: string | null;
}

function buildImagePrompt(briefing: BriefingData): string {
  // Kontext aus dem Briefing extrahieren
  const topic = briefing.focusKeyword || briefing.h1 || briefing.title;
  const structure = briefing.bodyContent || "";
  
  // H2/H3 Überschriften aus bodyContent extrahieren
  const headings: string[] = [];
  const h2Matches = structure.matchAll(/##\s*H2:\s*([^\n]+)/gi);
  const h3Matches = structure.matchAll(/###\s*H3:\s*([^\n]+)/gi);
  
  for (const match of h2Matches) {
    headings.push(match[1].trim());
  }
  for (const match of h3Matches) {
    headings.push(match[1].trim());
  }

  // Briefing-Typ spezifische Anpassungen
  let diagramType = "informative infographic";
  let styleHints = "clean, professional, corporate";
  
  if (briefing.briefingType === "lexicon") {
    diagramType = "educational diagram or concept map";
    styleHints = "simple, educational, easy to understand";
  } else if (briefing.briefingType === "edit_content") {
    diagramType = "process flow or comparison chart";
    styleHints = "clear structure, visual hierarchy";
  }

  // Prompt zusammenbauen
  const prompt = `Create a ${diagramType} visualization for the topic "${topic}".

The diagram should illustrate the following key concepts and structure:
${headings.length > 0 ? headings.map(h => `- ${h}`).join("\n") : "Based on the main topic"}

${briefing.mainParagraph ? `Context: ${briefing.mainParagraph.substring(0, 200)}` : ""}
${briefing.topicCluster ? `Related topics: ${briefing.topicCluster.substring(0, 150)}` : ""}

Style requirements:
- ${styleHints}
- Modern, flat design with subtle gradients
- Use a professional color palette (blues, grays, with accent colors)
- Include icons or simple illustrations for each concept
- Text should be minimal but readable
- Layout should be logical and flow naturally
- NO photographs, only vector-style graphics and diagrams
- White or light gray background
- Swiss/German business context

The image should work as a visual summary that helps readers understand the content structure at a glance.`;

  return prompt;
}
