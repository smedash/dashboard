import { defineMessages } from "../config";

export const superagentMessages = defineMessages({
  de: {
    title: "SuperAgent",
    subtitle: "KI-gestützte SEO-Analyse mit Echtzeit-Daten",
    welcomeTitle: "Willkommen beim SuperAgent",
    welcomeText:
      "Ich bin dein KI-Assistent für SEO-Analysen. Frag mich nach Rankings, Suchvolumen, Backlinks und mehr.",
    suggestedPrompts: [
      "Auf welcher Position rankt ubs.com für 'Hypothek Schweiz'?",
      "Was ist das Suchvolumen für 'Online Banking', 'Mobile Banking' und 'E-Banking'?",
      "Zeig mir eine Zusammenfassung des Backlink-Profils von ubs.com",
      "Welche sind die Top 10 verweisenden Domains?",
    ],
    errorPrefix: (message: string) => `Fehler: ${message}`,
    unknownError: "Ein unbekannter Fehler ist aufgetreten",
    analyzing: "Analysiere Daten...",
    inputPlaceholder: "Frag mich etwas über SEO...",
    footer: "SuperAgent nutzt Claude AI mit DataForSEO für Echtzeit-SEO-Daten",
  },
  en: {
    title: "SuperAgent",
    subtitle: "AI-powered SEO analysis with real-time data",
    welcomeTitle: "Welcome to SuperAgent",
    welcomeText:
      "I'm your AI assistant for SEO analysis. Ask me about rankings, search volume, backlinks and more.",
    suggestedPrompts: [
      "What position does ubs.com rank for 'Hypothek Schweiz'?",
      "What is the search volume for 'Online Banking', 'Mobile Banking' and 'E-Banking'?",
      "Show me a summary of the backlink profile of ubs.com",
      "What are the top 10 referring domains?",
    ],
    errorPrefix: (message: string) => `Error: ${message}`,
    unknownError: "An unknown error occurred",
    analyzing: "Analysing data...",
    inputPlaceholder: "Ask me something about SEO...",
    footer: "SuperAgent uses Claude AI with DataForSEO for real-time SEO data",
  },
});
