import { defineMessages } from "../config";

export const reportingMessages = defineMessages({
  de: {
    title: "Reporting",
    subtitle: "Wähle einen Report-Typ aus oder generiere einen KI-Report",
    loadingData: "Lade Daten...",
    executiveSummary: "Executive Summary",
    stats: {
      totalKeywords: "Keywords gesamt",
      avgPosition: "Ø Position",
      top10: "Top 10",
      top10Subtitle: (pct: string) => `${pct}% aller Keywords`,
      improvedDeclined: "Verbessert / Verschlechtert",
    },
    summary: {
      rankingIntro: "Von ",
      trackedKeywords: (n: number) => `${n} getrackte Keywords`,
      rankingVerb: " ranken ",
      inTop100: " in den Top 100. Davon befinden sich ",
      inTop10: " in den Top 10 (Durchschnittsposition: ",
      inTop10End: ").",
      changeIntro: "Seit dem letzten Update haben sich ",
      improved: (n: number) => `${n} Keywords verbessert`,
      and: " und ",
      declined: (n: number) => `${n} Keywords verschlechtert`,
      changeEnd: ".",
      bestCategoryIntro: "Die beste Kategorie ist ",
      bestCategoryMid: " mit einer durchschnittlichen Position von ",
      bestCategoryEnd: ".",
      topImprover: "Grösster Gewinner: ",
      topDecliner: "Grösster Verlierer: ",
      keywordDelta: (keyword: string, delta: string) => `"${keyword}" (${delta} Positionen)`,
    },
    distribution: {
      title: "Ranking-Verteilung",
      notRanking: "Nicht rankend",
    },
    noData: "Keine Daten",
    noRankingData: {
      before: "Noch keine Ranking-Daten vorhanden. Füge Keywords im ",
      link: "Ranktracker",
      after: " hinzu.",
    },
    ai: {
      title: "KI-generierter Ranking Report",
      description:
        "Generiere eine umfassende KI-Analyse der aktuellen Ranking-Situation mit Handlungsempfehlungen",
      generating: "Generiere Report...",
      generate: "KI-Report generieren",
      errorGenerating: "Fehler beim Generieren des Reports",
      unknownError: "Unbekannter Fehler",
    },
    reportTypesTitle: "Report-Typen",
    comingSoon: "Demnächst",
    reportTypes: {
      ranking: {
        title: "Ranking Report",
        description:
          "Analyse der Keyword-Rankings aus dem Ranktracker mit Positions-Verteilung, Trends und Gewinner/Verlierer.",
      },
      traffic: {
        title: "Traffic Report",
        description:
          "Analyse des organischen Traffics aus der Google Search Console mit Klicks, Impressionen, CTR und Verzeichnis-Auswertung.",
      },
      kvp: {
        title: "KVP Report",
        description:
          "Monatliche Übersicht der SEO-Massnahmen: neue KVPs, Fokus-/Subkeywords und adressierte Reifegradpunkte.",
      },
      tasks: {
        title: "Task Report",
        description:
          "Kanban-Übersicht mit Status, Workload pro Benutzer, überfällige Tasks und Timeline-Informationen.",
      },
      competitor: {
        title: "Wettbewerbs-Report",
        description:
          "Vergleich der eigenen Rankings mit Wettbewerbern und Identifikation von Keyword-Lücken.",
      },
    } as Record<string, { title: string; description: string }>,
  },
  en: {
    title: "Reporting",
    subtitle: "Choose a report type or generate an AI report",
    loadingData: "Loading data...",
    executiveSummary: "Executive summary",
    stats: {
      totalKeywords: "Total keywords",
      avgPosition: "Avg. position",
      top10: "Top 10",
      top10Subtitle: (pct: string) => `${pct}% of all keywords`,
      improvedDeclined: "Improved / declined",
    },
    summary: {
      rankingIntro: "Of ",
      trackedKeywords: (n: number) => `${n} tracked ${n === 1 ? "keyword" : "keywords"}`,
      rankingVerb: ", ",
      inTop100: " rank in the top 100. Of these, ",
      inTop10: " are in the top 10 (average position: ",
      inTop10End: ").",
      changeIntro: "Since the last update, ",
      improved: (n: number) => `${n} ${n === 1 ? "keyword has" : "keywords have"} improved`,
      and: " and ",
      declined: (n: number) => `${n} ${n === 1 ? "keyword has" : "keywords have"} declined`,
      changeEnd: ".",
      bestCategoryIntro: "The best category is ",
      bestCategoryMid: " with an average position of ",
      bestCategoryEnd: ".",
      topImprover: "Biggest winner: ",
      topDecliner: "Biggest loser: ",
      keywordDelta: (keyword: string, delta: string) => `"${keyword}" (${delta} positions)`,
    },
    distribution: {
      title: "Ranking distribution",
      notRanking: "Not ranking",
    },
    noData: "No data",
    noRankingData: {
      before: "No ranking data yet. Add keywords in the ",
      link: "rank tracker",
      after: ".",
    },
    ai: {
      title: "AI-generated ranking report",
      description:
        "Generate a comprehensive AI analysis of the current ranking situation with recommended actions",
      generating: "Generating report...",
      generate: "Generate AI report",
      errorGenerating: "Error generating the report",
      unknownError: "Unknown error",
    },
    reportTypesTitle: "Report types",
    comingSoon: "Coming soon",
    reportTypes: {
      ranking: {
        title: "Ranking report",
        description:
          "Analysis of keyword rankings from the rank tracker with position distribution, trends and winners/losers.",
      },
      traffic: {
        title: "Traffic report",
        description:
          "Analysis of organic traffic from Google Search Console with clicks, impressions, CTR and directory analysis.",
      },
      kvp: {
        title: "KVP report",
        description:
          "Monthly overview of SEO measures: new KVPs, focus/sub-keywords and addressed maturity items.",
      },
      tasks: {
        title: "Task report",
        description:
          "Kanban overview with status, workload per user, overdue tasks and timeline information.",
      },
      competitor: {
        title: "Competitor report",
        description:
          "Comparison of your own rankings with competitors and identification of keyword gaps.",
      },
    },
  },
});
