import { defineMessages } from "@/i18n/config";

export const urlCheckerTechnicalMessages = defineMessages({
  de: {
    canonical: {
      factor: "Canonical-Tag",
      missing: "Kein Canonical-Tag gefunden. Setze einen self-referencing Canonical, um Duplicate Content zu vermeiden.",
      otherUrl: (canonical: string) =>
        `Canonical verweist auf eine andere URL (${canonical}). Stelle sicher, dass dies beabsichtigt ist.`,
      ok: "Self-referencing Canonical korrekt gesetzt.",
    },
    robots: {
      factor: "Robots-Meta",
      notSetValue: "nicht gesetzt (Standard: index, follow)",
      notSet: "Kein Robots-Meta-Tag gesetzt – Seite ist standardmäßig indexierbar.",
      noindex: "Seite ist auf noindex gesetzt und wird nicht indexiert. Entferne noindex, wenn die Seite ranken soll.",
      nofollow:
        "nofollow verhindert, dass Google den Links auf dieser Seite folgt. Das kann die interne Verlinkungsstruktur schwächen.",
      ok: "Robots-Meta erlaubt Indexierung und Link-Following.",
    },
    viewport: {
      factor: "Viewport-Meta (Mobile)",
      missing:
        "Kein Viewport-Meta-Tag gefunden. Mobile-First-Indexing erfordert ein responsives Layout mit viewport-Tag.",
      noDeviceWidth:
        'Viewport-Tag ist gesetzt, aber enthält nicht "width=device-width". Optimiere für mobile Geräte.',
      ok: "Viewport korrekt für Mobile-First-Indexing konfiguriert.",
    },
    https: {
      factor: "HTTPS",
      missing: "Die Seite verwendet kein HTTPS. Google bevorzugt verschlüsselte Seiten als Vertrauenssignal.",
      ok: "Seite nutzt HTTPS – Vertrauenssignal erfüllt.",
    },
    htmlSize: {
      factor: "HTML-Größe",
      tooLarge: (kb: number) =>
        `HTML ist ${kb} KB groß (empfohlen: < 200 KB). Große Dokumente verlangsamen Crawling und Rendering.`,
      large: (kb: number) => `HTML ist ${kb} KB. Versuche unter 200 KB zu bleiben für schnelleres Crawling.`,
      ok: "HTML-Größe ist optimal für schnelles Crawling.",
    },
    redirects: {
      factor: "Redirect-Ketten",
      countValue: (n: number) => `${n} Weiterleitungen`,
      noneValue: "Keine",
      oneValue: "1 Weiterleitung",
      tooMany: (n: number) =>
        `${n} Redirects in der Kette. Google folgt maximal 5 Redirects, aber jeder kostet Crawl-Budget.`,
      some: (n: number) => `${n} Redirects erkannt. Versuche, direkte URLs ohne Weiterleitungen zu verwenden.`,
      ok: "Keine problematischen Redirect-Ketten.",
    },
  },
  en: {
    canonical: {
      factor: "Canonical tag",
      missing: "No canonical tag found. Add a self-referencing canonical to avoid duplicate content.",
      otherUrl: (canonical: string) =>
        `Canonical points to a different URL (${canonical}). Make sure this is intentional.`,
      ok: "Self-referencing canonical is set correctly.",
    },
    robots: {
      factor: "Robots meta",
      notSetValue: "not set (default: index, follow)",
      notSet: "No robots meta tag set – the page is indexable by default.",
      noindex: "The page is set to noindex and will not be indexed. Remove noindex if the page should rank.",
      nofollow:
        "nofollow prevents Google from following the links on this page. This can weaken your internal linking structure.",
      ok: "Robots meta allows indexing and link following.",
    },
    viewport: {
      factor: "Viewport meta (mobile)",
      missing: "No viewport meta tag found. Mobile-first indexing requires a responsive layout with a viewport tag.",
      noDeviceWidth: 'Viewport tag is set but does not contain "width=device-width". Optimise for mobile devices.',
      ok: "Viewport is configured correctly for mobile-first indexing.",
    },
    https: {
      factor: "HTTPS",
      missing: "The page does not use HTTPS. Google prefers encrypted pages as a trust signal.",
      ok: "The page uses HTTPS – trust signal met.",
    },
    htmlSize: {
      factor: "HTML size",
      tooLarge: (kb: number) =>
        `HTML is ${kb} KB (recommended: < 200 KB). Large documents slow down crawling and rendering.`,
      large: (kb: number) => `HTML is ${kb} KB. Try to stay below 200 KB for faster crawling.`,
      ok: "HTML size is optimal for fast crawling.",
    },
    redirects: {
      factor: "Redirect chains",
      countValue: (n: number) => `${n} redirects`,
      noneValue: "None",
      oneValue: "1 redirect",
      tooMany: (n: number) =>
        `${n} redirects in the chain. Google follows up to 5 redirects, but each one costs crawl budget.`,
      some: (n: number) => `${n} redirects detected. Try to use direct URLs without redirects.`,
      ok: "No problematic redirect chains.",
    },
  },
});
