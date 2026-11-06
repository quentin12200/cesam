import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getGestationCalendar } from "@/lib/gestation-calendar";
import LabExplorer from "./LabExplorer";
import { normalizeGenealogyNational } from "@/lib/animal-genealogy-data";
import { getEtatGestation } from "@/lib/utils";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";

export const dynamic = "force-dynamic";

export default async function CesamLabPage() {
  const [animaux, echeances, reproConfig, bulls, children] = await Promise.all([
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      select: {
        id: true, nutrav: true, nobovi: true, sexbov: true, danais: true,
        estGenisse: true, categorie: true, aEchographier: true,
        reproductionEtatManuel: true,
        saillies: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: { id: true, date: true, gestation: { select: { etat: true, dateVelagePrevue: true } } },
        },
        velagesVache: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
      orderBy: { nutrav: "asc" },
    }),
    getGestationCalendar(),
    prisma.exploitationConfig.findUnique({ where: { id: "singleton" }, select: { reproReposObjectifJours: true } }).catch(() => null),
    prisma.taureau.findMany({ select: { id: true, nupere: true, nopere: true, copaip: true, present: true } }),
    prisma.animal.findMany({ select: { nutrav: true, nobovi: true, sexbov: true, danais: true, statut: true, taureauId: true, pereNationalManuel: true, velageVeau: { select: { pereNunati: true, gestation: { select: { saillie: { select: { taureauId: true } } } } } } } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 pb-28">
      <header className="rounded-2xl bg-green-800 p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div><span className="rounded-full bg-white/20 px-2 py-1 text-xs font-bold">PROTOTYPE · LECTURE SEULE</span><h1 className="mt-3 text-2xl font-black">CESAM LAB</h1><p className="mt-1 text-sm text-green-50">Essayons une autre façon de travailler.</p></div>
          <Link href="/config" className="rounded-xl border border-white/50 px-3 py-2 text-sm font-bold text-white">← Retour à CESAM</Link>
        </div>
      </header>
      <LabExplorer
        fathers={bulls.map(bull => {
          const number = normalizeGenealogyNational(bull.nupere);
          const linked = children.filter(a => a.taureauId === bull.id || a.velageVeau?.gestation?.saillie?.taureauId === bull.id || (number.length >= 8 && (normalizeGenealogyNational(a.pereNationalManuel) === number || normalizeGenealogyNational(a.velageVeau?.pereNunati) === number)));
          return { id: bull.id, number: bull.nupere, country: bull.copaip, name: bull.nopere, present: bull.present, offspring: linked.length, presentOffspring: linked.filter(a => a.statut === "ACTIF").length, children: linked.map(a => ({ number: a.nutrav, name: a.nobovi, sex: a.sexbov, birth: a.danais?.toISOString() ?? null, mother: null, status: a.statut })) };
        })}
        animaux={animaux.map((animal) => {
          const dernierVelage = animal.velagesVache[0]?.date ?? null;
          const saillie = getCurrentCycleBreeding(animal.saillies, dernierVelage);
          const reproduction = animal.sexbov === "F" && (animal.categorie === "VACHE" || animal.estGenisse)
            ? getEtatGestation(
                saillie?.date ?? null,
                animal.reproductionEtatManuel ?? saillie?.gestation?.etat ?? null,
                saillie?.gestation?.dateVelagePrevue ?? null,
                dernierVelage,
                false,
                reproConfig?.reproReposObjectifJours ?? 60,
              )
            : null;
          return {
            id: animal.id, nutrav: animal.nutrav, nobovi: animal.nobovi,
            sexbov: animal.sexbov, danais: animal.danais.toISOString(),
            aEchographier: animal.aEchographier, reproduction,
          };
        })}
        echeances={echeances.map((row) => ({ id: row.id, nutrav: row.nutrav, nom: row.nobovi, date: row.dateVelagePrevue.toISOString() }))}
      />
      <p className="text-xs text-gray-500">Cet espace n’enregistre aucun acte et n’altère aucun animal. Les actions de terrain sont présentées ici uniquement pour tester la navigation.</p>
    </main>
  );
}
