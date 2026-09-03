import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { subDays } from "date-fns";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import { Suspense } from "react";
import NouvelAnimalForm from "./NouvelAnimalForm";
import TroupeauScrollRestorer from "./TroupeauScrollRestorer";
import TroupeauTableau, { type AnimalRow } from "./TroupeauTableau";
import TroupeauMobileList from "./TroupeauMobileList";
import MoreMenu from "./MoreMenu";
import TroupeauTabs from "@/components/TroupeauTabs";
import { syncAutomaticEchoRequests } from "@/lib/echo-requests";
import TroupeauFilters from "./TroupeauFilters";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";
import { getCurrentReproductionSummary } from "@/lib/current-reproduction-summary";
import {
  buildTroupeauWhere,
  belongsToEchoActionList,
  filtrerAnimauxParCriteresLocaux,
  normalizeTroupeauFilters,
  type TroupeauFilterParams,
} from "@/lib/troupeau-filters";

interface PageProps {
  searchParams: Promise<{
    sexe?: string;
    q?: string;
    categorie?: string;
    tarie?: string;
    repro?: string;
    sanitaire?: string;
    sevrage?: string;
    groupe?: string;
    tri?: string;
    nouveau?: string;
    filtres?: string;
    vue?: string;
  }>;
}

async function getAnimaux(params: TroupeauFilterParams) {
  await syncAutomaticEchoRequests();
  const now = new Date();
  const filters = normalizeTroupeauFilters(params);
  const where = buildTroupeauWhere(filters);

  const orderBy =
    filters.tri === "age_asc" ? { danais: "desc" as const }
    : filters.tri === "age_desc" ? { danais: "asc" as const }
    : { nutrav: "asc" as const };

  const [animauxNonFiltres, groupes, reproductionConfig] = await Promise.all([
    prisma.animal.findMany({
      where,
      orderBy,
      select: {
        id: true,
        nutrav: true,
        nobovi: true,
        nunati: true,
        danais: true,
        sexbov: true,
        statut: true,
        estGenisse: true,
        race: true,
        categorie: true,
        groupeId: true,
        sevreFait: true,
        mere: { select: { nutrav: true } },
        velageVeau: {
          select: {
            pereNom: true,
            pereNunati: true,
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
        tarieFaite: true,
        aEchographier: true,
        demandesEchographie: {
          where: { etat: "A_FAIRE" },
          orderBy: { createdAt: "desc" as const },
          take: 1,
          select: { origine: true, motif: true, etat: true },
        },
        reproductionEtatManuel: true,
        reproductionEtatPrecedent: true,
        groupe: { select: { id: true, nom: true, couleur: true } },
        saillies: {
          orderBy: [{ date: "desc" as const }, { createdAt: "desc" as const }],
          select: {
            id: true,
            date: true,
            type: true,
            gestation: {
              select: {
                etat: true,
                dateVelagePrevue: true,
                dateEcho: true,
                resultatEcho: true,
              },
            },
          },
        },
        velagesVache: {
          orderBy: { date: "desc" as const },
          take: 1,
          select: {
            date: true,
            veau: { select: { nutrav: true, statut: true, sevreFait: true } },
            veauxDetails: {
              select: {
                statut: true,
                nutrav: true,
                animal: { select: { nutrav: true, statut: true, sevreFait: true } },
              },
            },
          },
        },
        pesees: {
          orderBy: { date: "desc" as const },
          take: 1,
          select: { poids: true, date: true },
        },
        traitements: {
          where: { dateDebut: { gte: subDays(now, 90) } },
          select: {
            dateDebut: true,
            dureeJours: true,
            delaiAttenteViandeJ: true,
            delaiAttenteLaitJ: true,
            medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } },
          },
        },
      },
    }),
    prisma.groupe.findMany({ orderBy: { nom: "asc" } }),
    prisma.exploitationConfig.findUnique({
      where: { id: "singleton" },
      select: { reproReposObjectifJours: true },
    }).catch(() => null),
  ]);

  const animaux = filtrerAnimauxParCriteresLocaux(animauxNonFiltres, filters, now);
  if (filters.tri === "velage_asc" || filters.tri === "velage_desc") {
    const direction = filters.tri === "velage_asc" ? 1 : -1;
    animaux.sort((left, right) => {
      const leftDate = left.velagesVache[0]?.date?.getTime() ?? null;
      const rightDate = right.velagesVache[0]?.date?.getTime() ?? null;
      if (leftDate === null) return rightDate === null ? 0 : 1;
      if (rightDate === null) return -1;
      return (leftDate - rightDate) * direction;
    });
  }

  return {
    animaux,
    total: animaux.length,
    groupes,
    postCalvingRestDays: reproductionConfig?.reproReposObjectifJours ?? 60,
  };
}

export default async function TroupeauPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sexe = params.sexe;
  const q = params.q;
  const categorie = params.categorie;
  const tarie = params.tarie;
  const repro = params.repro;
  const sanitaire = params.sanitaire;
  const sevrage = params.sevrage;
  const groupe = params.groupe;
  const tri = params.tri;
  const showForm = params.nouveau === "1";

  const { animaux, total, groupes, postCalvingRestDays } = await getAnimaux({
    sexe, q, categorie, tarie, repro, sanitaire, sevrage, groupe, tri,
  });

  // Velles à vendre rapidement : categorie = "VELLE", statut ACTIF, âge entre 351 et 365 jours
  const today = new Date();
  const dateMin = new Date(today); dateMin.setDate(dateMin.getDate() - 365);
  const dateMax = new Date(today); dateMax.setDate(dateMax.getDate() - 351);
  const vellesUrgentes = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      categorie: "VELLE",
      danais: { gte: dateMin, lte: dateMax },
    },
    select: { nutrav: true, nobovi: true, danais: true },
    orderBy: { danais: "asc" },
  });

  const tableauAnimaux = animaux.map<AnimalRow>((animal) => {
    const dernierVelage = animal.velagesVache[0];
    const reproductionSummary = getCurrentReproductionSummary(
      animal.saillies,
      dernierVelage?.date ?? null,
      today,
    );
    const currentBreeding = getCurrentCycleBreeding(
      animal.saillies,
      dernierVelage?.date ?? null,
    );
    const activeCalves = new Map<string, { nutrav: string; href: string | null }>();

    if (!animal.tarieFaite && dernierVelage?.veau?.statut === "ACTIF" && !dernierVelage.veau.sevreFait) {
      activeCalves.set(dernierVelage.veau.nutrav, {
        nutrav: dernierVelage.veau.nutrav,
        href: `/troupeau/${dernierVelage.veau.nutrav}`,
      });
    }
    if (!animal.tarieFaite) {
      for (const detail of dernierVelage?.veauxDetails ?? []) {
        const nutrav = detail.animal?.nutrav ?? detail.nutrav;
        const actif = detail.statut !== "MORT_NE"
          && (!detail.animal || (detail.animal.statut === "ACTIF" && !detail.animal.sevreFait));
        if (nutrav && actif) {
          activeCalves.set(nutrav, {
            nutrav,
            href: detail.animal ? `/troupeau/${detail.animal.nutrav}` : null,
          });
        }
      }
    }

    const bull = animal.velageVeau?.gestation?.saillie?.taureau;
    return {
      id: animal.id,
      nutrav: animal.nutrav,
      nobovi: animal.nobovi,
      danais: animal.danais.toISOString(),
      sexbov: animal.sexbov,
      estGenisse: animal.estGenisse,
      aEchographier: belongsToEchoActionList({
        aEchographier: animal.aEchographier,
        reproductionEtatManuel: animal.reproductionEtatManuel,
        demandesEchographie: animal.demandesEchographie,
      }),
      reproductionEtatManuel: animal.reproductionEtatManuel as AnimalRow["reproductionEtatManuel"],
      reproductionEtatPrecedent: animal.reproductionEtatPrecedent as AnimalRow["reproductionEtatPrecedent"],
      categorie: animal.categorie,
      groupeNom: animal.groupe?.nom ?? null,
      saillieDate: currentBreeding?.date.toISOString() ?? null,
      gestationEtat: currentBreeding?.gestation?.etat ?? null,
      gestationVelagePrevue: currentBreeding?.gestation?.dateVelagePrevue?.toISOString() ?? null,
      velageDate: dernierVelage?.date.toISOString() ?? null,
      reproductionSummary: {
        lastCalvingDate: reproductionSummary.lastCalving?.toISOString() ?? null,
        daysSinceLastCalving: reproductionSummary.daysSinceLastCalving,
        lastEchoDate: reproductionSummary.lastEcho?.date.toISOString() ?? null,
        lastEchoResult: reproductionSummary.lastEcho?.result ?? null,
        lastAttemptDate: reproductionSummary.lastAttempt?.date.toISOString() ?? null,
        lastAttemptType: reproductionSummary.lastAttempt?.type ?? null,
        daysSinceLastAttempt: reproductionSummary.lastAttempt?.daysSince ?? null,
      },
      mereNutrav: animal.mere?.nutrav ?? null,
      pereNom: bull?.nopere ?? animal.velageVeau?.pereNom ?? null,
      pereNumero: bull?.nupere ?? animal.velageVeau?.pereNunati ?? null,
      sevreFait: animal.sevreFait,
      activeCalves: [...activeCalves.values()],
      dernierPoids: animal.pesees[0]?.poids ?? null,
      dernierePeseeDate: animal.pesees[0]?.date.toISOString() ?? null,
      enAttente: animal.traitements.some((t) => getAttenteInfoForTraitement(t).enAttente),
    };
  });

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto pb-24">
      <TroupeauScrollRestorer />
      <TroupeauTabs />
      <div className="flex items-center gap-3 mt-2">
<div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold text-gray-800">Animaux</h2>
          <p className="truncate text-xs text-gray-500">Consulter et rechercher tout le troupeau</p>
        </div>
        <MoreMenu
          printHref={`/troupeau/impression?${new URLSearchParams(
            Object.fromEntries(
              Object.entries({ sexe, q, categorie, tarie, repro, sanitaire, sevrage, groupe, tri })
                .filter(([, v]) => v !== undefined && v !== null) as [string, string][]
            )
          ).toString()}`}
        />
        {!showForm && (
          <Link
            href="/troupeau?nouveau=1"
            className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg shadow"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Ajouter</span>
          </Link>
        )}
      </div>

      {showForm && <NouvelAnimalForm />}

      {/* 🚨 Alerte velles bientôt 1 an — très visible */}
      {vellesUrgentes.length > 0 && (
        <div className="bg-red-600 text-white rounded-xl p-4 shadow-lg space-y-3 animate-pulse-once border-2 border-red-400">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-bold text-base leading-tight">
                {vellesUrgentes.length} velle{vellesUrgentes.length > 1 ? "s" : ""} à vendre RAPIDEMENT
              </p>
              <p className="text-red-200 text-xs mt-0.5">Bientôt 1 an — le marchand peut refuser au-delà</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {vellesUrgentes.map((v) => {
              const agejours = Math.floor((today.getTime() - v.danais.getTime()) / (1000 * 60 * 60 * 24));
              const joursRestants = 365 - agejours;
              return (
                <Link
                  key={v.nutrav}
                  href={`/troupeau/${v.nutrav}`}
                  className="flex items-center justify-between bg-red-700 hover:bg-red-800 rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold bg-white text-red-700 px-1.5 py-0.5 rounded text-xs">{v.nutrav}</span>
                    <span className="text-sm font-medium">{v.nobovi ?? "Sans nom"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-red-200">{agejours} j</span>
                    <span className="ml-2 text-xs font-bold bg-red-500 px-2 py-0.5 rounded-full">
                      {joursRestants > 0 ? `J-${joursRestants}` : "URGENT"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <TroupeauFilters
        total={total}
        groups={groupes.map((item) => ({ id: item.id, nom: item.nom }))}
        params={{ sexe, q, categorie, tarie, repro, sanitaire, sevrage, groupe, tri }}
      />

      {/* Tableau sur ordinateur */}
      <div className="hidden md:block">
        <Suspense fallback={<div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">Chargement…</div>}>
          <TroupeauTableau
            postCalvingRestDays={postCalvingRestDays}
            animaux={tableauAnimaux}
          />
        </Suspense>
      </div>

      {/* Cartes sur téléphone */}
      <div className="md:hidden">
        <TroupeauMobileList animaux={tableauAnimaux} postCalvingRestDays={postCalvingRestDays} />
      </div>

    </div>
  );
}
