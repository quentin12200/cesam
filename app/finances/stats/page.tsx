export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import StatsClient from "./StatsClient";

import BackButton from "@/app/components/BackButton";
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
  categorieSortie: string | null;
  sexeSortie: string | null;
  modeVente: string | null;
  poidsVifVente: number | null;
  prixKgVif: number | null;
  poidsCarcasse: number | null;
  prixKgCarcasse: number | null;
  isVeau: boolean;
  animal: { nutrav: string; nobovi: string | null; sexbov: string };
}

export interface GestationRecord {
  annee: number;
  saison: "Printemps" | "Été" | "Automne" | "Hiver";
  duree: number;
  sexeVeau: "M" | "F" | null;
  typeSaillie: "IA" | "TAUREAU";
  ageMereAnnees: number;
  mereNutrav: string;
  mereNom: string | null;
}

export interface VenteHisto {
  id: string;
  annee: number;
  typeAnimal: string;
  typeVente: string;
  nutrav: string | null;
  animalNom: string | null;
  sexe: string | null;
  poidsVif: number | null;
  prixKgVif: number | null;
  poidsCarc: number | null;
  prixKgCarc: number | null;
  acheteur: string | null;
  date: string;
  total: number | null;
  notes: string | null;
  causeMortalite: string | null;
}

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
    prisma.venteHistorique.findMany({ orderBy: [{ annee: "asc" }, { date: "asc" }] }),
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

  const clesSorties = new Set(
    sorties.map((s) => `${s.animal.nutrav}|${s.date.toISOString().slice(0, 10)}`)
  );
  const ventesHistoUniquesRaw = ventesHistoRaw.filter(
    (v) => !v.nutrav || !clesSorties.has(`${v.nutrav}|${v.date.toISOString().slice(0, 10)}`)
  );

  // Années avec sorties réelles
  const anneesReelles = new Set(byAnnee.keys());

  // Années historiques (saisies manuellement, sans sortie réelle)
  const statsReelles = [...anneesReelles].sort().map((annee) => {
    const rows = byAnnee.get(annee) ?? [];
    const veaux = rows.filter((s) => s.type === "ELEVAGE" && s.animal.velageVeau !== null);
    const vaches = rows.filter((s) => s.type === "BOUCHERIE");
    const elevageVaches = rows.filter((s) => s.type === "ELEVAGE" && s.animal.velageVeau === null);

    const ventesHistoAnnee = ventesHistoUniquesRaw.filter((v) => v.annee === annee && v.typeVente !== "mort");
    const veauxHisto = ventesHistoAnnee.filter((v) => ["veau", "veaux"].includes(v.typeAnimal.trim().toLowerCase()));
    const vachesHisto = ventesHistoAnnee.filter((v) => v.typeAnimal.trim().toLowerCase().startsWith("vache"));

    const veauxCount = veaux.length + veauxHisto.length;
    const veauxKgTotal = veaux.reduce((s, v) => s + (v.poids ?? 0), 0)
      + veauxHisto.reduce((s, v) => s + (v.poidsVif ?? v.poidsCarc ?? 0), 0);
    const veauxPrix = [
      ...veaux.filter((v) => v.prixKilo).map((v) => v.prixKilo!),
      ...veauxHisto.map((v) => v.prixKgVif ?? v.prixKgCarc).filter((v): v is number => v != null),
    ];
    const veauxPrixMoyen = veauxPrix.length ? veauxPrix.reduce((a, b) => a + b, 0) / veauxPrix.length : null;
    const veauxCA = veaux.reduce((s, v) => s + (v.prixDefinitifHT ?? v.prixPrevuHT ?? 0), 0)
      + veauxHisto.reduce((s, v) => s + (v.total ?? 0), 0);

    const vachesCount = vaches.length + vachesHisto.length;
    const vachesKgCarcasse = vaches.reduce((s, v) => s + (v.poids ?? 0), 0)
      + vachesHisto.reduce((s, v) => s + (v.poidsCarc ?? v.poidsVif ?? 0), 0);
    const vachesPrix = [
      ...vaches.filter((v) => v.prixKilo).map((v) => v.prixKilo!),
      ...vachesHisto.map((v) => v.prixKgCarc ?? v.prixKgVif).filter((v): v is number => v != null),
    ];
    const vachesPrixMoyen = vachesPrix.length ? vachesPrix.reduce((a, b) => a + b, 0) / vachesPrix.length : null;
    const vachesCA = [...vaches, ...elevageVaches].reduce(
      (s, v) => s + (v.prixDefinitifHT ?? v.prixPrevuHT ?? 0), 0
    ) + vachesHisto.reduce((s, v) => s + (v.total ?? 0), 0);

    const caTotal = veauxCA + vachesCA;
    const velagesAnnee = velagesCountByAnnee.get(annee) ?? 0;
    const tauxProductivite = velagesAnnee > 0 ? Math.round((veauxCount / velagesAnnee) * 100) : null;

    const veauxMCount = veaux.filter((v) => v.animal.sexbov === "M").length
      + veauxHisto.filter((v) => v.sexe?.toUpperCase() === "M").length;
    const veauxFCount = veaux.filter((v) => v.animal.sexbov === "F").length
      + veauxHisto.filter((v) => v.sexe?.toUpperCase() === "F").length;
    return { annee, veauxCount, veauxMCount, veauxFCount, veauxKgTotal, veauxPrixMoyen, veauxCA, vachesCount, vachesKgCarcasse, vachesPrixMoyen, vachesCA, caTotal, tauxProductivite, isHistorique: ventesHistoAnnee.length > 0 };
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
      categorieSortie: s.categorieSortie,
      sexeSortie: s.sexeSortie,
      modeVente: s.modeVente,
      poidsVifVente: s.poidsVifVente,
      prixKgVif: s.prixKgVif,
      poidsCarcasse: s.poidsCarcasse,
      prixKgCarcasse: s.prixKgCarcasse,
      isVeau: s.type === "ELEVAGE" && s.animal.velageVeau !== null,
      animal: { nutrav: s.animal.nutrav, nobovi: s.animal.nobovi, sexbov: s.animal.sexbov },
    }));
  }

  const nutravsHistoriques = [...new Set(ventesHistoUniquesRaw.map((v) => v.nutrav).filter((v): v is string => Boolean(v)))];
  const animauxHistoriques = nutravsHistoriques.length
    ? await prisma.animal.findMany({
        where: { nutrav: { in: nutravsHistoriques } },
        select: { nutrav: true, nobovi: true },
      })
    : [];
  const nomsAnimaux = new Map(animauxHistoriques.map((animal) => [animal.nutrav, animal.nobovi]));

  const ventesHisto: VenteHisto[] = ventesHistoUniquesRaw.map((v) => ({
    id: v.id,
    annee: v.annee,
    typeAnimal: v.typeAnimal,
    typeVente: v.typeVente,
    nutrav: v.nutrav,
    animalNom: v.nutrav ? (nomsAnimaux.get(v.nutrav) ?? null) : null,
    sexe: v.sexe,
    poidsVif: v.poidsVif,
    prixKgVif: v.prixKgVif,
    poidsCarc: v.poidsCarc,
    prixKgCarc: v.prixKgCarc,
    acheteur: v.acheteur,
    date: v.date.toISOString(),
    total: v.total,
    notes: v.notes,
    causeMortalite: v.causeMortalite,
  }));

  return { stats, sortiesParAnnee, ventesHisto };
}

interface PageProps {
  searchParams: Promise<{ annee?: string; vue?: string }>;
}

export default async function FinancesStatsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [{ stats, sortiesParAnnee, ventesHisto }, gestationRecords] = await Promise.all([
    getStatsPluri(),
    getGestationRecords(),
  ]);
  const anneeActive = sp.annee ? parseInt(sp.annee) : new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mt-2">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50" iconSize={18} />
          <h2 className="text-xl font-bold text-gray-800 flex-1">Statistiques pluriannuelles</h2>
          <span className="text-xs text-gray-400">{stats.length} année{stats.length > 1 ? "s" : ""}</span>
        </div>
        <StatsClient stats={stats} sortiesParAnnee={sortiesParAnnee} anneeActive={anneeActive} ventesHisto={ventesHisto} gestationRecords={gestationRecords} />
      </div>
    </div>
  );
}
