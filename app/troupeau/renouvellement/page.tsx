import BackButton from "@/app/components/BackButton";
import {
  parseRenewalSettings,
  probableEntryYear,
  RENEWAL_CANDIDATE_CATEGORIES,
  resolveCandidateParents,
  type ParentIdentity,
} from "@/lib/herd-renewal";
import { prisma } from "@/lib/prisma";
import { getCategorie, getCategorieLabel } from "@/lib/utils";
import { Sprout } from "lucide-react";
import RenewalDashboard, { type RenewalCandidate } from "./RenewalDashboard";

export const dynamic = "force-dynamic";

function identity(value: { id?: string | null; nutrav?: string | null; nobovi?: string | null; nupere?: string | null; nopere?: string | null } | null | undefined): ParentIdentity | null {
  if (!value) return null;
  return {
    id: value.id,
    workNumber: value.nutrav,
    name: value.nobovi ?? value.nopere,
    nationalNumber: value.nupere,
  };
}

export default async function RenewalPage() {
  const [females, config] = await Promise.all([
    prisma.animal.findMany({
      where: { statut: "ACTIF", sexbov: "F" },
      orderBy: { danais: "asc" },
      select: {
        id: true, nutrav: true, nobovi: true, danais: true, sexbov: true, estGenisse: true, categorie: true,
        mere: { select: { id: true, nutrav: true, nobovi: true } },
        velageVeau: {
          select: {
            pereNom: true,
            pereNunati: true,
            vache: { select: { id: true, nutrav: true, nobovi: true } },
            gestation: { select: { saillie: { select: { taureau: { select: { id: true, nopere: true, nupere: true } } } } } },
          },
        },
        pesees: { orderBy: { date: "desc" }, take: 1, select: { poids: true, date: true } },
      },
    }),
    prisma.exploitationConfig.findUnique({ where: { id: "singleton" }, select: { reproductionRulesJson: true } }).catch(() => null),
  ]);

  const enriched = females.map((animal) => ({ animal, category: getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie) }));
  const motherAnimals = enriched.filter(({ category }) => category === "VACHE");
  const settings = parseRenewalSettings(config?.reproductionRulesJson, motherAnimals.length);
  const candidateCategories = new Set<string>(RENEWAL_CANDIDATE_CATEGORIES);
  const candidates: RenewalCandidate[] = enriched
    .filter(({ category }) => candidateCategories.has(category))
    .map(({ animal, category }) => {
      const calvingFather = animal.velageVeau?.pereNom || animal.velageVeau?.pereNunati ? {
        name: animal.velageVeau.pereNom,
        nationalNumber: animal.velageVeau.pereNunati,
      } : null;
      const parents = resolveCandidateParents({
        directMother: identity(animal.mere),
        calvingMother: identity(animal.velageVeau?.vache),
        breedingBull: identity(animal.velageVeau?.gestation?.saillie?.taureau),
        calvingFather,
      });
      return {
        id: animal.id,
        nutrav: animal.nutrav,
        name: animal.nobovi,
        birthDate: animal.danais.toISOString(),
        category,
        categoryLabel: getCategorieLabel(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie),
        entryYear: probableEntryYear(animal.danais, settings.firstCalvingAgeMonths),
        mother: parents.mother,
        father: parents.father,
        lastWeight: animal.pesees[0]?.poids ?? null,
        lastWeightDate: animal.pesees[0]?.date.toISOString() ?? null,
      };
    });

  return <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 p-3 pb-24 sm:p-5">
    <header className="mb-4 flex items-center gap-3">
      <BackButton className="rounded-lg bg-white p-2 text-gray-500 shadow-sm" iconSize={18} />
      <div className="min-w-0 flex-1"><h1 className="flex items-center gap-2 text-xl font-black text-gray-900"><Sprout size={21} className="text-green-700" /> Renouvellement</h1><p className="text-xs text-gray-500">Piloter les entrées, les sorties et équilibrer les lignées</p></div>
    </header>
    <RenewalDashboard
      currentMothers={motherAnimals.length}
      candidates={candidates}
      mothers={motherAnimals.map(({ animal }) => ({ id: animal.id, nutrav: animal.nutrav, name: animal.nobovi }))}
      initialSettings={settings}
    />
  </main>;
}
