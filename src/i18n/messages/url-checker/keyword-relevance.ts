import { defineMessages } from "@/i18n/config";

export const urlCheckerKeywordRelevanceMessages = defineMessages({
  de: {
    positionValue: (position: number) => `Position ${position}`,
    containedValue: "Enthalten",
    title: {
      factor: "Keyword im Title",
      missingValue: (keyword: string) => `"${keyword}" nicht im Title`,
      missingRecommendation: (keyword: string) =>
        `Das Fokus-Keyword "${keyword}" fehlt im Title-Tag. Google gewichtet Keywords im Title besonders stark (originalTitleHardTokenCount).`,
      lateRecommendation: (position: number) =>
        `Keyword erst ab Zeichen ${position} im Title. Platziere es möglichst weit vorne für stärkere Relevanz.`,
      passRecommendation: "Fokus-Keyword ist prominent im Title platziert.",
    },
    h1: {
      factor: "Keyword in H1",
      noH1Value: "Keine H1",
      noH1Recommendation: "Keine H1 vorhanden – kann Keyword nicht prüfen.",
      missingValue: (keyword: string) => `"${keyword}" nicht in H1`,
      missingRecommendation:
        "Das Fokus-Keyword fehlt in der H1. Die H1 sollte das Hauptthema der Seite klar benennen.",
      passRecommendation: "Fokus-Keyword ist in der H1 vorhanden.",
    },
    metaDescription: {
      factor: "Keyword in Meta-Description",
      noDescValue: "Keine Meta-Desc",
      noDescRecommendation: "Keine Meta-Description vorhanden.",
      missingValue: (keyword: string) => `"${keyword}" nicht enthalten`,
      missingRecommendation:
        "Das Keyword fehlt in der Meta-Description. Google bolded Keyword-Matches im Snippet, was die CTR erhöht.",
      passRecommendation:
        "Keyword ist in der Meta-Description – wird im SERP-Snippet hervorgehoben.",
    },
    firstParagraph: {
      factor: "Keyword im ersten Absatz",
      missingValue: "Nicht in den ersten 500 Zeichen",
      missingRecommendation:
        "Das Keyword erscheint nicht früh im Content. Google wertet frühe Erwähnung als Relevanz-Signal (termFrequency/proximity).",
      positionValue: (chars: number) => `Nach ${chars} Zeichen`,
      passRecommendation: "Keyword wird früh im Content erwähnt – starkes Relevanz-Signal.",
    },
    url: {
      factor: "Keyword in URL",
      missingValue: "Nicht in URL-Pfad",
      missingRecommendation:
        "Das Keyword ist nicht im URL-Pfad enthalten. Eine sprechende URL mit Keyword stärkt das Relevanz-Signal.",
      passValue: "In URL enthalten",
      passRecommendation: "Keyword ist im URL-Pfad – gutes Signal für Suchrelevanz.",
    },
    density: {
      factor: "Keyword-Dichte (TF)",
      noTextRecommendation: "Nicht genug Text für Analyse.",
      zeroValue: "0 Vorkommen",
      zeroRecommendation: (keyword: string) =>
        `Das Keyword "${keyword}" kommt im Text nicht vor. Es muss natürlich im Content erwähnt werden.`,
      highRecommendation: (density: number) =>
        `Keyword-Dichte von ${density}% ist hoch. Google's keywordStuffingScore könnte anschlagen. Optimal: 1–2%.`,
      lowRecommendation: (count: number, words: number, density: number) =>
        `Nur ${count} Erwähnungen bei ${words} Wörtern (${density}%). Erhöhe leicht oder nutze semantische Varianten.`,
      passRecommendation: "Keyword-Dichte ist im optimalen Bereich.",
    },
  },
  en: {
    positionValue: (position: number) => `Position ${position}`,
    containedValue: "Included",
    title: {
      factor: "Keyword in title",
      missingValue: (keyword: string) => `"${keyword}" not in title`,
      missingRecommendation: (keyword: string) =>
        `The focus keyword "${keyword}" is missing from the title tag. Google gives keywords in the title particularly strong weight (originalTitleHardTokenCount).`,
      lateRecommendation: (position: number) =>
        `Keyword only appears from character ${position} in the title. Place it as close to the beginning as possible for stronger relevance.`,
      passRecommendation: "Focus keyword is prominently placed in the title.",
    },
    h1: {
      factor: "Keyword in H1",
      noH1Value: "No H1",
      noH1Recommendation: "No H1 present – cannot check the keyword.",
      missingValue: (keyword: string) => `"${keyword}" not in H1`,
      missingRecommendation:
        "The focus keyword is missing from the H1. The H1 should clearly state the main topic of the page.",
      passRecommendation: "Focus keyword is present in the H1.",
    },
    metaDescription: {
      factor: "Keyword in meta description",
      noDescValue: "No meta description",
      noDescRecommendation: "No meta description present.",
      missingValue: (keyword: string) => `"${keyword}" not included`,
      missingRecommendation:
        "The keyword is missing from the meta description. Google bolds keyword matches in the snippet, which increases CTR.",
      passRecommendation:
        "Keyword is in the meta description – it will be highlighted in the SERP snippet.",
    },
    firstParagraph: {
      factor: "Keyword in first paragraph",
      missingValue: "Not in the first 500 characters",
      missingRecommendation:
        "The keyword does not appear early in the content. Google treats early mentions as a relevance signal (termFrequency/proximity).",
      positionValue: (chars: number) => `After ${chars} characters`,
      passRecommendation: "Keyword is mentioned early in the content – strong relevance signal.",
    },
    url: {
      factor: "Keyword in URL",
      missingValue: "Not in URL path",
      missingRecommendation:
        "The keyword is not in the URL path. A descriptive URL containing the keyword strengthens the relevance signal.",
      passValue: "Included in URL",
      passRecommendation: "Keyword is in the URL path – good signal for search relevance.",
    },
    density: {
      factor: "Keyword density (TF)",
      noTextRecommendation: "Not enough text for analysis.",
      zeroValue: "0 occurrences",
      zeroRecommendation: (keyword: string) =>
        `The keyword "${keyword}" does not appear in the text. It should be mentioned naturally in the content.`,
      highRecommendation: (density: number) =>
        `Keyword density of ${density}% is high. Google's keywordStuffingScore could be triggered. Optimal: 1–2%.`,
      lowRecommendation: (count: number, words: number, density: number) =>
        `Only ${count} mentions in ${words} words (${density}%). Increase slightly or use semantic variants.`,
      passRecommendation: "Keyword density is in the optimal range.",
    },
  },
});
