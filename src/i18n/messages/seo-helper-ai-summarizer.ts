import { defineMessages } from "../config";

export const seoHelperAiSummarizerMessages = defineMessages({
  de: {
    title: "AI Summarizer",
    subtitle: "Lasse KI den Inhalt einer Webseite zusammenfassen",
    urlLabel: "Website URL",
    urlPlaceholder: "https://www.beispiel.ch/seite",
    analyzing: "Analysiere...",
    summarize: "Zusammenfassen",
    errors: {
      summaryFailed: "Fehler bei der Zusammenfassung",
      unknown: "Unbekannter Fehler",
    },
    intents: {
      informational: "Informativ",
      commercial: "Kommerziell",
      transactional: "Transaktional",
      navigational: "Navigational",
    } as Record<string, string>,
    howItWorksLabel: "So funktioniert's:",
    howItWorksText:
      "Gib eine URL ein und die KI analysiert den Inhalt der Seite. Du erhältst eine strukturierte Zusammenfassung mit den wichtigsten Informationen, Themen, Zielgruppe und SEO-relevanten Keywords.",
    pageAnalyzed: "Seite analysiert",
    charactersAnalyzed: (count: string) => `${count} Zeichen analysiert`,
    readingTime: (time: string) => `~${time} Lesezeit`,
    summary: "Zusammenfassung",
    keyTakeaways: "Kernaussagen",
    mainTopics: "Hauptthemen",
    faqTitle: "Häufige Fragen & Content-Abdeckung",
    answered: (n: number) => `${n} beantwortet`,
    missing: (n: number) => `${n} fehlt`,
    answeredPercent: (percent: number) => `${percent}% der häufigen Fragen werden im Content beantwortet`,
    optimizationRecommended: "Content-Optimierung empfohlen",
    todosCopied: "ToDos erfolgreich kopiert",
    copyAsTask: "Als Task kopieren",
    answerQuestion: (question: string) => `Beantworte: "${question}"`,
    taskText: (pageTitle: string, questions: string, url: string) => `Content-Optimierung: ${pageTitle}

Folgende häufig gestellte Fragen werden im Content nicht beantwortet:

${questions}

Quelle: ${url}`,
    pageType: "Seitentyp",
    contentType: "Content-Typ",
    searchIntent: "Suchintention",
    targetAudience: "Zielgruppe",
    seoKeywords: "SEO Keywords",
    copySummary: "Zusammenfassung kopieren",
    copyText: {
      faqHeading: (answered: number, total: number) => `Häufige Fragen (${answered}/${total} beantwortet)`,
      executiveSummary: "Executive Summary",
      details: "Details",
      source: "Quelle",
    },
    emptyTitle: "Webseite zusammenfassen",
    emptyText:
      'Gib oben eine URL ein und klicke auf "Zusammenfassen". Die KI analysiert den Inhalt und erstellt eine strukturierte Übersicht.',
  },
  en: {
    title: "AI Summarizer",
    subtitle: "Let AI summarize the content of a web page",
    urlLabel: "Website URL",
    urlPlaceholder: "https://www.example.com/page",
    analyzing: "Analyzing...",
    summarize: "Summarize",
    errors: {
      summaryFailed: "Error creating the summary",
      unknown: "Unknown error",
    },
    intents: {
      informational: "Informational",
      commercial: "Commercial",
      transactional: "Transactional",
      navigational: "Navigational",
    },
    howItWorksLabel: "How it works:",
    howItWorksText:
      "Enter a URL and the AI analyzes the page content. You'll get a structured summary with the key information, topics, target audience and SEO-relevant keywords.",
    pageAnalyzed: "Page analyzed",
    charactersAnalyzed: (count: string) => `${count} characters analyzed`,
    readingTime: (time: string) => `~${time} reading time`,
    summary: "Summary",
    keyTakeaways: "Key takeaways",
    mainTopics: "Main topics",
    faqTitle: "Frequent questions & content coverage",
    answered: (n: number) => `${n} answered`,
    missing: (n: number) => `${n} missing`,
    answeredPercent: (percent: number) => `${percent}% of frequent questions are answered in the content`,
    optimizationRecommended: "Content optimization recommended",
    todosCopied: "To-dos copied successfully",
    copyAsTask: "Copy as task",
    answerQuestion: (question: string) => `Answer: "${question}"`,
    taskText: (pageTitle: string, questions: string, url: string) => `Content optimization: ${pageTitle}

The following frequently asked questions are not answered in the content:

${questions}

Source: ${url}`,
    pageType: "Page type",
    contentType: "Content type",
    searchIntent: "Search intent",
    targetAudience: "Target audience",
    seoKeywords: "SEO keywords",
    copySummary: "Copy summary",
    copyText: {
      faqHeading: (answered: number, total: number) => `Frequent questions (${answered}/${total} answered)`,
      executiveSummary: "Executive summary",
      details: "Details",
      source: "Source",
    },
    emptyTitle: "Summarize a web page",
    emptyText:
      'Enter a URL above and click "Summarize". The AI analyzes the content and creates a structured overview.',
  },
});
