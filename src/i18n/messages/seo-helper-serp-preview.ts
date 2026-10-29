import { defineMessages } from "../config";

export const seoHelperSerpPreviewMessages = defineMessages({
  de: {
    title: "SERP Preview",
    subtitle: "Vorschau deiner Google-Suchergebnisse",
    defaults: {
      url: "https://www.beispiel.ch/ratgeber/hypothek",
      title: "Hypothek Schweiz: Der umfassende Ratgeber 2026",
      description:
        "Erfahren Sie alles Wichtige über Hypotheken in der Schweiz. Unser umfassender Ratgeber bietet Ihnen Expertenwissen, aktuelle Zinsen und praktische Tipps.",
    },
    enterMetaData: "Meta-Daten eingeben",
    urlLabel: "URL",
    urlPlaceholder: "https://www.beispiel.ch/seite",
    titleTag: "Title Tag",
    titlePlaceholder: "Seitentitel",
    metaDescription: "Meta Description",
    descriptionPlaceholder: "Meta-Beschreibung",
    characters: (count: number, max: number) => `${count}/${max} Zeichen`,
    description: "Description",
    optimalLength: "Optimale Länge",
    tooShort: (min: number) => `Zu kurz (min. ${min})`,
    tooLong: (max: number) => `Zu lang (max. ${max})`,
    livePreview: "Live-Vorschau",
    titleFallback: "Seitentitel eingeben...",
    descriptionFallback: "Meta-Beschreibung eingeben...",
    tipLabel: "Tipp:",
    tipText:
      "Google kann Title und Description je nach Suchanfrage anpassen. Diese Vorschau zeigt die wahrscheinlichste Darstellung.",
  },
  en: {
    title: "SERP Preview",
    subtitle: "Preview your Google search results",
    defaults: {
      url: "https://www.example.com/guide/mortgage",
      title: "Mortgages in Switzerland: The comprehensive guide 2026",
      description:
        "Learn everything you need to know about mortgages in Switzerland. Our comprehensive guide offers expert knowledge, current interest rates and practical tips.",
    },
    enterMetaData: "Enter meta data",
    urlLabel: "URL",
    urlPlaceholder: "https://www.example.com/page",
    titleTag: "Title tag",
    titlePlaceholder: "Page title",
    metaDescription: "Meta description",
    descriptionPlaceholder: "Meta description",
    characters: (count: number, max: number) => `${count}/${max} characters`,
    description: "Description",
    optimalLength: "Optimal length",
    tooShort: (min: number) => `Too short (min. ${min})`,
    tooLong: (max: number) => `Too long (max. ${max})`,
    livePreview: "Live preview",
    titleFallback: "Enter page title...",
    descriptionFallback: "Enter meta description...",
    tipLabel: "Tip:",
    tipText:
      "Google may adjust the title and description depending on the search query. This preview shows the most likely appearance.",
  },
});
