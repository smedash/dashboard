import { prisma } from "@/lib/prisma";
import {
  DEFAULT_KILL_SETTINGS,
  type KillScoreSettings,
} from "./kill-score";

export async function getKillSettings(): Promise<KillScoreSettings> {
  const row = await prisma.urlCleanupSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", ...DEFAULT_KILL_SETTINGS },
  });
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
  };
}

export async function saveKillSettings(
  patch: Partial<KillScoreSettings>
): Promise<KillScoreSettings> {
  await getKillSettings();
  const row = await prisma.urlCleanupSettings.update({
    where: { id: "default" },
    data: patch,
  });
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
  };
}
