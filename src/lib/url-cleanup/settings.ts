import { prisma } from "@/lib/prisma";
import {
  DEFAULT_KILL_SETTINGS,
  type KillScoreSettings,
} from "./kill-score";
import { parseKeepUrlPatterns } from "./keep-patterns";

function fromRow(row: {
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
  keepUrlPatterns: string[];
}): KillScoreSettings {
  return {
    gscPeriod: row.gscPeriod,
    maxGscClicks: row.maxGscClicks,
    maxGscImpressions: row.maxGscImpressions,
    maxAaVisits: row.maxAaVisits,
    maxAaLeads: row.maxAaLeads,
    lastmodMonths: row.lastmodMonths,
    capMissingLabs: row.capMissingLabs,
    capMissingAdobe: row.capMissingAdobe,
    vetoGscClicks: row.vetoGscClicks,
    vetoAaVisits: row.vetoAaVisits,
    keepUrlPatterns: row.keepUrlPatterns ?? [],
  };
}

export async function getKillSettings(): Promise<KillScoreSettings> {
  const row = await prisma.urlCleanupSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", ...DEFAULT_KILL_SETTINGS },
  });
  return fromRow(row);
}

export async function saveKillSettings(
  patch: Partial<KillScoreSettings>
): Promise<KillScoreSettings> {
  await getKillSettings();
  const data: Partial<KillScoreSettings> = { ...patch };
  if (patch.keepUrlPatterns !== undefined) {
    data.keepUrlPatterns = parseKeepUrlPatterns(patch.keepUrlPatterns);
  }
  const row = await prisma.urlCleanupSettings.update({
    where: { id: "default" },
    data,
  });
  return fromRow(row);
}
