import { defineMessages } from "../config";

/** Texte der gemeinsamen UI-Komponenten (Tabelle, Zeitraum- und Property-Auswahl) */
export const uiMessages = defineMessages({
  de: {
    dataTable: {
      noData: "Keine Daten vorhanden",
      range: (from: number, to: number, total: number) => `${from}-${to} von ${total}`,
      previousPage: "Vorherige Seite",
      nextPage: "Nächste Seite",
    },
    periods: {
      "7d": "7 Tage",
      "28d": "28 Tage",
      "3m": "3 Monate",
      "6m": "6 Monate",
      "8m": "8 Monate",
    },
    propertySelector: {
      loadError: "Fehler beim Laden der Properties",
      placeholder: "Property wählen",
    },
  },
  en: {
    dataTable: {
      noData: "No data available",
      range: (from: number, to: number, total: number) => `${from}-${to} of ${total}`,
      previousPage: "Previous page",
      nextPage: "Next page",
    },
    periods: {
      "7d": "7 days",
      "28d": "28 days",
      "3m": "3 months",
      "6m": "6 months",
      "8m": "8 months",
    },
    propertySelector: {
      loadError: "Error loading properties",
      placeholder: "Select property",
    },
  },
});
