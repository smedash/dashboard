import { defineMessages } from "../config";

export const seoHelperBenchmarkerMessages = defineMessages({
  de: {
    title: "Benchmarker",
    subtitle: "Vergleiche deinen Content mit den Top-Konkurrenten",
    errors: {
      serpFailed: "Fehler bei der SERP-Abfrage",
      analysisFailed: "Fehler bei der Analyse",
      unknown: "Unbekannter Fehler",
    },
    priorities: {
      high: "Hoch",
      medium: "Mittel",
      low: "Niedrig",
    } as Record<string, string>,
    categories: {
      Content: "Content",
      Struktur: "Struktur",
      SEO: "SEO",
      UX: "UX",
    } as Record<string, string>,
    step1: {
      title: "Keyword eingeben",
      placeholder: "z.B. Hypothek Schweiz, Kreditkarte vergleichen...",
      searching: "Suche...",
      loadSerp: "SERP laden",
      hint: "Sucht die Top 10 Google-Ergebnisse für dein Keyword in der Schweiz",
    },
    step2: {
      title: "Konkurrenten auswählen",
      deselectAll: "Alle abwählen",
      selectAll: "Alle auswählen",
      selectedCount: (selected: number, total: number) =>
        `${selected} von ${total} Konkurrenten ausgewählt`,
    },
    step3: {
      title: "Eigene URL eingeben & analysieren",
      placeholder: "https://www.deine-seite.ch/deine-unterseite",
      analyzing: "Analysiere...",
      startAnalysis: "Analyse starten",
      hint: (n: number) => `Deine URL wird mit ${n} Konkurrenten verglichen`,
    },
    stats: {
      ownWords: "Wörter (Deine Seite)",
      vsCompetitors: (value: string) => `vs. Ø ${value} (Konkurrenz)`,
      headings: "Überschriften",
      contentGaps: "Content Gaps",
      missingTopics: "Themen die fehlen",
      recommendations: "Empfehlungen",
      improvements: "Verbesserungsvorschläge",
    },
    contentGaps: {
      title: "Content Gaps",
      intro: "Diese Themen werden von deinen Konkurrenten behandelt, fehlen aber auf deiner Seite:",
      foundIn: (hosts: string) => `Gefunden bei: ${hosts}`,
    },
    recommendations: {
      title: "Empfehlungen",
      intro: "Konkrete Verbesserungsvorschläge basierend auf der Analyse:",
    },
    competitors: {
      title: "Analysierte Konkurrenten",
      url: "URL",
      words: "Wörter",
      headings: "Überschriften",
      you: "Du",
    },
    empty: {
      title: "Content-Benchmark starten",
      text: "Gib ein Keyword ein, um die Top 10 Google-Ergebnisse in der Schweiz zu laden. Wähle dann Konkurrenten aus und vergleiche deinen Content mit deren Inhalten.",
    },
    howItWorks: {
      title: "So funktioniert der Benchmarker",
      steps: [
        "1. Gib ein Keyword ein und lade die Top 10 Suchergebnisse aus der Schweiz",
        "2. Wähle die Konkurrenten aus, mit denen du dich vergleichen möchtest",
        "3. Gib deine eigene URL ein und starte die Analyse",
        "4. Erhalte Content-Gaps und konkrete Verbesserungsvorschläge",
      ],
    },
  },
  en: {
    title: "Benchmarker",
    subtitle: "Compare your content with the top competitors",
    errors: {
      serpFailed: "Error fetching the SERP",
      analysisFailed: "Error during analysis",
      unknown: "Unknown error",
    },
    priorities: {
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    categories: {
      Content: "Content",
      Struktur: "Structure",
      SEO: "SEO",
      UX: "UX",
    },
    step1: {
      title: "Enter keyword",
      placeholder: "e.g. mortgage Switzerland, compare credit cards...",
      searching: "Searching...",
      loadSerp: "Load SERP",
      hint: "Fetches the top 10 Google results for your keyword in Switzerland",
    },
    step2: {
      title: "Select competitors",
      deselectAll: "Deselect all",
      selectAll: "Select all",
      selectedCount: (selected: number, total: number) =>
        `${selected} of ${total} ${total === 1 ? "competitor" : "competitors"} selected`,
    },
    step3: {
      title: "Enter your URL & analyze",
      placeholder: "https://www.your-site.com/your-subpage",
      analyzing: "Analyzing...",
      startAnalysis: "Start analysis",
      hint: (n: number) => `Your URL will be compared with ${n} ${n === 1 ? "competitor" : "competitors"}`,
    },
    stats: {
      ownWords: "Words (your page)",
      vsCompetitors: (value: string) => `vs. avg. ${value} (competitors)`,
      headings: "Headings",
      contentGaps: "Content gaps",
      missingTopics: "Missing topics",
      recommendations: "Recommendations",
      improvements: "Suggested improvements",
    },
    contentGaps: {
      title: "Content gaps",
      intro: "These topics are covered by your competitors but are missing on your page:",
      foundIn: (hosts: string) => `Found at: ${hosts}`,
    },
    recommendations: {
      title: "Recommendations",
      intro: "Concrete suggestions for improvement based on the analysis:",
    },
    competitors: {
      title: "Analyzed competitors",
      url: "URL",
      words: "Words",
      headings: "Headings",
      you: "You",
    },
    empty: {
      title: "Start a content benchmark",
      text: "Enter a keyword to load the top 10 Google results in Switzerland. Then select competitors and compare your content with theirs.",
    },
    howItWorks: {
      title: "How the Benchmarker works",
      steps: [
        "1. Enter a keyword and load the top 10 search results from Switzerland",
        "2. Select the competitors you want to compare yourself with",
        "3. Enter your own URL and start the analysis",
        "4. Get content gaps and concrete suggestions for improvement",
      ],
    },
  },
});
