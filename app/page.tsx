export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getVaccinsManquants, formatAge } from "@/lib/utils";
import Link from "next/link";
import CowIcon from "@/components/CowIcon";
import Collapsible from "@/app/components/Collapsible";
import ChecklistSection, {
  type ChecklistItem,
  type SubItem,
} from "@/app/components/ChecklistSection";
import QuickSearch from "@/app/components/QuickSearch";
import NotesTerrain from "@/app/components/NotesTerrain";
import RapportGestationButton from "@/app/components/RapportGestationButton";
import PrintSectionButton from "@/app/components/PrintSectionButton";
import AutoPrint from "@/app/components/AutoPrint";
import {
  Baby,
  Wifi,
  AlertTriangle,
  Syringe,
  RefreshCw,
  Tag,
  Scissors,
  Activity,
  Pill,
  ArrowLeft,
} from "lucide-react";

async function getDashboardData() {
  const now = new Date();
  const sevenDaysLater = addDays(now, 7);
  const thirtyDaysLater = addDays(now, 30);
  const ninetyDaysLater = addDays(now, 90);
  const twentyOneDaysLater = addDays(now, 21);
  const sixMonthsAgo = addDays(now, -180);
  const fiveMonthsAgo = addDays(now, -150);

  const [
    vachesActives,
    capteurs,
    vachesAvecSaillies,
    veauxPourVaccins,
    evenementsSanitairesUrgents,
    velagesSemaine,
    velagesPrevus,
    vaccinationPreVelage,
    bolusPreVelage,
    veauxABouclerList,
    veauxASevrerList,
    veauxPresqueSevrables,
    genissesArapatrier,
    vachesACapteur,
    nbVaches,
    nbGenissesBabies,
    nbGenissesMoyennes,
    nbGenissesGrandes,
    nbMales,
  ] = await Promise.all([
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: false } }),
    prisma.capteurVelage.findMany({ orderBy: { numero: "asc" } }),
    prisma.animal.findMany({
      where: { statut: "ACTIF", sexbov: "F", estGenisse: false },
      include: {
        saillies: {
          orderBy: { date: "desc" },
          take: 1,
          include: { gestation: true },
        },
        velagesVache: { orderBy: { date: "desc" }, take: 1 },
      },
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF", danais: { gte: addDays(now, -730) } },
      include: { vaccinations: { select: { vaccin: true, date: true } } },
    }),
    prisma.evenementSanitaire.count({ where: { resolu: false } }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: addDays(now, -14), lte: sevenDaysLater },
      },
    }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: addDays(now, -14), lte: thirtyDaysLater },
      },
    }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: twentyOneDaysLater, lte: ninetyDaysLater },
      },
    }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: twentyOneDaysLater, lte: addDays(now, 45) },
      },
    }),
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        boucleFaite: false,
        velageVeau: { isNot: null },
      },
      select: {
        nutrav: true,
        nobovi: true,
        danais: true,
        velageVeau: {
          select: { vache: { select: { nutrav: true, nobovi: true } } },
        },
      },
      orderBy: { danais: "asc" },
    }),
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        sevreFait: false,
        velageVeau: { isNot: null },
        danais: { lte: sixMonthsAgo },
      },
      select: {
        nutrav: true,
        nobovi: true,
        danais: true,
        velageVeau: {
          select: { vache: { select: { nutrav: true, nobovi: true } } },
        },
      },
      orderBy: { danais: "asc" },
    }),
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        sevreFait: false,
        velageVeau: { isNot: null },
        danais: { gte: sixMonthsAgo, lte: fiveMonthsAgo },
      },
      select: {
        nutrav: true,
        nobovi: true,
        danais: true,
        velageVeau: {
          select: { vache: { select: { nutrav: true, nobovi: true } } },
        },
      },
      orderBy: { danais: "asc" },
    }),
    prisma.gestation.findMany({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: addDays(now, 30), lte: ninetyDaysLater },
        saillie: {
          animal: { statut: "ACTIF", velagesVache: { none: {} } },
        },
      },
      select: {
        dateVelagePrevue: true,
        saillie: { select: { animal: { select: { nutrav: true, nobovi: true } } } },
      },
      orderBy: { dateVelagePrevue: "asc" },
    }),
    prisma.gestation.findMany({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: addDays(now, -14), lte: addDays(now, 23) },
      },
      select: {
        dateVelagePrevue: true,
        saillie: { select: { animal: { select: { nutrav: true, nobovi: true } } } },
      },
      orderBy: { dateVelagePrevue: "asc" },
    }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: false } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -365) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -730), lt: addDays(now, -365) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -1095), lt: addDays(now, -730) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "M" } }),
  ]);

  let vachesPleine = 0;
  let aEchographier = 0;
  let vachesVidesEnRetard = 0;

  for (const vache of vachesAvecSaillies) {
    const derniereSaillie = vache.saillies[0]?.date ?? null;
    const gestation = vache.saillies[0]?.gestation ?? null;
    const dateVelagePrevue = gestation?.dateVelagePrevue ?? null;
    const etatGestation = gestation?.etat ?? null;
    const dernierVelage = vache.velagesVache[0]?.date ?? null;

    const etat = getEtatGestation(
      derniereSaillie,
      etatGestation,
      dateVelagePrevue,
      dernierVelage
    );

    if (etat === "VERT" || etat === "ROSE") vachesPleine++;
    if (etat === "JAUNE") aEchographier++;
    if (etat === "ROUGE") vachesVidesEnRetard++;
  }

  let veauxAVacciner = 0;
  for (const animal of veauxPourVaccins) {
    const ageJours = differenceInDays(now, animal.danais);
    if (ageJours <= 365 * 2) {
      const vaccinsManquants = getVaccinsManquants(
        animal.danais,
        animal.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date }))
      );
      if (vaccinsManquants.length > 0) veauxAVacciner++;
    }
  }

  // Statistiques mortalité de l'année en cours (dans le Promise.all au dessus idéalement, ici isolé pour lisibilité)
  const debutAnnee = new Date(`${now.getFullYear()}-01-01`);
  const mortsAnnee = await prisma.sortie.findMany({
    where: { type: "MORT", date: { gte: debutAnnee } },
    select: { causeMortalite: true },
  });
  const mortsCount = mortsAnnee.length;
  const causeMapMort = new Map<string, number>();
  for (const m of mortsAnnee) {
    if (m.causeMortalite) {
      causeMapMort.set(m.causeMortalite, (causeMapMort.get(m.causeMortalite) ?? 0) + 1);
    }
  }
  const mortsParCause = [...causeMapMort.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({
      cause,
      count,
      pct: mortsCount > 0 ? Math.round((count / mortsCount) * 100) : 0,
    }));
  const mortsAnneeSansProbleme = mortsAnnee.filter((m) => !m.causeMortalite).length;
  const totalTroupeauActif = nbVaches + nbGenissesBabies + nbGenissesMoyennes + nbGenissesGrandes + nbMales;
  const tauxMortaliteAnnee =
    (totalTroupeauActif + mortsCount) > 0
      ? Math.round((mortsCount / (totalTroupeauActif + mortsCount)) * 100)
      : 0;

  const pctPleine =
    vachesActives > 0 ? Math.round((vachesPleine / vachesActives) * 100) : 0;

  const bouclageItems: ChecklistItem[] = veauxABouclerList.map((a) => {
    const ageJours = differenceInDays(now, a.danais);
    const mere = a.velageVeau?.vache;
    return {
      nutrav: a.nutrav,
      nom: a.nobovi ?? null,
      ageLabel: `${ageJours} j`,
      extra: mere
        ? `Mère: ${mere.nutrav}${mere.nobovi ? " " + mere.nobovi : ""}`
        : undefined,
      isUrgent: ageJours >= 15,
      apiField: "boucleFaite",
    };
  });

  const sevrageItems: ChecklistItem[] = veauxASevrerList.map((a) => {
    const mere = a.velageVeau?.vache;
    return {
      nutrav: a.nutrav,
      nom: a.nobovi ?? null,
      ageLabel: formatAge(a.danais),
      extra: mere
        ? `Mère: ${mere.nutrav}${mere.nobovi ? " " + mere.nobovi : ""}`
        : undefined,
      apiField: "sevreFait",
    };
  });

  const presqueSevrables: SubItem[] = veauxPresqueSevrables.map((a) => {
    const mere = a.velageVeau?.vache;
    return {
      nutrav: a.nutrav,
      nom: a.nobovi ?? null,
      ageLabel: formatAge(a.danais),
      extra: mere
        ? `Mère: ${mere.nutrav}${mere.nobovi ? " " + mere.nobovi : ""}`
        : undefined,
      apiField: "sevreFait",
    };
  });

  return {
    vachesActives,
    capteurs,
    vachesPleine,
    pctPleine,
    aEchographier,
    veauxAVacciner,
    velagesPrevus,
    velagesSemaine,
    vachesVidesEnRetard,
    evenementsSanitairesUrgents,
    vaccinationPreVelage,
    bolusPreVelage,
    bouclageItems,
    sevrageItems,
    presqueSevrables,
    genissesArapatrier,
    vachesACapteur,
    nbVaches,
    nbGenissesBabies,
    nbGenissesMoyennes,
    nbGenissesGrandes,
    nbMales,
    mortsCount,
    mortsParCause,
    mortsAnneeSansProbleme,
    tauxMortaliteAnnee,
  };
}

async function getNotesTerrain() {
  try {
    return await prisma.noteTerrain.findMany({
      where: { traitee: false },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

interface PageProps {
  searchParams: Promise<{ imprimer?: string }>;
}

export default async function Dashboard({ searchParams }: PageProps) {
  const { imprimer } = await searchParams;
  const printMode = Boolean(imprimer);
  const [data, notesTerrain] = await Promise.all([getDashboardData(), getNotesTerrain()]);
  const capteursActifs = data.capteurs.filter((c) => c.actif);
  const capteursActifsNutravs = new Set(capteursActifs.map((c) => c.animalNutrav).filter(Boolean));

  const vachesACapteurSansCapteur = data.vachesACapteur.filter(
    (g) => !capteursActifsNutravs.has(g.saillie.animal.nutrav)
  );

  const hasRepro =
    data.vachesVidesEnRetard > 0 ||
    data.aEchographier > 0 ||
    data.velagesSemaine > 0 ||
    data.genissesArapatrier.length > 0 ||
    vachesACapteurSansCapteur.length > 0;

  const hasSante =
    data.evenementsSanitairesUrgents > 0 ||
    data.vaccinationPreVelage > 0 ||
    data.bolusPreVelage > 0 ||
    data.veauxAVacciner > 0;

  const annee = new Date().getFullYear();

  const sectionReproVelage = hasRepro ? (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Baby size={18} className="text-pink-500" />
          Reproduction &amp; Vélage
        </div>
        {!printMode && <PrintSectionButton printKey="repro-velage" />}
      </h3>
      <div className="mb-3">
        <RapportGestationButton />
      </div>
      <div className="space-y-2">
        {data.vachesVidesEnRetard > 0 && (
          <Link
            href="/reproduction?filtre=ROUGE"
            className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
          >
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-red-600" />
              <span className="text-sm font-medium text-red-800">Vaches vides en retard</span>
            </div>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              {data.vachesVidesEnRetard}
            </span>
          </Link>
        )}
        {data.aEchographier > 0 && (
          <Link
            href="/reproduction"
            className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
          >
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Vaches à échographier</span>
            </div>
            <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
              {data.aEchographier}
            </span>
          </Link>
        )}
        {data.velagesSemaine > 0 && (
          <Link
            href="/velage"
            className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-200"
          >
            <div className="flex items-center gap-2">
              <Baby size={16} className="text-pink-600" />
              <span className="text-sm font-medium text-pink-800">Vélages prévus cette semaine</span>
            </div>
            <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {data.velagesSemaine}
            </span>
          </Link>
        )}
        {vachesACapteurSansCapteur.length > 0 && (
          <Link
            href="/velage"
            className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
          >
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-orange-600" />
              <div>
                <div className="text-sm font-medium text-orange-800">Poser capteur vélage</div>
                <div className="text-xs text-orange-600 mt-0.5">
                  {vachesACapteurSansCapteur.map((g) =>
                    g.saillie.animal.nobovi ?? g.saillie.animal.nutrav
                  ).join(", ")}
                </div>
              </div>
            </div>
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {vachesACapteurSansCapteur.length}
            </span>
          </Link>
        )}
        {data.genissesArapatrier.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Génisses à rapatrier à la ferme</span>
              </div>
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {data.genissesArapatrier.length}
              </span>
            </div>
            <div className="space-y-1">
              {data.genissesArapatrier.map((g, i) => {
                const jours = g.dateVelagePrevue
                  ? differenceInDays(g.dateVelagePrevue, new Date())
                  : null;
                return (
                  <div key={i} className="flex items-center justify-between text-xs text-amber-700">
                    <Link href={`/troupeau/${g.saillie.animal.nutrav}`} className="font-mono bg-white border border-amber-200 px-1.5 py-0.5 rounded">
                      {g.saillie.animal.nutrav}
                    </Link>
                    <span>{g.saillie.animal.nobovi ?? <em className="opacity-50 not-italic">sans nom</em>}</span>
                    {jours !== null && (
                      <span className="font-semibold">J-{jours}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-amber-600 mt-2 italic">⚠️ Primipare — surveillance renforcée requise</p>
          </div>
        )}
      </div>
    </div>
  ) : null;

  const sectionSanteVaccins = hasSante ? (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-red-500" />
          Santé &amp; Vaccins
        </div>
        {!printMode && <PrintSectionButton printKey="sante-vaccins" />}
      </h3>
      <div className="space-y-2">
        {data.evenementsSanitairesUrgents > 0 && (
          <Link
            href="/sanitaire"
            className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
          >
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-red-600" />
              <span className="text-sm font-medium text-red-800">Interventions sanitaires urgentes</span>
            </div>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              {data.evenementsSanitairesUrgents}
            </span>
          </Link>
        )}
        {data.vaccinationPreVelage > 0 && (
          <Link
            href="/sanitaire"
            className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
          >
            <div className="flex items-center gap-2">
              <Syringe size={16} className="text-orange-600" />
              <span className="text-sm font-medium text-orange-800">
                Vaccins pré-vélage (Crypto / Rotavec)
              </span>
            </div>
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {data.vaccinationPreVelage}
            </span>
          </Link>
        )}
        {data.bolusPreVelage > 0 && (
          <Link
            href="/sanitaire"
            className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
          >
            <div className="flex items-center gap-2">
              <Syringe size={16} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Bolus / Métrabol pré-vélage (J-45 à J-21)
              </span>
            </div>
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {data.bolusPreVelage}
            </span>
          </Link>
        )}
        {data.veauxAVacciner > 0 && (
          <Link
            href="/sanitaire"
            className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
          >
            <div className="flex items-center gap-2">
              <Syringe size={16} className="text-red-600" />
              <span className="text-sm font-medium text-red-800">Veaux à vacciner</span>
            </div>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {data.veauxAVacciner}
            </span>
          </Link>
        )}
      </div>
    </div>
  ) : null;

  const sectionVeauxBoucler = (
    <ChecklistSection
      title="Veaux à boucler"
      icon={<Tag size={18} />}
      items={data.bouclageItems}
      actionLabel="Bouclé"
      color="orange"
      printKey={printMode ? undefined : "veaux-boucler"}
      printMode={printMode}
    />
  );

  const sectionVeauxSevrer = (
    <ChecklistSection
      title="Veaux à sevrer"
      icon={<Scissors size={18} />}
      items={data.sevrageItems}
      actionLabel="Sevré"
      color="green"
      subSection={
        data.presqueSevrables.length > 0
          ? { title: "Presque sevrables (5–6 mois)", items: data.presqueSevrables, actionLabel: "Sevrer quand même" }
          : undefined
      }
      printKey={printMode ? undefined : "veaux-sevrer"}
      printMode={printMode}
    />
  );

  const sectionStatsRapides = (
    <Collapsible title="Stats rapides" defaultOpen={true} printKey={printMode ? undefined : "stats-rapides"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-700">{data.pctPleine}%</div>
          <div className="text-xs text-gray-600 mt-1">Vaches pleines</div>
          <div className="text-xs text-gray-400">
            {data.vachesPleine} / {data.vachesActives}
          </div>
        </div>
        <div className="text-center p-3 bg-pink-50 rounded-lg">
          <div className="text-2xl font-bold text-pink-600">{data.velagesPrevus}</div>
          <div className="text-xs text-gray-600 mt-1">Vélages prévus</div>
          <div className="text-xs text-gray-400">30 prochains jours</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{data.aEchographier}</div>
          <div className="text-xs text-gray-600 mt-1">À échographier</div>
          <div className="text-xs text-gray-400">Saillies 35-45j</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{data.veauxAVacciner}</div>
          <div className="text-xs text-gray-600 mt-1">Vaccins en retard</div>
          <div className="text-xs text-gray-400">Protocoles</div>
        </div>
      </div>
    </Collapsible>
  );

  const sectionMortalite = (
    <Collapsible
      title={<span className="flex items-center gap-2">💀 Mortalité {annee}</span>}
      badge={data.mortsCount > 0 ? `${data.mortsCount} décès` : "0 décès"}
      badgeColor={data.mortsCount > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}
      defaultOpen={printMode}
      printKey={printMode ? undefined : "mortalite"}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{data.mortsCount}</div>
            <div className="text-xs text-gray-600 mt-1">Décès cette année</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{data.tauxMortaliteAnnee}%</div>
            <div className="text-xs text-gray-600 mt-1">Taux mortalité</div>
          </div>
        </div>
        {data.mortsParCause.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Répartition par cause</p>
            {data.mortsParCause.map((s) => (
              <div key={s.cause} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{s.cause}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-red-400 h-2 rounded-full" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-10 text-right shrink-0">{s.pct}%</span>
                <span className="text-xs text-gray-400 shrink-0">×{s.count}</span>
              </div>
            ))}
          </div>
        )}
        {data.mortsAnneeSansProbleme > 0 && (
          <p className="text-xs text-gray-400 italic">
            + {data.mortsAnneeSansProbleme} mort{data.mortsAnneeSansProbleme > 1 ? "s" : ""} sans cause renseignée
          </p>
        )}
        {data.mortsCount === 0 && (
          <p className="text-sm text-gray-400 text-center py-2">Aucun décès enregistré cette année</p>
        )}
      </div>
    </Collapsible>
  );

  const sectionComposition = (
    <Collapsible
      title={
        <span className="flex items-center gap-2">
          <CowIcon size={14} className="text-green-700" />
          Composition du troupeau
        </span>
      }
      count={data.nbVaches + data.nbGenissesBabies + data.nbGenissesMoyennes + data.nbGenissesGrandes + data.nbMales}
      defaultOpen={true}
      printKey={printMode ? undefined : "composition-troupeau"}
    >
      <div className="space-y-1.5">
        {([
          { label: "Vaches", count: data.nbVaches, color: "bg-green-100 text-green-700", href: "/troupeau?categorie=VACHE" },
          { label: "Génisses < 1 an", count: data.nbGenissesBabies, color: "bg-sky-100 text-sky-700", href: "/troupeau?categorie=VELLE" },
          { label: "Génisses 1–2 ans", count: data.nbGenissesMoyennes, color: "bg-indigo-100 text-indigo-700", href: "/troupeau?categorie=MOYENNE_GENISSE" },
          { label: "Génisses 2–3 ans", count: data.nbGenissesGrandes, color: "bg-purple-100 text-purple-700", href: "/troupeau?categorie=GRANDE_GENISSE" },
          { label: "Mâles", count: data.nbMales, color: "bg-gray-100 text-gray-600", href: "/troupeau?sexe=M" },
        ] as const).map(({ label, count, color, href }) => (
          <Link key={label} href={href} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-sm text-gray-700">{label}</span>
            <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${color}`}>{count}</span>
          </Link>
        ))}
      </div>
    </Collapsible>
  );

  const sectionCapteurs = (
    <Collapsible
      title={
        <span className="flex items-center gap-2">
          <Wifi size={14} className="text-green-700" />
          Capteurs vélage
        </span>
      }
      badge={capteursActifs.length === 0 ? "Aucun actif" : `${capteursActifs.length} actif${capteursActifs.length > 1 ? "s" : ""}`}
      badgeColor={capteursActifs.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}
      defaultOpen={printMode}
      printKey={printMode ? undefined : "capteurs-velage"}
    >
      <div className="grid grid-cols-2 gap-2">
        {data.capteurs.map((capteur) => (
          <div
            key={capteur.id}
            className={`p-3 rounded-lg border ${
              capteur.actif ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Capteur {capteur.numero}</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  capteur.actif ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                }`}
              >
                {capteur.actif ? "ACTIF" : "LIBRE"}
              </span>
            </div>
            {capteur.actif && capteur.animalNom && (
              <div className="text-xs text-gray-600 mt-1">
                {capteur.animalNom} - {capteur.animalNutrav}
              </div>
            )}
            {capteur.actif && capteur.dateAttribution && (
              <div className="text-xs text-gray-400">
                Depuis le {new Date(capteur.dateAttribution).toLocaleDateString("fr-FR")}
              </div>
            )}
          </div>
        ))}
      </div>
    </Collapsible>
  );

  if (printMode) {
    const sections: Record<string, React.ReactNode> = {
      "repro-velage": sectionReproVelage,
      "sante-vaccins": sectionSanteVaccins,
      "veaux-boucler": sectionVeauxBoucler,
      "veaux-sevrer": sectionVeauxSevrer,
      "stats-rapides": sectionStatsRapides,
      mortalite: sectionMortalite,
      "composition-troupeau": sectionComposition,
      "capteurs-velage": sectionCapteurs,
    };
    const section = sections[imprimer as string];

    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Link href="/" className="print:hidden inline-flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft size={16} /> Retour au tableau de bord
        </Link>
        {section ?? (
          <p className="text-sm text-gray-400">Rien à imprimer pour cette section.</p>
        )}
        <AutoPrint />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
      <QuickSearch />
      <h2 className="text-xl font-bold text-gray-800 mt-2">Tableau de bord</h2>

      {/* NOTES TERRAIN DICTÉES */}
      <NotesTerrain initialNotes={notesTerrain.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />

      {sectionReproVelage}
      {sectionSanteVaccins}
      {sectionVeauxBoucler}
      {sectionVeauxSevrer}

      {/* Accès rapide Pharmacie */}
      <Link href="/pharmacie"
        className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors">
        <div className="flex items-center gap-2">
          <Pill size={18} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">Pharmacie — traitements &amp; médicaments</span>
        </div>
        <span className="text-xs text-blue-600">→</span>
      </Link>

      {sectionStatsRapides}
      {sectionMortalite}
      {sectionComposition}
      {sectionCapteurs}
    </div>
  );
}
