import BackButton from "@/app/components/BackButton";
import {
  calculateAverageFirstCalvingAge,
  estimateMotherEntryDate,
  isAutomaticPlannedExit,
  isCurrentMother,
  parseRenewalSettings,
  RENEWAL_PIPELINE_CATEGORIES,
  resolveCandidateParents,
  type ParentIdentity,
  type RenewalStage,
} from "@/lib/herd-renewal";
import { prisma } from "@/lib/prisma";
import { getCategorie, getCategorieLabel } from "@/lib/utils";
import { Sprout } from "lucide-react";
import RenewalDashboard, { type RenewalCandidate } from "./RenewalDashboard";

export const dynamic = "force-dynamic";

function identity(value: { id?: string | null; nutrav?: string | null; nobovi?: string | null; nupere?: string | null; nopere?: string | null } | null | undefined): ParentIdentity | null {
  if (!value) return null;
  return { id: value.id, workNumber: value.nutrav, name: value.nobovi ?? value.nopere, nationalNumber: value.nupere };
}

export default async function RenewalPage() {
  const [females, config] = await Promise.all([
    prisma.animal.findMany({
      where: { sexbov: "F" },
      orderBy: { danais: "asc" },
      select: {
        id: true, nutrav: true, nobovi: true, danais: true, sexbov: true, statut: true, estGenisse: true, categorie: true,
        mere: { select: { id: true, nutrav: true, nobovi: true } },
        velageVeau: {
          select: {
            pereNom: true, pereNunati: true,
            vache: { select: { id: true, nutrav: true, nobovi: true } },
            gestation: { select: { saillie: { select: { taureau: { select: { id: true, nopere: true, nupere: true } } } } } },
          },
        },
        velagesVache: { orderBy: { date: "asc" }, select: { date: true } },
        saillies: {
          orderBy: { date: "desc" }, take: 1,
          select: { gestation: { select: { etat: true, dateVelagePrevue: true } } },
        },
        pesees: { orderBy: { date: "desc" }, take: 1, select: { poids: true, date: true } },
      },
    }),
    prisma.exploitationConfig.findUnique({ where: { id: "singleton" }, select: { reproductionRulesJson: true } }).catch(() => null),
  ]);

  const firstCalvingAverage = calculateAverageFirstCalvingAge(females.map((animal) => ({ birthDate: animal.danais, calvings: animal.velagesVache.map((calving) => calving.date) })));
  const activeFemales = females.filter((animal) => animal.statut === "ACTIF");
  // Le vêlage réel prime sur une ancienne catégorie incohérente.
  const mothers = activeFemales.filter((animal) => isCurrentMother(animal.velagesVache.length));
  const settings = parseRenewalSettings(config?.reproductionRulesJson, mothers.length);
  const pipelineCategories = new Set<string>(RENEWAL_PIPELINE_CATEGORIES);

  const pipeline: RenewalCandidate[] = activeFemales
    .filter((animal) => animal.velagesVache.length === 0)
    .map((animal) => ({ animal, category: getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie) }))
    .filter(({ category }) => pipelineCategories.has(category))
    .map(({ animal, category }) => {
      const expected = animal.saillies[0]?.gestation;
      const reliableExpectedDate = expected?.dateVelagePrevue && ["VERT", "ROSE"].includes(expected.etat) ? expected.dateVelagePrevue : null;
      const entryDate = estimateMotherEntryDate({ birthDate: animal.danais, expectedCalvingDate: reliableExpectedDate, firstCalvingAverageMonths: firstCalvingAverage.averageMonths });
      const calvingFather = animal.velageVeau?.pereNom || animal.velageVeau?.pereNunati ? { name: animal.velageVeau.pereNom, nationalNumber: animal.velageVeau.pereNunati } : null;
      const parents = resolveCandidateParents({ directMother: identity(animal.mere), calvingMother: identity(animal.velageVeau?.vache), breedingBull: identity(animal.velageVeau?.gestation?.saillie?.taureau), calvingFather });
      return {
        id: animal.id, nutrav: animal.nutrav, name: animal.nobovi,
        birthDate: animal.danais.toISOString(), category: category as RenewalStage, categoryLabel: getCategorieLabel(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie),
        entryDate: entryDate.toISOString(), entrySource: reliableExpectedDate ? "EXPECTED_CALVING" as const : "HISTORICAL_AVERAGE" as const,
        mother: parents.mother, father: parents.father,
        lastWeight: animal.pesees[0]?.poids ?? null, lastWeightDate: animal.pesees[0]?.date.toISOString() ?? null,
      };
    });

  const preselectionCount = activeFemales.filter((animal) => animal.velagesVache.length === 0 && getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie) === "PRESELECTION_GENISSE").length;
  const automaticExitIds = mothers.filter((animal) => isAutomaticPlannedExit(animal.velagesVache.length, animal.categorie)).map((animal) => animal.id);

  return <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 p-3 pb-24 sm:p-5">
    <header className="mb-4 flex items-center gap-3">
      <BackButton className="rounded-lg bg-white p-2 text-gray-500 shadow-sm" iconSize={18} />
      <div className="min-w-0 flex-1"><h1 className="flex items-center gap-2 text-xl font-black text-gray-900"><Sprout size={21} className="text-green-700" /> Renouvellement</h1><p className="text-xs text-gray-500">Sélection aujourd’hui, entrées comme mères dans les années à venir</p></div>
    </header>
    <RenewalDashboard
      currentMothers={mothers.length}
      pipelineCandidates={pipeline}
      preselectionCount={preselectionCount}
      mothers={mothers.map((animal) => ({ id: animal.id, nutrav: animal.nutrav, name: animal.nobovi, automaticExit: automaticExitIds.includes(animal.id) }))}
      firstCalvingAverage={firstCalvingAverage}
      initialSettings={settings}
    />
  </main>;
}
