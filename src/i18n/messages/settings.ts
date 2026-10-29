import { defineMessages } from "../config";

export const settingsMessages = defineMessages({
  de: {
    title: "Einstellungen",
    feedback: {
      googleLinked: "Google-Konto erfolgreich verbunden!",
      oauth_error: "Fehler bei der Google-Authentifizierung.",
      google_already_linked: "Dieses Google-Konto ist bereits mit einem anderen Benutzer verknüpft.",
      link_failed: "Fehler beim Verknüpfen des Google-Kontos.",
      unknownError: "Ein Fehler ist aufgetreten.",
    } as Record<string, string>,
    account: {
      title: "Account",
      email: "E-Mail",
      name: "Name",
      notSpecified: "Nicht angegeben",
    },
    google: {
      connected: "Google-Konto verbunden",
      availableProperties: (n: number) => `Verfügbare Properties (${n})`,
      connectOther: "Mit anderem Google-Konto verbinden",
      connectHint: "Verbinde Dein Google-Konto, um auf die Search Console Daten zuzugreifen.",
      connect: "Mit Google verbinden",
    },
    conductor: {
      description:
        "Synchronisiert SEO-Health, Indexierbarkeit, Lighthouse-Metriken und Crawler-Frequenz-Daten von Conductor Monitoring (ehem. ContentKing) fuer die ausgewaehlte Property.",
      activeProperty: (domain: string) => `Aktive Property: ${domain}`,
      lastSync: (date: string) => `Letzter Sync: ${date}`,
      syncDone: (pages: number, issues: number, seconds: string) =>
        `Sync abgeschlossen: ${pages} Seiten, ${issues} Issues (${seconds}s)`,
      syncing: "Synchronisiere...",
      syncNow: "Jetzt synchronisieren",
      syncFailed: "Sync fehlgeschlagen",
      conductorSyncFailed: "Conductor Sync fehlgeschlagen",
      viewData: "Daten ansehen",
      history: "Sync-Historie",
      noHistory: "Noch keine Sync-Läufe für diese Property.",
      syncTypes: {
        manual: "Manuell",
        cron: "Automatisch",
      } as Record<string, string>,
      statuses: {
        running: "Läuft",
        paused: "Unterbrochen",
        completed: "Erfolgreich",
        failed: "Fehlgeschlagen",
        aborted: "Abgebrochen",
      },
      pausedHint: "Der Lauf wird beim nächsten Sync an derselben Stelle fortgesetzt. Bis dahin bleiben die bisherigen Daten vollständig sichtbar.",
      abortedHint: "Der Lauf wurde abgebrochen und durch einen neuen ersetzt. Die bisherigen Daten sind unverändert.",
      historyResult: (pages: number, issues: number) => `${pages.toLocaleString("de-DE")} Seiten, ${issues} Issues`,
      historyProgress: (pages: number) => `${pages.toLocaleString("de-DE")} Seiten bisher`,
      syncProgress: (pages: number) => `Synchronisiere... ${pages.toLocaleString("de-DE")} Seiten`,
      syncLocked: "Für diese Website läuft bereits ein Sync. Bitte in ein paar Minuten erneut versuchen.",
    },
    session: {
      title: "Sitzung",
      signOut: "Abmelden",
    },
  },
  en: {
    title: "Settings",
    feedback: {
      googleLinked: "Google account connected successfully!",
      oauth_error: "Google authentication failed.",
      google_already_linked: "This Google account is already linked to another user.",
      link_failed: "Failed to link the Google account.",
      unknownError: "An error occurred.",
    },
    account: {
      title: "Account",
      email: "Email",
      name: "Name",
      notSpecified: "Not specified",
    },
    google: {
      connected: "Google account connected",
      availableProperties: (n: number) => `Available properties (${n})`,
      connectOther: "Connect a different Google account",
      connectHint: "Connect your Google account to access Search Console data.",
      connect: "Connect with Google",
    },
    conductor: {
      description:
        "Syncs SEO health, indexability, Lighthouse metrics and crawler frequency data from Conductor Monitoring (formerly ContentKing) for the selected property.",
      activeProperty: (domain: string) => `Active property: ${domain}`,
      lastSync: (date: string) => `Last sync: ${date}`,
      syncDone: (pages: number, issues: number, seconds: string) =>
        `Sync complete: ${pages} ${pages === 1 ? "page" : "pages"}, ${issues} ${issues === 1 ? "issue" : "issues"} (${seconds}s)`,
      syncing: "Syncing...",
      syncNow: "Sync now",
      syncFailed: "Sync failed",
      conductorSyncFailed: "Conductor sync failed",
      viewData: "View data",
      history: "Sync history",
      noHistory: "No sync runs for this property yet.",
      syncTypes: {
        manual: "Manual",
        cron: "Automatic",
      },
      statuses: {
        running: "Running",
        paused: "Interrupted",
        completed: "Successful",
        failed: "Failed",
        aborted: "Aborted",
      },
      pausedHint: "The run will continue where it stopped on the next sync. Until then the previous data stays fully visible.",
      abortedHint: "The run was aborted and replaced by a new one. The previous data is unchanged.",
      historyResult: (pages: number, issues: number) =>
        `${pages.toLocaleString("en-GB")} ${pages === 1 ? "page" : "pages"}, ${issues} ${issues === 1 ? "issue" : "issues"}`,
      historyProgress: (pages: number) =>
        `${pages.toLocaleString("en-GB")} ${pages === 1 ? "page" : "pages"} so far`,
      syncProgress: (pages: number) =>
        `Syncing... ${pages.toLocaleString("en-GB")} ${pages === 1 ? "page" : "pages"}`,
      syncLocked: "A sync is already running for this website. Please try again in a few minutes.",
    },
    session: {
      title: "Session",
      signOut: "Sign out",
    },
  },
});
