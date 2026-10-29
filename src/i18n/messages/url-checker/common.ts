import { defineMessages } from "../../config";

export const urlCheckerCommonMessages = defineMessages({
  de: {
    yes: "Ja",
    no: "Nein",
    catalogReference: (n: number) => `Leak-Katalog (${n} Checks)`,
    catalogSuffix: (n: number) => ` + Katalog (${n})`,
  },
  en: {
    yes: "Yes",
    no: "No",
    catalogReference: (n: number) => `Leak catalog (${n} checks)`,
    catalogSuffix: (n: number) => ` + catalog (${n})`,
  },
});
