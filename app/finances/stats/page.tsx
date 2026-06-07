export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatsClient from "./StatsClient";

export interface AnneeStats {
  annee: number;
  veauxCount: number;
  veauxKgTotal: number;
  veauxPrixMoyen: number | null;
  veauxCA: number;
  vachesCount: number;
  vachesKgCarcasse: number;
  vachesPrixMoyen: number | null;
  vachesCA: number;
  caTotal: number;
  tauxProductivite: number | null;
}

export interface SortieDetail {
  id: string;
  date: string;
  type: string;
  acheteur: string | null;
  poids: number | null;
  poidsVif: number | null;
  rendementCarcasse: number | null;
  prixKilo: number | null;
  prixDefinitifHT: number | null;
  prixPrevuHT: number | null;
  notes: string | null;
  causeMortalite: string | null;
  isVeau: boolean;
  animal: { nutrav: string; nobovi: string | null; sexbov: string };
}

async function getStatsPluri(): Promise<{ stats: AnneeStats[]; sortiesParAnnee: Record<number, SortieDetail[]> }> {
  const anneeMin = new Date().getFullYear() - 5;

  const [sorties, velagesParAnneeRaw] = await Promise.all([
    prisma.sortie.findMany({
      where: { date: { gte: new Date(`${anneeMin}-01-01`) } },
      include: {
        animal: {
          select: {
            nutrav: true, nobovi: true, sexbov: true,
            velageVeau: { select: { id: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.velage.findMany({
      where: { date: { gte: new Date(`${anneeMin}-01-01`) } },
      select: { date: true },
    }),
  ]);

  const velagesCountByAnnee = new Map<number, number>();
  for (const v of velagesParAnneeRaw) {
    const annee = new Date(v.date).getFullYear();
    velagesCountByAnnee.set(annee, (velagesCountByAnnee.get(annee) ?? 0) + 1);
  }

  const byAnnee = new Map<number, typeof sorties>();
  for (const s of sorties) {
    const annee = new Date(s.date).getFullYear();
    if (!byAnnee.has(annee)) byAnnee.set(annee, []);
    byAnnee.get(annee)!.push(s);
  }

  const annees = [...new Set([...byAnnee.keys()])].sort();

  const stats = annees.map((annee) => {
    const rows = byAnnee.get(annee) ?? [];
    const veaux = rows.filter((s) => s.type === "ELEVAGE" && s.animal.velageVeau !== null);
    const vaches = rows.filter((s) => s.type === "BOUCHERIE");
    const elevageVaches = rows.filter((s) => s.type === "ELEVAGE" && s.animal.velageVeau === null);

    const veauxCount = veaux.length;
    const veauxKgTotal = veaux.reduce((s, v) => s + (v.poids ?? 0), 0);
    const veauxPrix = veaux.filter((v) => v.prixKilo).map((v) => v.prixKilo!);
    const veauxPrixMoyen = veauxPrix.length ? veauxPrix.reduce((a, b) => a + b, 0) / veauxPrix.length : null;
    const veauxCA = veaux.reduce((s, v) => s + (v.prixDefinitifHT ?? v.prixPrevuHT ?? 0), 0);

    const vachesCount = vaches.length;
    const vachesKgCarcasse = vaches.reduce((s, v) => s + (v.poids ?? 0), 0);
    const vachesPrix = vaches.filter((v) => v.prixKilo).map((v) => v.prixKilo!);
    const vachesPrixMoyen = vachesPrix.length ? vachesPrix.reduce((a, b) => a + b, 0) / vachesPrix.length : null;
    const vachesCA = [...vaches, ...elevageVaches].reduce(
      (s, v) => s + (v.prixDefinitifHT ?? v.prixPrevuHT ?? 0), 0
    );

    const caTotal = veauxCA + vachesCA;
    const velagesAnnee = velagesCountByAnnee.get(annee) ?? 0;
    const tauxProductivite = velagesAnnee > 0 ? Math.round((veauxCount / velagesAnnee) * 100) : null;

    return {
      annee, veauxCount, veauxKgTotal, veauxPrixMoyen, veauxCA,
      vachesCount, vachesKgCarcasse, vachesPrixMoyen, vachesCA,
      caTotal, tauxProductivite,
    };
  });

  const sortiesParAnnee: Record<number, SortieDetail[]> = {};
  for (const annee of annees) {
    const rows = byAnnee.get(annee) ?? [];
    sortiesParAnnee[annee] = rows.map((s) => ({
      id: s.id,
      date: s.date.toISOString(),
      type: s.type,
      acheteur: s.acheteur,
      poids: s.poids,
      poidsVif: s.poidsVif,
      rendementCarcasse: s.rendementCarcasse,
      prixKilo: s.prixKilo,
      prixDefinitifHT: s.prixDefinitifHT,
      prixPrevuHT: s.prixPrevuHT,
      notes: s.notes,
      causeMortalite: s.causeMortalite,
      isVeau: s.type === "ELEVAGE" && s.animal.velageVeau !== null,
      animal: { nutrav: s.animal.nutrav, nobovi: s.animal.nobovi, sexbov: s.animal.sexbov },
    }));
  }

  return { stats, sortiesParAnnee };
}

interface PageProps {
  searchParams: Promise<{ annee?: string; vue?: string }>;
}

export default async function FinancesStatsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { stats, sortiesParAnnee } = await getStatsPluri();
  const anneeActive = sp.annee ? parseInt(sp.annee) : new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mt-2">
          <Link href="/finances" className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50">
            <ArrowLeft size={18} />
          </Link>
          <h2 className="text-xl font-bold text-gray-800 flex-1">Statistiques pluriannuelles</h2>
          <span className="text-xs text-gray-400">{stats.length} années</span>
        </div>
        <StatsClient stats={stats} sortiesParAnnee={sortiesParAnnee} anneeActive={anneeActive} />
      </div>
    </div>
  );
}
