export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatsClient from "./StatsClient";

export interface AnneeStats {
  annee: number;
  veauxCount: number;
  veauxMCount: number;
  veauxFCount: number;
  veauxKgTotal: number;
  veauxPrixMoyen: number | null;
  veauxCA: number;
  vachesCount: number;
  vachesKgCarcasse: number;
  vachesPrixMoyen: number | null;
  vachesCA: number;
  caTotal: number;
  tauxProductivite: number | null;
  isHistorique?: boolean;
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

export interface VenteHisto {
  id: string;
  annee: number;
  typeAnimal: string;
  typeVente: string;
  nutrav: string | null;
  sexe: string | null;
  poidsVif: number | null;
  prixKgVif: number | null;
  poidsCarc: number | null;
  prixKgCarc: number | null;
  acheteur: string | null;
  date: string;
  total: number | null;
  notes: string | null;
}

async function getStatsPluri(): Promise<{ stats: AnneeStats[]; sortiesParAnnee: Record<number, SortieDetail[]>; ventesHisto: VenteHisto[] }> {
  const anneeMin = new Date().getFullYear() - 10;

  const [sorties, velagesParAnneeRaw, historiques, ventesHistoRaw] = await Promise.all([
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
    prisma.statsAnnuelle.findMany({ orderBy: { annee: "asc" } }).catch(() => []),
    prisma.venteHistorique.findMany({ orderBy: [{ annee: "asc" }, { date: "asc" }] }).catch(() => []),
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

  // Années avec sorties réelles
  const anneesReelles = new Set(byAnnee.keys());

  // Années historiques (saisies manuellement, sans sortie réelle)
  const statsReelles = [...anneesReelles].sort().map((annee) => {
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

    const veauxMCount = veaux.filter((v) => v.animal.sexbov === "M").length;
    const veauxFCount = veaux.filter((v) => v.animal.sexbov === "F").length;
    return { annee, veauxCount, veauxMCount, veauxFCount, veauxKgTotal, veauxPrixMoyen, veauxCA, vachesCount, vachesKgCarcasse, vachesPrixMoyen, vachesCA, caTotal, tauxProductivite };
  });

  // Fusionner avec historiques (les années historiques qui n'ont pas de sorties réelles)
  const statsHistoriques: AnneeStats[] = historiques
    .filter((h) => !anneesReelles.has(h.annee))
    .map((h) => ({
      annee: h.annee,
      veauxCount: h.veauxCount,
      veauxMCount: h.veauxMCount ?? 0,
      veauxFCount: h.veauxFCount ?? 0,
      veauxKgTotal: h.veauxKgTotal,
      veauxPrixMoyen: h.veauxPrixMoyen,
      veauxCA: h.veauxCA,
      vachesCount: h.vachesCount,
      vachesKgCarcasse: h.vachesKgCarcasse,
      vachesPrixMoyen: h.vachesPrixMoyen,
      vachesCA: h.vachesCA,
      caTotal: h.veauxCA + h.vachesCA,
      tauxProductivite: h.velagesCount > 0 ? Math.round((h.veauxCount / h.velagesCount) * 100) : null,
      isHistorique: true,
    }));

  const stats = [...statsHistoriques, ...statsReelles].sort((a, b) => a.annee - b.annee);

  const sortiesParAnnee: Record<number, SortieDetail[]> = {};
  for (const annee of anneesReelles) {
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

  const ventesHisto: VenteHisto[] = ventesHistoRaw.map((v) => ({
    id: v.id,
    annee: v.annee,
    typeAnimal: v.typeAnimal,
    typeVente: v.typeVente,
    nutrav: v.nutrav,
    sexe: v.sexe,
    poidsVif: v.poidsVif,
    prixKgVif: v.prixKgVif,
    poidsCarc: v.poidsCarc,
    prixKgCarc: v.prixKgCarc,
    acheteur: v.acheteur,
    date: v.date.toISOString(),
    total: v.total,
    notes: v.notes,
  }));

  return { stats, sortiesParAnnee, ventesHisto };
}

interface PageProps {
  searchParams: Promise<{ annee?: string; vue?: string }>;
}

export default async function FinancesStatsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { stats, sortiesParAnnee, ventesHisto } = await getStatsPluri();
  const anneeActive = sp.annee ? parseInt(sp.annee) : new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mt-2">
          <Link href="/finances" className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50">
            <ArrowLeft size={18} />
          </Link>
          <h2 className="text-xl font-bold text-gray-800 flex-1">Statistiques pluriannuelles</h2>
          <span className="text-xs text-gray-400">{stats.length} année{stats.length > 1 ? "s" : ""}</span>
        </div>
        <StatsClient stats={stats} sortiesParAnnee={sortiesParAnnee} anneeActive={anneeActive} ventesHisto={ventesHisto} />
      </div>
    </div>
  );
}
