import { defineMessages } from "../config";

export const devicesMessages = defineMessages({
  de: {
    title: "Geräte",
    loadingTitle: "Hole Live-Daten aus der GSC...",
    loadingHint: "Das kann einige Sekunden dauern!",
    shareOfClicks: (percent: string) => `${percent}% der Klicks`,
    clicks: "Klicks",
    impressions: "Impressionen",
    ctr: "CTR",
    position: "Position",
    clicksByDevice: "Klicks nach Gerät",
    impressionsByDevice: "Impressionen nach Gerät",
    noData: "Keine Daten verfügbar",
    deviceNames: {
      DESKTOP: "Desktop",
      MOBILE: "Mobile",
      TABLET: "Tablet",
    } as Record<string, string>,
  },
  en: {
    title: "Devices",
    loadingTitle: "Fetching live data from GSC...",
    loadingHint: "This may take a few seconds!",
    shareOfClicks: (percent: string) => `${percent}% of clicks`,
    clicks: "Clicks",
    impressions: "Impressions",
    ctr: "CTR",
    position: "Position",
    clicksByDevice: "Clicks by device",
    impressionsByDevice: "Impressions by device",
    noData: "No data available",
    deviceNames: {
      DESKTOP: "Desktop",
      MOBILE: "Mobile",
      TABLET: "Tablet",
    },
  },
});
