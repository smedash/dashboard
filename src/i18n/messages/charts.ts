import { defineMessages } from "../config";

/** Texte der Chart-Komponenten */
export const chartsMessages = defineMessages({
  de: {
    count: "Anzahl",
    noData: "Keine Daten verfügbar",
    sunburst: {
      generalCategory: "Allgemein",
      score: (score: string) => `Bewertung: ${score} / 10`,
      priority: (priority: string) => `Priorität: ${priority}`,
      responsibleTeams: "Zuständige Teams:",
      legend: {
        immature: "1-3: Unausgereift",
        slightlyMature: "4-5: Wenig ausgereift",
        mature: "6-7: Ausgereift",
        fullyMature: "8-10: Vollständig ausgereift",
        priority: "Priorität:",
        priorityA: "A: Höchste Priorität",
        priorityB: "B: Hohe Priorität",
        priorityC: "C: Mittlere Priorität",
        priorityD: "D: Niedrige Priorität",
      },
    },
  },
  en: {
    count: "Count",
    noData: "No data available",
    sunburst: {
      generalCategory: "General",
      score: (score: string) => `Score: ${score} / 10`,
      priority: (priority: string) => `Priority: ${priority}`,
      responsibleTeams: "Responsible teams:",
      legend: {
        immature: "1-3: Immature",
        slightlyMature: "4-5: Slightly mature",
        mature: "6-7: Mature",
        fullyMature: "8-10: Fully mature",
        priority: "Priority:",
        priorityA: "A: Highest priority",
        priorityB: "B: High priority",
        priorityC: "C: Medium priority",
        priorityD: "D: Low priority",
      },
    },
  },
});
