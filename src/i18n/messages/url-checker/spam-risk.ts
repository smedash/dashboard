import { defineMessages } from "@/i18n/config";

export const urlCheckerSpamRiskMessages = defineMessages({
  de: {
    exactMatchDomain: {
      factor: "Exact-Match-Domain (EMD)",
      warnRecommendation: (domain: string) =>
        `Domain "${domain}" sieht nach einer Exact-Match-Domain aus. Google's exactMatchDomainDemotion kann solche Domains abstrafen.`,
      passRecommendation: "Keine auffällige Exact-Match-Domain erkannt.",
    },
    thinContent: {
      factor: "Thin Content Risiko",
      wordsRatioValue: (words: number, ratio: number) => `${words} Wörter, Ratio: ${ratio}%`,
      failRecommendation:
        "Sehr wenig sichtbarer Text im Verhältnis zum HTML. SpamBrain erkennt Thin Content Patterns die auf automatisch generierte oder manipulative Seiten hindeuten.",
      ratioValue: (ratio: number) => `Text/HTML-Ratio: ${ratio}%`,
      warnRecommendation:
        "Niedriges Text-zu-HTML-Verhältnis. Viel Code/Markup im Verhältnis zum sichtbaren Inhalt kann ein negatives Signal sein.",
      passRecommendation: "Gesundes Text-zu-HTML-Verhältnis.",
    },
    linkSpam: {
      factor: "Link-Spam-Signale",
      noLinksValue: "Keine externen Links",
      noLinksRecommendation: "Keine externen Links – kein Link-Spam-Risiko.",
      suspiciousValue: (n: number) => `${n} verdächtige Links`,
      suspiciousRecommendation: (n: number) =>
        `${n} Links zu potentiell spam-relevanten Domains erkannt. Google's spamrank bewertet ausgehende Links zu bekannten Spam-Seiten.`,
      ratioValue: (external: number, internal: number) => `${external} extern vs ${internal} intern`,
      ratioRecommendation:
        "Unnatürlich viele externe Links im Verhältnis zu internen. Das kann als Link-Selling-Signal gewertet werden.",
      passValue: (external: number) => `${external} extern, Ratio ok`,
      passRecommendation: "Keine Link-Spam-Signale erkannt.",
    },
    cloaking: {
      factor: "Cloaking-Indikatoren",
      signalsValue: (n: number) => `${n} Signale`,
      failRecommendation:
        "Mehrere Cloaking-verdächtige Muster erkannt (UA-Sniffing, JS-Redirects, versteckte Elemente). SpamBrain erkennt Cloaking als schweren Verstoß.",
      oneSignalValue: "1 Signal",
      warnRecommendation:
        "Ein potentielles Cloaking-Signal erkannt. Stelle sicher, dass alle Inhalte für Googlebot und Nutzer identisch sind.",
      noneValue: "Keine",
      passRecommendation: "Keine Cloaking-Indikatoren gefunden.",
    },
  },
  en: {
    exactMatchDomain: {
      factor: "Exact-match domain (EMD)",
      warnRecommendation: (domain: string) =>
        `Domain "${domain}" looks like an exact-match domain. Google's exactMatchDomainDemotion can demote such domains.`,
      passRecommendation: "No suspicious exact-match domain detected.",
    },
    thinContent: {
      factor: "Thin content risk",
      wordsRatioValue: (words: number, ratio: number) => `${words} words, ratio: ${ratio}%`,
      failRecommendation:
        "Very little visible text relative to the HTML. SpamBrain detects thin content patterns that indicate auto-generated or manipulative pages.",
      ratioValue: (ratio: number) => `Text/HTML ratio: ${ratio}%`,
      warnRecommendation:
        "Low text-to-HTML ratio. A lot of code/markup relative to visible content can be a negative signal.",
      passRecommendation: "Healthy text-to-HTML ratio.",
    },
    linkSpam: {
      factor: "Link spam signals",
      noLinksValue: "No external links",
      noLinksRecommendation: "No external links – no link spam risk.",
      suspiciousValue: (n: number) => `${n} suspicious links`,
      suspiciousRecommendation: (n: number) =>
        `${n} links to potentially spam-related domains detected. Google's spamrank evaluates outbound links to known spam sites.`,
      ratioValue: (external: number, internal: number) => `${external} external vs ${internal} internal`,
      ratioRecommendation:
        "Unnaturally many external links relative to internal ones. This can be interpreted as a link-selling signal.",
      passValue: (external: number) => `${external} external, ratio ok`,
      passRecommendation: "No link spam signals detected.",
    },
    cloaking: {
      factor: "Cloaking indicators",
      signalsValue: (n: number) => `${n} signals`,
      failRecommendation:
        "Several cloaking-like patterns detected (UA sniffing, JS redirects, hidden elements). SpamBrain treats cloaking as a serious violation.",
      oneSignalValue: "1 signal",
      warnRecommendation:
        "One potential cloaking signal detected. Make sure all content is identical for Googlebot and users.",
      noneValue: "None",
      passRecommendation: "No cloaking indicators found.",
    },
  },
});
