import { defineMessages } from "@/i18n/config";

export const urlCheckerContentQualityMessages = defineMessages({
  de: {
    charsValue: (n: number) => `${n} Zeichen`,
    title: {
      factor: "Title-Tag",
      missing: "Kein Title-Tag gefunden. Der Title ist einer der wichtigsten On-Page-Faktoren.",
      tooShort: (n: number) =>
        `Title ist zu kurz (${n} Zeichen). Optimal sind 50–60 Zeichen für maximale SERP-Sichtbarkeit.`,
      tooLong: (n: number) =>
        `Title ist zu lang (${n} Zeichen) und wird in den SERPs abgeschnitten. Optimal: 50–60 Zeichen.`,
      ok: "Title-Länge ist optimal.",
    },
    metaDescription: {
      factor: "Meta-Description",
      missing:
        "Keine Meta-Description vorhanden. Google nutzt sie häufig als Snippet – eine gute Description erhöht die CTR.",
      tooShort: (n: number) =>
        `Meta-Description ist kurz (${n} Zeichen). Nutze 120–155 Zeichen für optimale SERP-Darstellung.`,
      tooLong: (n: number) =>
        `Meta-Description ist zu lang (${n} Zeichen) und wird abgeschnitten. Optimal: 120–155 Zeichen.`,
      ok: "Meta-Description hat eine gute Länge.",
    },
    h1: {
      factor: "H1-Überschrift",
      noneValue: "Keine H1",
      missing: "Keine H1-Überschrift gefunden. Jede Seite braucht genau eine H1 als Hauptüberschrift.",
      multipleValue: (n: number) => `${n} H1-Tags`,
      multiple: (n: number) => `${n} H1-Tags gefunden. Verwende nur eine H1 pro Seite für klare Hierarchie.`,
      ok: "Genau eine H1-Überschrift vorhanden.",
    },
    headings: {
      factor: "Heading-Hierarchie",
      noneValue: "0 Headings",
      missing: "Keine Headings gefunden. Nutze H1–H6 für eine klare Content-Struktur.",
      skipsValue: (total: number) => `${total} Headings (Ebenen übersprungen)`,
      skips: "Heading-Ebenen werden übersprungen (z.B. H1 → H3). Halte die Hierarchie lückenlos.",
      fewH2Value: (total: number, h2: number) => `${total} Headings (nur ${h2} H2)`,
      fewH2: "Wenige Zwischenüberschriften. Mehr H2/H3 verbessern Lesbarkeit und Snippet-Chancen.",
      countValue: (total: number) => `${total} Headings`,
      ok: "Heading-Struktur ist sauber und hierarchisch.",
    },
    wordCount: {
      factor: "Wortanzahl",
      thin: (wc: number) =>
        `Nur ${wc} Wörter. Thin Content wird von QualityBoost/Panda abgestraft. Top-10-Ergebnisse haben durchschnittlich ~1.447 Wörter.`,
      low: (wc: number) =>
        `${wc} Wörter – für informative Inhalte oft zu wenig. Prüfe, ob das Thema mehr Tiefe verdient.`,
      ok: "Ausreichend Content für thematische Tiefe.",
    },
    keywordStuffing: {
      factor: "Keyword-Stuffing",
      noText: "Keine Analyse möglich (zu wenig Text).",
      stuffed: (word: string, density: number) =>
        `Das Wort "${word}" erscheint mit ${density}% Dichte – Google's keywordStuffingScore würde hier anschlagen. Reduziere auf < 3%.`,
      borderline: (word: string, density: number) =>
        `"${word}" hat ${density}% Dichte. Am Grenzwert – verwende mehr Synonyme und semantische Varianten.`,
      maxDensityValue: (density: number) => `Max. Dichte: ${density}%`,
      ok: "Keine auffällige Keyword-Überoptimierung erkannt.",
    },
    imageAlts: {
      factor: "Bild-Alt-Texte",
      noImagesValue: "0 Bilder",
      noImages: "Keine Bilder gefunden. Bilder mit Alt-Text verbessern Relevanz und Zugänglichkeit.",
      withoutAltValue: (missing: number, total: number) => `${missing}/${total} ohne Alt`,
      manyMissing: (missing: number, total: number) =>
        `${missing} von ${total} Bildern haben keinen Alt-Text. Google nutzt Alt-Texte zur Bild-Indexierung und Relevanz-Bewertung.`,
      someMissing: (missing: number) =>
        `${missing} Bilder ohne Alt-Text. Ergänze beschreibende Alt-Attribute für bessere Indexierung.`,
      withAltValue: (withAlt: number, total: number) => `${withAlt}/${total} mit Alt`,
      ok: "Die meisten Bilder haben Alt-Texte.",
    },
    links: {
      factor: "Link-Struktur",
      noneValue: "0 Links",
      none: "Keine Links gefunden. Interne Verlinkung ist essenziell für Crawlability und PageRank-Verteilung.",
      countValue: (internal: number, external: number) => `${internal} intern, ${external} extern`,
      fewInternal: (internal: number) =>
        `Nur ${internal} interne Links. Mehr interne Verlinkung stärkt die thematische Autorität und erleichtert das Crawling.`,
      ok: "Gute Mischung aus internen und externen Links.",
    },
  },
  en: {
    charsValue: (n: number) => `${n} characters`,
    title: {
      factor: "Title tag",
      missing: "No title tag found. The title is one of the most important on-page factors.",
      tooShort: (n: number) =>
        `Title is too short (${n} characters). 50–60 characters are optimal for maximum SERP visibility.`,
      tooLong: (n: number) =>
        `Title is too long (${n} characters) and will be truncated in the SERPs. Optimal: 50–60 characters.`,
      ok: "Title length is optimal.",
    },
    metaDescription: {
      factor: "Meta description",
      missing:
        "No meta description found. Google often uses it as the snippet – a good description increases CTR.",
      tooShort: (n: number) =>
        `Meta description is short (${n} characters). Use 120–155 characters for optimal SERP display.`,
      tooLong: (n: number) =>
        `Meta description is too long (${n} characters) and will be truncated. Optimal: 120–155 characters.`,
      ok: "Meta description has a good length.",
    },
    h1: {
      factor: "H1 heading",
      noneValue: "No H1",
      missing: "No H1 heading found. Every page needs exactly one H1 as its main heading.",
      multipleValue: (n: number) => `${n} H1 tags`,
      multiple: (n: number) => `${n} H1 tags found. Use only one H1 per page for a clear hierarchy.`,
      ok: "Exactly one H1 heading present.",
    },
    headings: {
      factor: "Heading hierarchy",
      noneValue: "0 headings",
      missing: "No headings found. Use H1–H6 for a clear content structure.",
      skipsValue: (total: number) => `${total} headings (levels skipped)`,
      skips: "Heading levels are skipped (e.g. H1 → H3). Keep the hierarchy without gaps.",
      fewH2Value: (total: number, h2: number) => `${total} ${total === 1 ? "heading" : "headings"} (only ${h2} H2)`,
      fewH2: "Few subheadings. More H2/H3 headings improve readability and snippet chances.",
      countValue: (total: number) => `${total} ${total === 1 ? "heading" : "headings"}`,
      ok: "Heading structure is clean and hierarchical.",
    },
    wordCount: {
      factor: "Word count",
      thin: (wc: number) =>
        `Only ${wc} words. Thin content is penalised by QualityBoost/Panda. Top 10 results average ~1,447 words.`,
      low: (wc: number) =>
        `${wc} words – often too little for informational content. Check whether the topic deserves more depth.`,
      ok: "Sufficient content for topical depth.",
    },
    keywordStuffing: {
      factor: "Keyword stuffing",
      noText: "No analysis possible (too little text).",
      stuffed: (word: string, density: number) =>
        `The word "${word}" appears with ${density}% density – Google's keywordStuffingScore would trigger here. Reduce to < 3%.`,
      borderline: (word: string, density: number) =>
        `"${word}" has ${density}% density. Borderline – use more synonyms and semantic variants.`,
      maxDensityValue: (density: number) => `Max. density: ${density}%`,
      ok: "No noticeable keyword over-optimisation detected.",
    },
    imageAlts: {
      factor: "Image alt texts",
      noImagesValue: "0 images",
      noImages: "No images found. Images with alt text improve relevance and accessibility.",
      withoutAltValue: (missing: number, total: number) => `${missing}/${total} without alt`,
      manyMissing: (missing: number, total: number) =>
        `${missing} of ${total} ${total === 1 ? "image has" : "images have"} no alt text. Google uses alt texts for image indexing and relevance assessment.`,
      someMissing: (missing: number) =>
        `${missing} ${missing === 1 ? "image" : "images"} without alt text. Add descriptive alt attributes for better indexing.`,
      withAltValue: (withAlt: number, total: number) => `${withAlt}/${total} with alt`,
      ok: "Most images have alt texts.",
    },
    links: {
      factor: "Link structure",
      noneValue: "0 links",
      none: "No links found. Internal linking is essential for crawlability and PageRank distribution.",
      countValue: (internal: number, external: number) => `${internal} internal, ${external} external`,
      fewInternal: (internal: number) =>
        `Only ${internal} internal ${internal === 1 ? "link" : "links"}. More internal linking strengthens topical authority and makes crawling easier.`,
      ok: "Good mix of internal and external links.",
    },
  },
});
