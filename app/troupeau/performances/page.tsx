import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, BarChart2 } from "lucide-react";
import PerformancesClient from "./PerformancesClient";

export interface VachePerf {
  vacheId: string;
  nutrav: string;
  nobovi: string | null;
  statut: string;
  // IVV
  nbVelages: number;
  ivvMoyen: number | null; // jours
  ivvMin: number | null;
  ivvMax: number | null;
  velages: { date: string; pereNom: string | null; ivvJours: number | null }[];
  // GMQ descendance
  nbVeauxAvecGmq: number;
  gmqMoyen: number | null; // g/j
  // Veaux détail
  veaux: {
    veauId: string;
    nutrav: string;
    nobovi: string | null;
    sexe: string;
    dateNaissance: string;
    pereNom: string | null;
    gmq: number | null;
    poids1: number | null;
    poidsN: number | null;
  }[];
  // Score combiné 0-100
  score: number | null;
}

async function getPerformancesData(): Promise<VachePerf[]> {
  const vaches = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      sexbov: "F",
      estGenisse: false,
      OR: [{ categorie: null }, { categorie: { not: "ENGRAISSEMENT" } }],
    },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      statut: true,
      velagesVache: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          pereNom: true,
          pereNunati: true,
          veauId: true,
          veau: {
            select: {
              id: true,
              nutrav: true,
              nobovi: true,
              sexbov: true,
              danais: true,
              pesees: {
                orderBy: { date: "asc" },
                select: { date: true, poids: true },
              },
            },
          },
          gestation: {
            select: {
              saillie: {
                select: {
                  taureau: { select: { nopere: true, nupere: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const result: VachePerf[] = [];

  for (const vache of vaches) {
    const velages = vache.velagesVache;
    if (velages.length === 0) continue;

    // IVV
    const ivvList: number[] = [];
    const velagesDetail: VachePerf["velages"] = [];

    for (let i = 0; i < velages.length; i++) {
      const v = velages[i];
      let ivvJours: number | null = null;
      if (i > 0) {
        ivvJours = Math.round(
          (v.date.getTime() - velages[i - 1].date.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (ivvJours > 0 && ivvJours < 1000) ivvList.push(ivvJours);
      }
      const pereLabel =
        v.gestation?.saillie?.taureau?.nopere ??
        v.gestation?.saillie?.taureau?.nupere ??
        v.pereNom ??
        v.pereNunati ??
        null;
      velagesDetail.push({ date: v.date.toISOString(), pereNom: pereLabel, ivvJours });
    }

    const ivvMoyen =
      ivvList.length > 0
        ? Math.round(ivvList.reduce((a, b) => a + b, 0) / ivvList.length)
        : null;

    // GMQ veaux
    const veauxDetail: VachePerf["veaux"] = [];
    let gmqSum = 0;
    let gmqCount = 0;

    for (const velage of velages) {
      if (!velage.veau) continue;
      const veau = velage.veau;
      const pesees = veau.pesees;

      const poids1 = pesees.length > 0 ? pesees[0].poids : null;
      const poidsN = pesees.length > 1 ? pesees[pesees.length - 1].poids : null;
      const dateDerniere = pesees.length > 1 ? pesees[pesees.length - 1].date : null;

      let gmq: number | null = null;
      if (poids1 !== null && poidsN !== null && dateDerniere !== null) {
        const ageJours =
          (dateDerniere.getTime() - veau.danais.getTime()) / (1000 * 60 * 60 * 24);
        if (ageJours > 0) {
          gmq = Math.round(((poidsN - poids1) / ageJours) * 1000);
          gmqSum += gmq;
          gmqCount++;
        }
      }

      const pereLabel =
        velage.gestation?.saillie?.taureau?.nopere ??
        velage.gestation?.saillie?.taureau?.nupere ??
        velage.pereNom ??
        velage.pereNunati ??
        null;

      veauxDetail.push({
        veauId: veau.id,
        nutrav: veau.nutrav,
        nobovi: veau.nobovi,
        sexe: veau.sexbov,
        dateNaissance: veau.danais.toISOString(),
        pereNom: pereLabel,
        gmq,
        poids1,
        poidsN,
      });
    }

    const gmqMoyen = gmqCount > 0 ? Math.round(gmqSum / gmqCount) : null;

    // Score combiné : IVV (cible 365j) + GMQ (cible 1200 g/j)
    let score: number | null = null;
    const scores: number[] = [];
    if (ivvMoyen !== null) {
      // Plus proche de 365 = mieux. Max pénalité à ±200j.
      const ivvScore = Math.max(0, 100 - Math.abs(ivvMoyen - 365) / 2);
      scores.push(ivvScore);
    }
    if (gmqMoyen !== null) {
      const gmqScore = Math.min(100, (gmqMoyen / 1500) * 100);
      scores.push(gmqScore);
    }
    if (scores.length > 0) {
      score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    result.push({
      vacheId: vache.id,
      nutrav: vache.nutrav,
      nobovi: vache.nobovi,
      statut: vache.statut,
      nbVelages: velages.length,
      ivvMoyen,
      ivvMin: ivvList.length > 0 ? Math.min(...ivvList) : null,
      ivvMax: ivvList.length > 0 ? Math.max(...ivvList) : null,
      velages: velagesDetail,
      nbVeauxAvecGmq: gmqCount,
      gmqMoyen,
      veaux: veauxDetail,
      score,
    });
  }

  return result;
}

export default async function PerformancesPage() {
  const data = await getPerformancesData();

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 space-y-6">
      <div className="flex items-center gap-3 mt-2">
        <Link
          href="/troupeau"
          className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart2 size={20} className="text-indigo-600" />
            Performances des vaches
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            IVV · GMQ descendance · Score global
          </p>
        </div>
      </div>

      <PerformancesClient data={data} />
    </div>
  );
}
