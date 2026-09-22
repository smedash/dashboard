export type KillBand = "high" | "medium" | "low" | "keep";

export type KillScoreSettings = {
  gscPeriod: string;
  maxGscClicks: number;
  maxGscImpressions: number;
  maxAaVisits: number;
  maxAaLeads: number;
  lastmodMonths: number;
  capMissingLabs: number;
  capMissingAdobe: number;
  vetoGscClicks: number;
  vetoAaVisits: number;
};

export const DEFAULT_KILL_SETTINGS: KillScoreSettings = {
  gscPeriod: "28d",
  maxGscClicks: 10,
  maxGscImpressions: 100,
  maxAaVisits: 50,
  maxAaLeads: 0,
  lastmodMonths: 24,
  capMissingLabs: 70,
  capMissingAdobe: 85,
  vetoGscClicks: 500,
  vetoAaVisits: 1000,
};

export type KillScoreInput = {
  gscClicks: number;
  gscImpressions: number;
  gscPeriod: string | null;
  aaVisits: number;
  aaFormSuccess: number;
  aaHasData: boolean;
  hasFocusKeywords: boolean;
  labsHasData: boolean;
  labsFetchedAt: Date | null;
  labsBestRank: number | null;
  labsMaxSearchVolume: number | null;
  lastmod: Date | null;
  cleanupStatus: string;
};

export type KillScoreResult = {
  killConfidence: number;
  killReason: string;
  killBand: KillBand;
};

const PERIOD_LABELS: Record<string, string> = {
  "7d": "7 Tage",
  "28d": "28 Tage",
  "3m": "3 Monate",
  "6m": "6 Monate",
  "8m": "8 Monate",
  "12m": "12 Monate",
};

function periodLabel(period: string | null, fallback: string): string {
  if (!period) return fallback;
  return PERIOD_LABELS[period] ?? period;
}

function bandFor(score: number): KillBand {
  if (score <= 0) return "keep";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function fmt(n: number): string {
  return n.toLocaleString("de-CH");
}

export function computeKillScore(
  row: KillScoreInput,
  settings: KillScoreSettings
): KillScoreResult {
  const gscPeriodLabel = periodLabel(row.gscPeriod ?? settings.gscPeriod, "GSC-Zeitraum");
  const reasons: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (row.cleanupStatus === "keep") {
    return {
      killConfidence: 0,
      killBand: "keep",
      killReason: "Nicht löschen: manuell als behalten markiert.",
    };
  }

  if (row.aaFormSuccess > settings.maxAaLeads) {
    return {
      killConfidence: 0,
      killBand: "keep",
      killReason: `Nicht löschen: ${fmt(row.aaFormSuccess)} Form-Success (Leads) in 12 Monaten (Schwelle ${fmt(settings.maxAaLeads)}).`,
    };
  }

  if (row.gscClicks >= settings.vetoGscClicks) {
    return {
      killConfidence: 0,
      killBand: "keep",
      killReason: `Nicht löschen: ${fmt(row.gscClicks)} organische Klicks (GSC, ${gscPeriodLabel}, Veto ab ${fmt(settings.vetoGscClicks)}).`,
    };
  }

  if (row.aaVisits >= settings.vetoAaVisits) {
    return {
      killConfidence: 0,
      killBand: "keep",
      killReason: `Nicht löschen: ${fmt(row.aaVisits)} Adobe-Visits in 12 Monaten (Veto ab ${fmt(settings.vetoAaVisits)}).`,
    };
  }

  if (row.gscClicks < settings.maxGscClicks) {
    score += 20;
    reasons.push(
      `${fmt(row.gscClicks)} organische Klicks (GSC, ${gscPeriodLabel}, Schwelle ${fmt(settings.maxGscClicks)})`
    );
    if (row.gscClicks === 0) score += 10;
  }

  if (row.gscImpressions < settings.maxGscImpressions) {
    score += 15;
    reasons.push(
      `${fmt(row.gscImpressions)} Impressions (GSC, ${gscPeriodLabel}, Schwelle ${fmt(settings.maxGscImpressions)})`
    );
    if (row.gscImpressions === 0) score += 5;
  }

  if (row.aaVisits < settings.maxAaVisits) {
    score += 20;
    reasons.push(
      `${fmt(row.aaVisits)} Adobe-Visits (12 Monate, Schwelle ${fmt(settings.maxAaVisits)})`
    );
    if (row.aaVisits === 0) score += 10;
  }

  if (row.aaFormSuccess <= settings.maxAaLeads) {
    score += 15;
    reasons.push(`${fmt(row.aaFormSuccess)} Leads (Adobe Form Success, 12 Monate)`);
  }

  if (row.hasFocusKeywords) {
    score -= 25;
    reasons.push("Fokuskeyword vorhanden (Redaktionsplan) — eher behalten");
  } else {
    score += 5;
    reasons.push("kein Fokuskeyword");
  }

  if (row.labsHasData) {
    const vol = row.labsMaxSearchVolume ?? 0;
    const rank = row.labsBestRank;
    if (rank != null && rank <= 10 && vol > 0) {
      score -= 20;
      reasons.push(
        `ranked Keyword Pos. ${rank} mit Suchvolumen ${fmt(vol)} — eher behalten`
      );
    } else if (vol === 0 || rank == null) {
      score += 5;
      reasons.push("ranked Keywords ohne Suchvolumen");
    }
  } else if (row.labsFetchedAt) {
    score += 5;
    reasons.push("keine ranked Keywords (DataForSEO)");
  } else {
    missing.push("ranked Keywords noch nicht abgerufen, Score unsicherer");
  }

  if (!row.aaHasData) {
    missing.push("kein Adobe-Match (URL nicht in den Exporten)");
  }

  if (row.lastmod) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - settings.lastmodMonths);
    if (row.lastmod < cutoff) {
      score += 5;
      reasons.push(
        `lastmod älter als ${settings.lastmodMonths} Monate (${row.lastmod.toISOString().slice(0, 10)})`
      );
    }
  }

  score = Math.max(0, Math.min(100, score));

  if (!row.labsHasData && !row.labsFetchedAt) {
    score = Math.min(score, settings.capMissingLabs);
  }
  if (!row.aaHasData) {
    score = Math.min(score, settings.capMissingAdobe);
  }

  const band = bandFor(score);
  const prefix =
    band === "keep"
      ? "Nicht löschen"
      : band === "high"
        ? "Löschen wahrscheinlich"
        : band === "medium"
          ? "Löschen möglich"
          : "Löschen unsicher";

  const body = reasons.length > 0 ? reasons.join("; ") : "keine Kill-Signale";
  const miss = missing.length > 0 ? ` ${missing.join(" ")}.` : "";
  const valueNote = band === "high" || band === "medium" ? " Geringer Business-Value." : "";

  return {
    killConfidence: score,
    killBand: band,
    killReason: `${prefix}: ${body}.${miss}${valueNote}`.replace(/\.\./g, ".").trim(),
  };
}
