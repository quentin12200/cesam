export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Baby, HeartPulse, Percent, Users } from "lucide-react";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

async function getOverviewData() {
  const now = new Date();
  const debutAnnee = new Date(now.getFullYear(), 0, 1);
  const dansTrenteJours = addDays(now, 30);

  const [
    nbVaches,
    nbGenissesMoinsUnAn,
    nbGenissesUnDeuxAns,
    nbGenissesDeuxTroisAns,
    nbMales,
    gestantes,
    velagesSousTrenteJours,
    morts,
  ] = await Promise.all([
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: false } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -365) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -730), lt: addDays(now, -365) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -1095), lt: addDays(now, -730) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "M" } }),
    prisma.gestation.count({ where: { etat: { in: ["VERT", "ROSE"] } } }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: addDays(now, -14), lte: dansTrenteJours },
      },
    }),
    prisma.sortie.findMany({
      where: { type: "MORT", date: { gte: debutAnnee } },
      select: { causeMortalite: true },
    }),
  ]);

  const totalActif = nbVaches + nbGenissesMoinsUnAn + nbGenissesUnDeuxAns + nbGenissesDeuxTroisAns + nbMales;
  const tauxGestantes = nbVaches > 0 ? Math.round((gestantes / nbVaches) * 100) : 0;
  const tauxMortalite = totalActif + morts.length > 0
    ? Math.round((morts.length / (totalActif + morts.length)) * 100)
    : 0;

  const causes = new Map<string, number>();
  for (const mort of morts) {
    if (!mort.causeMortalite) continue;
    causes.set(mort.causeMortalite, (causes.get(mort.causeMortalite) ?? 0) + 1);
  }

  return {
    nbVaches,
    nbGenissesMoinsUnAn,
    nbGenissesUnDeuxAns,
    nbGenissesDeuxTroisAns,
    nbMales,
    totalActif,
    gestantes,
    tauxGestantes,
    velagesSousTrenteJours,
    mortsCount: morts.length,
    tauxMortalite,
    causes: [...causes.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export default async function VueEnsembleElevagePage() {
  const data = await getOverviewData();

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <div className="flex items-center gap-3">
        <Link
          href="/finances?onglet=performances"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 bg-white"
          aria-label="Retour aux performances"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vue d’ensemble de l’élevage</h1>
          <p className="text-sm text-gray-500">Indicateurs techniques, hors accueil</p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <Users size={18} className="text-green-700" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{data.totalActif}</p>
          <p className="text-xs text-gray-500">Animaux actifs</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <Percent size={18} className="text-emerald-700" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{data.tauxGestantes}%</p>
          <p className="text-xs text-gray-500">Vaches gestantes</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <Baby size={18} className="text-rose-700" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{data.velagesSousTrenteJours}</p>
          <p className="text-xs text-gray-500">Vêlages sous 30 j</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <HeartPulse size={18} className="text-red-700" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{data.tauxMortalite}%</p>
          <p className="text-xs text-gray-500">Mortalité cette année</p>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-bold text-gray-900">Composition du troupeau</h2>
        <div className="mt-3 divide-y divide-gray-100">
          {[
            ["Vaches", data.nbVaches],
            ["Génisses de moins d’un an", data.nbGenissesMoinsUnAn],
            ["Génisses de 1 à 2 ans", data.nbGenissesUnDeuxAns],
            ["Génisses de 2 à 3 ans", data.nbGenissesDeuxTroisAns],
            ["Mâles", data.nbMales],
          ].map(([label, count]) => (
            <div key={String(label)} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-gray-700">{label}</span>
              <strong className="text-gray-900">{count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-gray-900">Mortalité {new Date().getFullYear()}</h2>
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
            {data.mortsCount} décès
          </span>
        </div>
        {data.causes.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Aucune cause renseignée cette année.</p>
        ) : (
          <div className="mt-3 divide-y divide-gray-100">
            {data.causes.map(([cause, count]) => (
              <div key={cause} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-700">{cause}</span>
                <strong className="text-gray-900">{count}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
