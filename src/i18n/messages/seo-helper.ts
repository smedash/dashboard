import { defineMessages } from "../config";

export const seoHelperMessages = defineMessages({
  de: {
    title: "SEO Helper",
    subtitle: "Praktische Tools für deinen SEO-Alltag",
    intro:
      "Hier findest du eine Sammlung von kleinen, aber mächtigen Tools, die dir bei täglichen SEO-Aufgaben helfen. Von der Titel-Optimierung bis zur Schema-Markup-Generierung – wähle einfach den passenden Helper aus.",
    ideasNote:
      "Hast du Ideen für weitere Helper? Erstelle ein Feature-Request im Bugs & Features Bereich.",
    comingSoon: "Coming Soon",
    open: "Öffnen",
    helpers: {
      "url-checker": {
        title: "URL Ranking Factor Checker",
        description:
          "Prüfe URLs gegen die aus dem Google API Leak bekannten Ranking-Faktoren (NSR, NavBoost, QualityBoost, WebRef, SpamBrain).",
      },
      benchmarker: {
        title: "Benchmarker",
        description:
          "Vergleiche deinen Content mit den Top-Konkurrenten in der Schweiz und finde Content-Gaps und Verbesserungspotenziale.",
      },
      "title-generator": {
        title: "Title Generator",
        description:
          "Generiere SEO-optimierte Titel und Meta-Descriptions basierend auf deinen Keywords und Inhalten.",
      },
      "serp-preview": {
        title: "SERP Preview",
        description: "Vorschau wie deine Seite in den Google-Suchergebnissen erscheinen wird.",
      },
      "schema-generator": {
        title: "Schema Generator",
        description:
          "Erstelle strukturierte Daten (JSON-LD) für Rich Snippets wie FAQ, HowTo, Produkte und mehr.",
      },
      "content-analyzer": {
        title: "Content Analyzer",
        description:
          "Analysiere deinen Content auf SEO-Faktoren wie Keyword-Dichte, Lesbarkeit und Struktur.",
      },
      "keyword-clustering": {
        title: "Keyword Clustering",
        description:
          "Gruppiere verwandte Keywords automatisch in thematische Cluster für eine bessere Content-Strategie.",
      },
      "faq-generator": {
        title: "FAQ Generator",
        description:
          "Generiere häufig gestellte Fragen (FAQs) basierend auf deinem Keyword für Content und Rich Snippets.",
      },
      "ai-summarizer": {
        title: "AI Summarizer",
        description:
          "Lasse KI den Inhalt einer beliebigen Webseite zusammenfassen und die wichtigsten Informationen extrahieren.",
      },
    } as Record<string, { title: string; description: string }>,
  },
  en: {
    title: "SEO Helper",
    subtitle: "Practical tools for your everyday SEO work",
    intro:
      "Here you'll find a collection of small but powerful tools that help you with daily SEO tasks. From title optimization to schema markup generation – just pick the right helper.",
    ideasNote:
      "Have ideas for more helpers? Create a feature request in the Bugs & Features section.",
    comingSoon: "Coming soon",
    open: "Open",
    helpers: {
      "url-checker": {
        title: "URL Ranking Factor Checker",
        description:
          "Check URLs against the ranking factors known from the Google API leak (NSR, NavBoost, QualityBoost, WebRef, SpamBrain).",
      },
      benchmarker: {
        title: "Benchmarker",
        description:
          "Compare your content with the top competitors in Switzerland and find content gaps and room for improvement.",
      },
      "title-generator": {
        title: "Title Generator",
        description:
          "Generate SEO-optimized titles and meta descriptions based on your keywords and content.",
      },
      "serp-preview": {
        title: "SERP Preview",
        description: "Preview how your page will appear in Google search results.",
      },
      "schema-generator": {
        title: "Schema Generator",
        description:
          "Create structured data (JSON-LD) for rich snippets such as FAQ, HowTo, products and more.",
      },
      "content-analyzer": {
        title: "Content Analyzer",
        description:
          "Analyze your content for SEO factors such as keyword density, readability and structure.",
      },
      "keyword-clustering": {
        title: "Keyword Clustering",
        description:
          "Automatically group related keywords into topical clusters for a better content strategy.",
      },
      "faq-generator": {
        title: "FAQ Generator",
        description:
          "Generate frequently asked questions (FAQs) based on your keyword for content and rich snippets.",
      },
      "ai-summarizer": {
        title: "AI Summarizer",
        description:
          "Let AI summarize the content of any web page and extract the key information.",
      },
    },
  },
});
