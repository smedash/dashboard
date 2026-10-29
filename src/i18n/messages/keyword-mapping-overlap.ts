import { defineMessages } from "../config";

export const keywordMappingOverlapMessages = defineMessages({
  de: {
    noLocation: "Ohne Location",
    noKeyword: "Kein Keyword angegeben.",
    backToMapping: "Zurück zum Keyword Mapping",
    title: "Keyword-Überlappung",
    articlesUsing: (n: number) =>
      `${n} ${n === 1 ? "Artikel verwendet" : "Artikel verwenden"} dieses Fokuskeyword.`,
    highRisk: "Hohes Kannibalisierungsrisiko",
    affectedUrls: "Betroffene URLs",
    affectedLocations: "Locations betroffen",
    affectedCategories: "Kategorien betroffen",
    competingHint: (n: number) =>
      `${n} Artikel konkurrieren um dasselbe Fokuskeyword. Es wird empfohlen, die Content-Strategie zu konsolidieren.`,
    noOverlapTitle: "Keine Überlappung gefunden",
    noOverlapHint: (keyword: string) =>
      `Für "${keyword}" wurde keine Keyword-Überlappung erkannt, oder die Analyse wurde noch nicht durchgeführt.`,
    allArticlesWith: (keyword: string) => `Alle Artikel mit Fokuskeyword "${keyword}"`,
    columns: {
      article: "Artikel",
      location: "Location",
      category: "Kategorie",
      seoData: "SEO-Daten",
      allFocusKeywords: "Alle Fokuskeywords",
      reasoning: "Begründung",
    },
    noSeoData: "Keine SEO-Daten",
    byLocation: "Verteilung nach Location",
    articleCount: (n: number) => `${n} Artikel`,
  },
  en: {
    noLocation: "No location",
    noKeyword: "No keyword specified.",
    backToMapping: "Back to keyword mapping",
    title: "Keyword overlap",
    articlesUsing: (n: number) =>
      `${n} ${n === 1 ? "article uses" : "articles use"} this focus keyword.`,
    highRisk: "High cannibalization risk",
    affectedUrls: "Affected URLs",
    affectedLocations: "Locations affected",
    affectedCategories: "Categories affected",
    competingHint: (n: number) =>
      `${n} articles compete for the same focus keyword. Consolidating the content strategy is recommended.`,
    noOverlapTitle: "No overlap found",
    noOverlapHint: (keyword: string) =>
      `No keyword overlap was detected for "${keyword}", or the analysis has not been run yet.`,
    allArticlesWith: (keyword: string) => `All articles with focus keyword "${keyword}"`,
    columns: {
      article: "Article",
      location: "Location",
      category: "Category",
      seoData: "SEO data",
      allFocusKeywords: "All focus keywords",
      reasoning: "Reasoning",
    },
    noSeoData: "No SEO data",
    byLocation: "Distribution by location",
    articleCount: (n: number) => `${n} ${n === 1 ? "article" : "articles"}`,
  },
});
