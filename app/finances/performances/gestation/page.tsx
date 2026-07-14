export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import BackButton from "@/app/components/BackButton";
import GestationStats from "../../stats/GestationStats";
import type { GestationRecord } from "./types";

function getSaison(date: Date): GestationRecord["saison"] {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "Printemps";
  if (m >= 6 && m <= 8) return "Été";
  if (m >= 9 && m <= 11) return "Automne";
  return "Hiver";
}

async function getGestationRecords(): Promise<GestationRecord[]> {
  const velages = await prisma.velage.findMany({
    where: { gestationId: { not: null } },
    include: {
      gestation: { include: { saillie: { include: { taureau: { select: { nopere: true } } } } } },
      vache: { select: { danais: true, nobovi: true, nutrav: true } },
      veau: { select: { sexbov: true } },
    },
    orderBy: { date: "asc" },
  });

  const records: GestationRecord[] = [];
  for (const v of velages) {
    if (!v.gestation?.saillie) continue;
    const duree = differenceInDays(v.date, v.gestation.saillie.date);
    if (duree < 240 || duree > 320) continue;
    const ageMereJours = differenceInDays(v.date, v.vache.danais);
    records.push({
      annee: v.date.getFullYear(),
      saison: getSaison(v.date),
      duree,
      sexeVeau: (v.veau?.sexbov as "M" | "F" | null) ?? null,
      typeSaillie: v.gestation.saillie.taureauId ? "TAUREAU" : "IA",
      ageMereAnnees: Math.round((ageMereJours / 365) * 10) / 10,
      mereNutrav: v.vache.nutrav,
      mereNom: v.vache.nobovi,
    });
  }
  return records;
}


export default async function GestationPage() {
  const records = await getGestationRecords();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mt-2">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50" iconSize={18} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-800">Gestation</h2>
            <p className="text-xs text-gray-500">Performances techniques du troupeau</p>
          </div>
        </div>
        <GestationStats records={records} />
      </div>
    </div>
  );
}
