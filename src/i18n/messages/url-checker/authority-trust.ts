import { defineMessages } from "@/i18n/config";

export const urlCheckerAuthorityTrustMessages = defineMessages({
  de: {
    https: {
      factor: "HTTPS-Vertrauen",
      failRecommendation:
        "Kein HTTPS. Dies ist ein negatives Trust-Signal in Google's NSR-Framework. Migriere zu HTTPS.",
      passValue: "HTTPS aktiv",
      passRecommendation: "HTTPS ist aktiv – positives Trust-Signal.",
    },
    nofollow: {
      factor: "Externe Links & Nofollow",
      noLinksValue: "Keine externen Links",
      noLinksRecommendation:
        "Keine externen Links vorhanden. Für Informationsseiten können qualitative externe Quellen Vertrauen stärken.",
      tooManyRecommendation:
        "Fast alle externen Links sind nofollow. Ein natürliches Linkprofil enthält auch dofollow-Links zu vertrauenswürdigen Quellen.",
      tooFewRecommendation:
        "Kaum nofollow bei externen Links. Setze nofollow für Werbung, Affiliate und nutzergenerierte Links.",
      passRecommendation: "Ausgewogene Nofollow-Verteilung bei externen Links.",
    },
    hiddenContent: {
      factor: "Versteckte Inhalte",
      hiddenValue: (percent: number) => `${percent}% versteckt`,
      failRecommendation:
        "Hoher Anteil versteckter Elemente (display:none, visibility:hidden). SpamBrain erkennt Hidden-Text-Techniken als Manipulationsversuch.",
      warnRecommendation:
        "Einige versteckte Elemente erkannt. Stelle sicher, dass dies für UX-Zwecke ist (Akkordeons, Menüs) und nicht zur Manipulation.",
      passValue: "Minimal",
      passRecommendation: "Kein auffälliger versteckter Content erkannt.",
    },
    redirect: {
      factor: "Redirect-Integrität",
      hopsValue: (n: number) => `${n} Hops`,
      failRecommendation:
        "Mehrere Redirects in der Kette. Jeder Redirect kann PageRank-Verlust bedeuten und Crawl-Budget verschwenden.",
      redirectsValue: (n: number) => `${n} Redirect(s)`,
      warnRecommendation: "Redirect erkannt. Verlinke möglichst direkt auf die Ziel-URL.",
      passValue: "Direkt",
      passRecommendation: "Kein Redirect – direkte Erreichbarkeit.",
    },
  },
  en: {
    https: {
      factor: "HTTPS trust",
      failRecommendation:
        "No HTTPS. This is a negative trust signal in Google's NSR framework. Migrate to HTTPS.",
      passValue: "HTTPS active",
      passRecommendation: "HTTPS is active – positive trust signal.",
    },
    nofollow: {
      factor: "External links & nofollow",
      noLinksValue: "No external links",
      noLinksRecommendation:
        "No external links found. For informational pages, high-quality external sources can strengthen trust.",
      tooManyRecommendation:
        "Almost all external links are nofollow. A natural link profile also includes dofollow links to trustworthy sources.",
      tooFewRecommendation:
        "Hardly any nofollow on external links. Use nofollow for ads, affiliate and user-generated links.",
      passRecommendation: "Balanced nofollow distribution across external links.",
    },
    hiddenContent: {
      factor: "Hidden content",
      hiddenValue: (percent: number) => `${percent}% hidden`,
      failRecommendation:
        "High share of hidden elements (display:none, visibility:hidden). SpamBrain detects hidden-text techniques as manipulation attempts.",
      warnRecommendation:
        "Some hidden elements detected. Make sure they serve UX purposes (accordions, menus) and are not used for manipulation.",
      passValue: "Minimal",
      passRecommendation: "No suspicious hidden content detected.",
    },
    redirect: {
      factor: "Redirect integrity",
      hopsValue: (n: number) => `${n} hops`,
      failRecommendation:
        "Multiple redirects in the chain. Each redirect can mean PageRank loss and wastes crawl budget.",
      redirectsValue: (n: number) => `${n} redirect(s)`,
      warnRecommendation: "Redirect detected. Link directly to the target URL wherever possible.",
      passValue: "Direct",
      passRecommendation: "No redirect – directly accessible.",
    },
  },
});
