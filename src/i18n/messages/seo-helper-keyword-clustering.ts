import { defineMessages } from "../config";

export const seoHelperKeywordClusteringMessages = defineMessages({
  de: {
    title: "Keyword Clustering",
    subtitle: "Gruppiere Keywords in thematische Cluster",
    inputLabel: "Keywords eingeben",
    inputHint: "Ein Keyword pro Zeile oder kommagetrennt",
    inputPlaceholder: `hypothek schweiz
hypothek berechnen
hypothek zinsen
hypothek vergleich
immobilien kaufen
haus kaufen schweiz
wohnung kaufen
immobilien finanzierung
kredit aufnehmen
privatkredit vergleich`,
    processing: "Clustere Keywords...",
    process: "Keywords clustern",
    tipsTitle: "Tipps",
    tips: [
      "Verwende mindestens 10 Keywords für bessere Ergebnisse",
      "Keywords werden automatisch nach Themen gruppiert",
      "Exportiere die Cluster als CSV für weitere Analysen",
    ],
    statsKeywords: "Keywords in",
    statsClusters: "Clustern",
    csvExport: "CSV Export",
    keywordCount: (n: number) => `${n} Keywords`,
    miscCluster: "Sonstige",
    emptyState: 'Gib Keywords ein und klicke auf "Keywords clustern"',
  },
  en: {
    title: "Keyword Clustering",
    subtitle: "Group keywords into topical clusters",
    inputLabel: "Enter keywords",
    inputHint: "One keyword per line or comma-separated",
    inputPlaceholder: `mortgage switzerland
calculate mortgage
mortgage rates
compare mortgages
buy property
buy house switzerland
buy apartment
property financing
take out loan
compare personal loans`,
    processing: "Clustering keywords...",
    process: "Cluster keywords",
    tipsTitle: "Tips",
    tips: [
      "Use at least 10 keywords for better results",
      "Keywords are automatically grouped by topic",
      "Export the clusters as CSV for further analysis",
    ],
    statsKeywords: "keywords in",
    statsClusters: "clusters",
    csvExport: "CSV export",
    keywordCount: (n: number) => `${n} ${n === 1 ? "keyword" : "keywords"}`,
    miscCluster: "Other",
    emptyState: 'Enter keywords and click "Cluster keywords"',
  },
});
