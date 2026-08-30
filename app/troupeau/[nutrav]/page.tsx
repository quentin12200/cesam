import { prisma } from "@/lib/prisma";
import {
  formatAge,
  formatDate,
  formatDateShort,
  getEtatGestation,
  getBadgeClass,
  getEtatLabel,
  isMheVendable,
  getVaccinProtocolSteps,
  getCategorieLabel,
  getCategorieColor,
  getCategorie,
  DEFAULT_PROTOCOLES,
  VELAGE_IMMINENT_COLORS,
  type ProtocoleVaccinConfig,
} from "@/lib/utils";
import Link from "next/link";
import BackButton from "./BackButton";
import { notFound } from "next/navigation";
import {
  Scale,
  Baby,
  AlertCircle,
  Euro,
  LogOut,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  Circle,
  Clock,
  Printer,
  GitBranch,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import EditAnimalDrawer from "./EditAnimalDrawer";
import PeseeInlineForm from "./PeseeInlineForm";
import SevrageButton from "./SevrageButton";
import QuickActionsBar from "./QuickActionsBar";
import CategorieButton from "./CategorieButton";
import EchoStatusBadge from "./EchoStatusBadge";
import ReproductiveCycleTimeline, {
  type ReproductiveCycleTimelineProps,
} from "./ReproductiveCycleTimeline";
import ReproductiveCyclePreview, {
  type ReproductionPreviewRules,
} from "./ReproductiveCyclePreview";
import GroupeButton from "./GroupeButton";
import EvenementsSection from "./EvenementsSection";
import DeleteHistoriqueButton from "./DeleteHistoriqueButton";
import ReproductionStatusEditor from "@/components/ReproductionStatusEditor";
import type { EtatGestation } from "@/lib/utils";
import { syncAutomaticEchoRequests } from "@/lib/echo-requests";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";
import {
  parseReproductionRules,
  type ReproductionUnit,
} from "@/lib/reproduction-rules";
import { getActiveHeat } from "@/lib/active-heat-action";
import ActiveHeatAction from "@/app/components/ActiveHeatAction";
import HeatReturnReminder from "@/app/components/HeatReturnReminder";
import { getHeatReturnReminder } from "@/lib/heat-return-monitoring";
import ChaleursHistory from "./ChaleursHistory";
import VelageActions from "./VelageActions";
import { resolveBiologicalMother, resolveParentWorkNumber } from "@/lib/animal-genealogy";
import { findAnimalsByExactNational, normalizeGenealogyNational } from "@/lib/animal-genealogy-data";

interface PageProps {
  params: Promise<{ nutrav: string }>;
  searchParams: Promise<{ onglet?: string; pesee?: string; poids?: string; testRepro?: string }>;
}

async function getGroupes() {
  return prisma.groupe.findMany({ orderBy: { nom: "asc" } });
}

async function getProtocoles(): Promise<ProtocoleVaccinConfig[]> {
  try {
    const rows = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
    if (rows.length > 0) return rows;
  } catch {
    // table may not exist yet
  }
  return DEFAULT_PROTOCOLES;
}

async function getExploitationDisplayConfig(): Promise<{
  affichageDelaiAttente: string;
  reproReposObjectifJours: number;
  tarissementVeauAgeMois: number;
  reproductionPreviewRules: ReproductionPreviewRules;
  heatReturnMonitoring: ReturnType<typeof parseReproductionRules>["heatReturnMonitoring"];
}> {
  const toDays = (value: number, unit: ReproductionUnit) =>
    unit === "WEEKS" ? value * 7 : unit === "MONTHS" ? value * 30 : value;
  const previewRules = (rawRules: string | null | undefined): ReproductionPreviewRules => {
    const rules = parseReproductionRules(rawRules);
    const phaseStart = (id: string, fallback: number) => {
      const phase = rules.phases.find((item) => item.id === id);
      return phase ? toDays(phase.startRule.offset, phase.startRule.unit) : fallback;
    };
    return {
      breedingStartDays: phaseStart("breeding_period", 61),
      reproductionDelayDays: phaseStart("reproduction_delay", 81),
      echoPreparationEnabled: rules.echoTiming.usePreparationPhase,
      echoPreparationDays: rules.echoTiming.listFromDays,
      echoDueDays: rules.echoTiming.dueFromDays,
      imminentCalvingDays: phaseStart("imminent_calving", 21),
    };
  };

  try {
    const config = await prisma.exploitationConfig.findUnique({ where: { id: "singleton" } });
    return {
      affichageDelaiAttente: config?.affichageDelaiAttente ?? "LES_DEUX",
      reproReposObjectifJours: config?.reproReposObjectifJours ?? 60,
      tarissementVeauAgeMois: config?.tarissementVeauAgeMois ?? 6,
      reproductionPreviewRules: previewRules(config?.reproductionRulesJson),
      heatReturnMonitoring: parseReproductionRules(config?.reproductionRulesJson).heatReturnMonitoring,
    };
  } catch {
    return {
      affichageDelaiAttente: "LES_DEUX",
      reproReposObjectifJours: 60,
      tarissementVeauAgeMois: 6,
      reproductionPreviewRules: previewRules(null),
      heatReturnMonitoring: parseReproductionRules(null).heatReturnMonitoring,
    };
  }
}

async function getAnimal(nutrav: string) {
  await syncAutomaticEchoRequests();
  return prisma.animal.findUnique({
    where: { nutrav },
    include: {
      mere: { select: { id: true, nutrav: true, nobovi: true } },
      taureau: { select: { id: true, nupere: true, nopere: true, traper: true, present: true } },
      groupe: { select: { id: true, nom: true, couleur: true } },
      veaux: {
        select: { id: true, nutrav: true, nobovi: true, danais: true, sexbov: true, statut: true },
        orderBy: { danais: "desc" },
      },
      vaccinations: { orderBy: { date: "asc" } },
      evenements: { orderBy: { date: "desc" }, include: { symptomes: true, reponses: { include: { question: true } } } },
      traitements: {
        orderBy: { dateDebut: "desc" },
        take: 10,
        include: { medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } } },
      },
      pesees: { orderBy: { date: "asc" } },
      velagesVache: {
        orderBy: { date: "desc" },
        include: {
          veau: { select: { nutrav: true, nobovi: true, danais: true, sexbov: true, statut: true, sevreFait: true } },
          veauxDetails: { include: { animal: { select: { nutrav: true, nobovi: true, danais: true, sexbov: true, statut: true, sevreFait: true } } } },
        },
      },
      velageVeau: {
        include: {
          vache: { select: { id: true, nutrav: true, nobovi: true } },
          gestation: { select: { saillie: { select: { taureau: { select: { nupere: true, nopere: true } } } } } },
        },
      },
      veauxVelage: {
        take: 1,
        include: {
          velage: { include: {
            vache: { select: { id: true, nutrav: true, nobovi: true } },
            gestation: { select: { saillie: { select: { taureau: { select: { nupere: true, nopere: true } } } } } },
          } },
        },
      },
      saillies: {
        orderBy: { date: "desc" },
        include: { gestation: true, taureau: true },
      },
      chaleurs: { orderBy: { date: "desc" } },
      demandesEchographie: {
        where: { etat: "A_FAIRE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      sortie: true,
    },
  });
}

export default async function FicheAnimal({ params, searchParams }: PageProps) {
  const { nutrav } = await params;
  const { onglet = "identite", pesee, poids, testRepro } = await searchParams;
  const [animal, groupes, protocoles, configAffichage] = await Promise.all([
    getAnimal(nutrav), getGroupes(), getProtocoles(), getExploitationDisplayConfig(),
  ]);

  if (!animal) notFound();
  const birthVelage = animal.velageVeau ?? animal.veauxVelage[0]?.velage ?? null;
  const fatherNational = animal.taureau?.nupere
    ?? birthVelage?.gestation?.saillie?.taureau?.nupere
    ?? birthVelage?.pereNunati
    ?? null;
  const ancestryAnimals = await findAnimalsByExactNational([
    animal.numeip,
    fatherNational,
  ]);
  const biologicalMother = resolveBiologicalMother({
    linkedMother: animal.mere,
    birthMother: birthVelage?.vache ?? null,
    historicalNumber: animal.numeip,
    historicalName: animal.nomeip,
  });
  const matchedMother = ancestryAnimals.get(normalizeGenealogyNational(animal.numeip));
  const motherWorkNumber = resolveParentWorkNumber({
    linkedWorkNumber: biologicalMother.linked?.nutrav ?? null,
    historicalMatchedWorkNumber: matchedMother?.nutrav ?? null,
    historicalNationalNumber: animal.numeip,
    manualWorkNumber: animal.mereTravailManuel,
  });
  const motherName = biologicalMother.linked?.nobovi
    ?? matchedMother?.name
    ?? animal.nomeip
    ?? animal.mereNomManuel;
  const matchedFather = ancestryAnimals.get(normalizeGenealogyNational(fatherNational));
  const fatherWorkNumber = resolveParentWorkNumber({
    linkedWorkNumber: null,
    historicalMatchedWorkNumber: matchedFather?.nutrav ?? null,
    historicalNationalNumber: fatherNational,
    manualWorkNumber: animal.pereTravailManuel,
  });
  const fatherName = animal.taureau?.nopere
    ?? birthVelage?.gestation?.saillie?.taureau?.nopere
    ?? birthVelage?.pereNom
    ?? matchedFather?.name
    ?? animal.pereNomManuel;
  const lastCalving = animal.velagesVache[0]?.date ?? null;
  const currentBreeding = getCurrentCycleBreeding(animal.saillies, lastCalving);
  const activeEchoRequest = animal.demandesEchographie[0] ?? null;

  const etat: EtatGestation | null =
    animal.sexbov === "F"
      ? (animal.reproductionEtatManuel as EtatGestation | null) ?? getEtatGestation(
          currentBreeding?.date ?? null,
          currentBreeding?.gestation?.etat ?? null,
          currentBreeding?.gestation?.dateVelagePrevue ?? null,
          animal.velagesVache[0]?.date ?? null,
        false,
        configAffichage.reproReposObjectifJours
        )
      : null;

  // Pesées chronologiques + GMQ par période
  const pesees = animal.pesees; // already asc
  let gmqGlobal: number | null = null;
  if (pesees.length >= 2) {
    const first = pesees[0];
    const last = pesees[pesees.length - 1];
    const jours = differenceInDays(last.date, first.date);
    if (jours > 0) gmqGlobal = Math.round(((last.poids - first.poids) / jours) * 1000);
  }
  const gmqParPeriode = pesees.slice(1).map((pesee, i) => {
    const prev = pesees[i];
    const jours = differenceInDays(pesee.date, prev.date);
    if (jours <= 0) return { ...pesee, gmq: null };
    return { ...pesee, gmq: Math.round(((pesee.poids - prev.poids) / jours) * 1000) };
  });

  // IVV — velagesVache est en DESC, ivv[i] = diff entre velages[i] et velages[i+1]
  const ivvList = animal.velagesVache.slice(0, -1).map((v, i) => ({
    velageId: v.id,
    ivv: differenceInDays(v.date, animal.velagesVache[i + 1].date),
  }));
  const ivvMoyen = ivvList.length > 0
    ? Math.round(ivvList.reduce((s, x) => s + x.ivv, 0) / ivvList.length)
    : null;

  const protocolSteps = getVaccinProtocolSteps(animal.danais, animal.vaccinations, protocoles);
  const mheStatus = isMheVendable(animal.vaccinations);
  const affichageDelaiAttente = configAffichage.affichageDelaiAttente;
  const testReproEnabled = animal.nutrav === "0000" && testRepro === "1";
  const reproductiveCycleProps = {
    status: etat,
    breedingDate: currentBreeding?.date ?? null,
    breedingType: currentBreeding?.type ?? null,
    dueDate: currentBreeding?.gestation?.dateVelagePrevue ?? null,
    echoDate: currentBreeding?.gestation?.dateEcho ?? null,
    echoResult: currentBreeding?.gestation?.resultatEcho ?? null,
    echoObservation: currentBreeding?.gestation?.sousResultat ?? null,
    lastCalvingDate: animal.velagesVache[0]?.date ?? null,
    calfNumber: animal.velagesVache[0]?.veau?.nutrav ?? animal.velagesVache[0]?.veauxDetails[0]?.animal?.nutrav ?? animal.velagesVache[0]?.veauxDetails[0]?.nutrav ?? null,
    calfSex: animal.velagesVache[0]?.veau?.sexbov ?? animal.velagesVache[0]?.veauxDetails[0]?.animal?.sexbov ?? animal.velagesVache[0]?.veauxDetails[0]?.sexe ?? null,
    calfBirthDate: animal.velagesVache[0]?.veau?.danais ?? animal.velagesVache[0]?.veauxDetails[0]?.animal?.danais ?? animal.velagesVache[0]?.date ?? null,
    calfSevreDone: animal.velagesVache[0]?.veau?.sevreFait ?? animal.velagesVache[0]?.veauxDetails[0]?.animal?.sevreFait ?? false,
    breedingReference: currentBreeding?.taureau?.nopere ?? currentBreeding?.taureau?.nupere ?? null,
    statusModifiedAt: animal.reproductionEtatModifieAt ?? null,
    restObjectiveDays: configAffichage.reproReposObjectifJours,
    breedingStartDays: configAffichage.reproductionPreviewRules.breedingStartDays,
    reproductionDelayDays: configAffichage.reproductionPreviewRules.reproductionDelayDays,
    echoPreparationEnabled: configAffichage.reproductionPreviewRules.echoPreparationEnabled,
    echoPreparationDays: configAffichage.reproductionPreviewRules.echoPreparationDays,
    echoDueDays: configAffichage.reproductionPreviewRules.echoDueDays,
    imminentCalvingDays: configAffichage.reproductionPreviewRules.imminentCalvingDays,
    dryOffCalfAgeMonths: configAffichage.tarissementVeauAgeMois,
    dryOffDone: animal.tarieFaite,
    dryOffDate: animal.dateTarie ?? null,
  } satisfies ReproductiveCycleTimelineProps;

  const isFemelle = animal.sexbov === "F";
  const activeHeat = animal.statut === "ACTIF"
    ? getActiveHeat(animal.chaleurs, animal.saillies)
    : null;
  const heatReturnReminder = animal.statut === "ACTIF" && !testReproEnabled
    ? getHeatReturnReminder(
        animal.chaleurs,
        animal.saillies,
        lastCalving,
        configAffichage.heatReturnMonitoring,
        new Date(),
        etat === "VERT" || etat === "ROSE"
      )
    : null;
  const tabs = [
    { id: "identite", label: "Identité" },
    { id: "sante", label: "Santé" },
    ...(isFemelle ? [{ id: "reproduction", label: "Repro" }] : []),
  ];

  function tabHref(id: string) {
    const testParam = testReproEnabled ? "&testRepro=1" : "";
    return `/troupeau/${animal!.nutrav}?onglet=${id}${testParam}`;
  }

  return (
    <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto min-h-screen bg-gray-50">
      {/* Header */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <BackButton />
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 rounded-lg bg-green-700 px-2.5 py-1 font-mono text-xl font-bold leading-tight text-white sm:text-2xl">
                {animal.nutrav}
              </span>
              <h2 className="truncate text-lg font-bold text-gray-900 sm:text-2xl">{animal.nobovi ?? "Sans nom"}</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getCategorieColor(getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie))}`}>
                {getCategorieLabel(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie)}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{formatAge(animal.danais)}</span>
              {animal.demandesEchographie.length > 0 && (
                <EchoStatusBadge
                  nutrav={animal.nutrav}
                  canCancel={activeEchoRequest?.origine === "MANUELLE"}
                  saillieId={currentBreeding?.id ?? null}
                  saillieDate={currentBreeding?.date.toISOString() ?? null}
                />
              )}
              {animal.statut !== "ACTIF" && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">{animal.statut}</span>
              )}
            </div>
            <p className="mt-1.5 break-all font-mono text-[11px] text-gray-400 sm:text-xs">
              N° national : {animal.numeroNational ?? "à compléter"}
            </p>
          </div>
          <div className="col-span-2 flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 pt-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-end sm:border-0 sm:pt-0">
            <QuickActionsBar
              animalId={animal.id}
              nutrav={animal.nutrav}
              isFemelle={isFemelle}
              isActif={animal.statut === "ACTIF"}
              saillieId={currentBreeding?.id ?? null}
              saillieDate={currentBreeding?.date.toISOString() ?? null}
              testReproEnabled={testReproEnabled}
              className="p-0"
            />
            <div className="ml-auto inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1 [&>button]:!m-0 [&>button]:!bg-transparent [&>button]:!shadow-none">
              <EditAnimalDrawer
                nutrav={animal.nutrav}
                nobovi={animal.nobovi}
                danais={animal.danais.toISOString()}
                statut={animal.statut}
                estGenisse={animal.estGenisse}
                sexbov={animal.sexbov}
                notes={animal.notes ?? null}
                boucleFaite={animal.boucleFaite}
                numeroNational={animal.numeroNational}
              />
              <Link
                href={`/troupeau/${animal.nutrav}/arbre`}
                className="rounded-lg p-2 text-gray-500 hover:bg-white"
                title="Arbre généalogique"
              >
                <GitBranch size={18} />
              </Link>
              <Link
                href={`/troupeau/${animal.nutrav}/impression`}
                className="rounded-lg p-2 text-gray-500 hover:bg-white"
                title="Imprimer la fiche"
              >
                <Printer size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {animal.sexbov === "F" && (
        <>
          <div className="px-3">
            {testReproEnabled ? (
              <ReproductiveCyclePreview
                realProps={reproductiveCycleProps}
                rules={configAffichage.reproductionPreviewRules}
              />
            ) : (
              <ReproductiveCycleTimeline {...reproductiveCycleProps} />
            )}
          </div>
          {activeHeat && (
            <ActiveHeatAction
              animalId={animal.id}
              animalLabel={animal.nobovi ?? animal.nutrav}
              observedAt={activeHeat.date.toISOString()}
              variant="animal"
              simulationAware={testReproEnabled}
            />
          )}
          {heatReturnReminder && (
            <HeatReturnReminder
              animalId={animal.id}
              animalNumber={animal.nutrav}
              animalName={animal.nobovi}
              heatDate={heatReturnReminder.heat.date.toISOString()}
              day={heatReturnReminder.day}
              hasBreedingAfterHeat={heatReturnReminder.hasBreedingAfterHeat}
              variant="animal"
            />
          )}
        </>
      )}

      {/* Onglets */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 mt-2">
        <div className="flex">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tabHref(tab.id)}
              className={`flex-1 text-center py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                onglet === tab.id
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* ─── ONGLET IDENTITÉ ─── */}
        {onglet === "identite" && (
          <>
            {/* Identité */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <dl className="grid grid-cols-2 sm:grid-cols-3">
                <div className="p-2.5 border-b border-r border-gray-100">
                  <dt className="text-[11px] font-medium text-gray-500 uppercase">Naissance</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-gray-800">{formatDate(animal.danais)}</dd>
                </div>
                <div className="p-2.5 border-b sm:border-r border-gray-100">
                  <dt className="text-[11px] font-medium text-gray-500 uppercase">Catégorie</dt>
                  <dd className="mt-0.5 flex items-center flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getCategorieColor(getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie))}`}>
                      {animal.sexbov === "F" ? "♀" : "♂"} {getCategorieLabel(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie)}
                    </span>
                  </dd>
                </div>

                <div className="col-span-2 sm:col-span-1 p-2.5 border-b border-gray-100">
                  <dt className="text-[11px] font-medium text-gray-500 uppercase">Groupe</dt>
                  <dd className={`mt-0.5 text-sm ${animal.groupe ? "font-semibold text-gray-800" : "font-normal text-gray-400"}`}>
                    {animal.groupe?.nom ?? "Aucun groupe"}
                  </dd>
                </div>
              </dl>

              {(!animal.boucleFaite ||
                ((animal.estGenisse || animal.sexbov === "M") && differenceInDays(new Date(), animal.danais) >= 150) ||
                (animal.sexbov === "F" && !animal.estGenisse && animal.tarieFaite)) && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] font-medium text-gray-500 uppercase mb-1.5">Suivi</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!animal.boucleFaite && (
                      <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                        Boucle à poser
                      </span>
                    )}
                    {(animal.estGenisse || animal.sexbov === "M") && differenceInDays(new Date(), animal.danais) >= 150 && (
                      <SevrageButton
                        animalId={animal.id}
                        nutrav={animal.nutrav}
                        sevreFait={animal.sevreFait}
                        danais={animal.danais.toISOString()}
                        dateSevrage={animal.dateSevrage?.toISOString() ?? null}
                      />
                    )}
                    {animal.sexbov === "F" && !animal.estGenisse && animal.tarieFaite && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                        Tarie{animal.dateTarie ? ` le ${formatDate(animal.dateTarie)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {animal.notes && (
                <div className="border-t border-gray-100 px-3 py-2.5">
                  <div className="text-[11px] font-medium text-gray-500 uppercase mb-1">Notes</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{animal.notes}</p>
                </div>
              )}

              {animal.statut === "ACTIF" && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5 flex flex-wrap gap-2">
                  <CategorieButton
                    nutrav={animal.nutrav}
                    sexbov={animal.sexbov}
                    danais={animal.danais.toISOString()}
                    estGenisse={animal.estGenisse}
                    categorie={animal.categorie}
                  />
                  <GroupeButton
                    nutrav={animal.nutrav}
                    groupeId={animal.groupeId}
                    groupeNom={animal.groupe?.nom ?? null}
                    groupes={groupes}
                  />
                </div>
              )}
            </div>

            {/* Naissance (si c'est un veau) */}
            {birthVelage && (
              <div className="bg-white rounded-xl shadow p-3">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Baby size={16} className="text-pink-500" />
                  Naissance
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span>{formatDate(birthVelage.date)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Mère</span>
                    <Link
                      href={`/troupeau/${birthVelage.vache.nutrav}`}
                      className="text-green-700 font-medium hover:underline flex items-center gap-1"
                    >
                      <span className="font-mono text-xs bg-green-100 px-1.5 py-0.5 rounded">
                        {birthVelage.vache.nutrav}
                      </span>
                      {birthVelage.vache.nobovi && (
                        <span>{birthVelage.vache.nobovi}</span>
                      )}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Qualificatif</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        birthVelage.qualificatif === "NORMAL"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {birthVelage.qualificatif}
                    </span>
                  </div>
                  {birthVelage.pereNom && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Père (déclaré)</span>
                      <span className="font-medium">{birthVelage.pereNom}</span>
                    </div>
                  )}
                  <Link href={`/velage?modifier=${birthVelage.id}&returnTo=${encodeURIComponent(`/troupeau/${animal.nutrav}`)}`} className="mt-2 flex min-h-11 items-center justify-center rounded-lg border border-pink-200 bg-pink-50 px-3 text-sm font-semibold text-pink-800">Voir le vêlage</Link>
                </div>
              </div>
            )}

            {/* Pesées — tous animaux, tous âges */}
            <div className="bg-white rounded-xl shadow p-3">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Scale size={16} className="text-blue-600" />
                Pesées {pesees.length > 0 && `(${pesees.length})`}
              </h3>
              {gmqGlobal !== null && (
                <div className="mb-2 bg-blue-50 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">GMQ global</span>
                  <span className="text-lg font-bold text-blue-700">{gmqGlobal} g/j</span>
                </div>
              )}
              {pesees.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">{formatDate(pesees[0].date)}</span>
                    <span className="font-bold text-gray-800">{pesees[0].poids} kg</span>
                  </div>
                  {gmqParPeriode.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-500">{formatDate(p.date)}</span>
                      <div className="flex items-center gap-3">
                        {p.gmq !== null && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.gmq >= 1500 ? "bg-green-100 text-green-700"
                            : p.gmq >= 1200 ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          }`}>
                            +{p.gmq} g/j
                          </span>
                        )}
                        <span className="font-bold text-gray-800">{p.poids} kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic mb-2">Aucune pesée enregistrée</p>
              )}
              <div className="mt-2">
                <PeseeInlineForm nutrav={animal.nutrav} initialOpen={pesee === "1"} initialPoids={poids && /^\d+(?:[.,]\d+)?$/.test(poids) ? poids.replace(",", ".") : ""} />
              </div>
            </div>

            {/* Généalogie */}
            <div className="bg-white rounded-xl shadow p-3">
              <h3 className="font-semibold text-gray-800 mb-2">Généalogie</h3>
              <div className="space-y-1.5 text-sm">
                {/* Mère */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Mère</span>
                  {biologicalMother.linked ? (
                    <Link
                      href={`/troupeau/${biologicalMother.linked.nutrav}`}
                      className="flex items-center gap-1.5 whitespace-nowrap text-green-700 font-medium hover:underline"
                    >
                      <span className="font-mono text-xs bg-green-100 px-1.5 py-0.5 rounded">
                        {biologicalMother.linked.nutrav}
                      </span>
                      {biologicalMother.linked.nobovi && <span>{biologicalMother.linked.nobovi}</span>}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 whitespace-nowrap text-gray-700">
                      <span className="font-mono">{motherWorkNumber ?? "—"}</span>
                      {motherWorkNumber && motherName && <span>{motherName}</span>}
                    </span>
                  )}
                </div>

                {/* Père */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">Père</span>
                  <span className="flex items-center gap-2 whitespace-nowrap text-gray-800">
                    <span className="font-mono font-medium">{fatherWorkNumber ?? "—"}</span>
                    {fatherWorkNumber && fatherName && <span>{fatherName}</span>}
                  </span>
                </div>
              </div>

              {/* Veaux */}
              {animal.veaux.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 mb-2">
                    Descendance ({animal.veaux.length})
                  </div>
                  <div className="space-y-1">
                    {animal.veaux.map((veau) => (
                      <Link
                        key={veau.id}
                        href={`/troupeau/${veau.nutrav}`}
                        className="flex items-center justify-between py-1.5 hover:bg-gray-50 rounded px-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold">
                            {veau.nutrav}
                          </span>
                          <span className="text-sm text-gray-700">{veau.nobovi ?? "Sans nom"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{formatAge(veau.danais)}</span>
                          <span className="text-xs text-gray-400">{veau.sexbov === "M" ? "M" : "F"}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              veau.statut === "ACTIF"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {veau.statut === "ACTIF" ? "Présent" : "Sorti"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── ONGLET SANTÉ ─── */}
        {onglet === "sante" && (
          <>
            {/* Protocole vaccinal visuel */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                Protocole vaccinal
              </h3>
              {/* Badge MHE vendabilité */}
              <div
                className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                  mheStatus.vendable
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {mheStatus.vendable ? (
                  <ShieldCheck size={16} className="text-green-600 flex-shrink-0" />
                ) : (
                  <ShieldX size={16} className="text-red-600 flex-shrink-0" />
                )}
                MHE — {mheStatus.vendable ? "Vendable" : `Non vendable · ${mheStatus.reason}`}
              </div>

              <div className="space-y-1.5">
                {protocolSteps.map((step) => {
                  const isFirst = !step.isRappel;
                  return (
                    <div
                      key={step.vaccin}
                      className={`flex items-start gap-3 py-1.5 ${step.isRappel ? "pl-5" : ""}`}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {step.status === "done" ? (
                          <CheckCircle2
                            size={18}
                            className="text-green-500"
                          />
                        ) : step.status === "due" ? (
                          <AlertCircle
                            size={18}
                            className={step.isUrgent ? "text-red-500" : "text-orange-400"}
                          />
                        ) : step.status === "pending" ? (
                          <Clock size={18} className="text-gray-400" />
                        ) : (
                          <Circle size={18} className="text-gray-300" />
                        )}
                      </div>

                      {/* Label + date */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium ${
                              step.status === "done"
                                ? "text-green-800"
                                : step.status === "due"
                                ? step.isUrgent
                                  ? "text-red-700"
                                  : "text-orange-700"
                                : "text-gray-500"
                            }`}
                          >
                            {step.isRappel ? "↳ " : ""}{step.label}
                          </span>
                          {step.isMandatory && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                              VENTE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {step.status === "done" && step.doneDate && (
                            <span className="text-green-600 font-medium">{formatDate(step.doneDate)}</span>
                          )}
                          {step.status === "due" && (
                            <span className={step.isUrgent ? "text-red-600 font-semibold" : "text-orange-600"}>
                              {step.isUrgent ? "⚠ En retard — à faire maintenant" : "À faire"}
                            </span>
                          )}
                          {step.status === "pending" && step.eligibleDate && (
                            <span>
                              Disponible le {formatDate(step.eligibleDate)}{" "}
                              (dans {differenceInDays(step.eligibleDate, new Date())}j)
                            </span>
                          )}
                          {step.status === "not_eligible" && step.eligibleDate && (
                            <span>Éligible le {formatDate(step.eligibleDate)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Événements (avec ou sans traitement) */}
            <EvenementsSection
              animalId={animal.id}
              affichageDelaiAttente={affichageDelaiAttente}
              evenements={animal.evenements.map((e) => ({
                ...e,
                symptomes: e.symptomes.map((s) => ({ id: s.id, libelle: s.libelle, typeEvenementId: s.typeEvenementId })),
                reponses: e.reponses.map((r) => ({
                  id: r.id,
                  questionId: r.questionId,
                  libelleEnregistre: r.libelleEnregistre,
                  valeur: r.valeur,
                  questionType: r.question.type,
                })),
                traitements: animal.traitements
                  .filter((t) => t.evenementId === e.id)
                  .map((t) => ({
                    id: t.id,
                    medicamentNom: t.medicamentNom,
                    dateDebut: t.dateDebut.toISOString(),
                    dureeJours: t.dureeJours,
                    voie: t.voie,
                    frequence: t.frequence,
                    dose: t.dose,
                    doseRecommandee: t.doseRecommandee,
                    uniteDosage: t.uniteDosage,
                    poidsUtilise: t.poidsUtilise,
                    motif: t.motif,
                    veterinaire: t.veterinaire,
                    statut: t.statut,
                    delaiAttenteViandeJ: t.delaiAttenteViandeJ ?? t.medicament?.delaiAttenteViandeJ ?? null,
                    delaiAttenteLaitJ: t.delaiAttenteLaitJ ?? t.medicament?.delaiAttenteLaitJ ?? null,
                    ordonnanceNumero: t.ordonnanceNumero,
                    ordonnanceId: t.ordonnanceId,
                    ordonnanceAAssocier: t.ordonnanceAAssocier,
                  })),
              }))}
              traitementsOrphelins={animal.traitements
                .filter((t) => !t.evenementId)
                .map((t) => ({
                  id: t.id,
                  medicamentNom: t.medicamentNom,
                  dateDebut: t.dateDebut.toISOString(),
                  dureeJours: t.dureeJours,
                  voie: t.voie,
                  frequence: t.frequence,
                  dose: t.dose,
                  doseRecommandee: t.doseRecommandee,
                  uniteDosage: t.uniteDosage,
                  poidsUtilise: t.poidsUtilise,
                  motif: t.motif,
                  veterinaire: t.veterinaire,
                  statut: t.statut,
                  delaiAttenteViandeJ: t.delaiAttenteViandeJ ?? t.medicament?.delaiAttenteViandeJ ?? null,
                  delaiAttenteLaitJ: t.delaiAttenteLaitJ ?? t.medicament?.delaiAttenteLaitJ ?? null,
                  ordonnanceNumero: t.ordonnanceNumero,
                  ordonnanceId: t.ordonnanceId,
                  ordonnanceAAssocier: t.ordonnanceAAssocier,
                }))}
            />
          </>
        )}

        {/* ─── ONGLET REPRODUCTION ─── */}
        {onglet === "reproduction" && isFemelle && (
          <>
            {/* État gestation courant */}
            {etat && (
              <div
                className={`rounded-xl shadow p-4 flex items-center gap-3 ${
                  etat === "VERT"
                    ? "bg-green-50 border border-green-200"
                    : etat === "ROSE"
                    ? `${VELAGE_IMMINENT_COLORS.surface} border ${VELAGE_IMMINENT_COLORS.border}`
                    : etat === "JAUNE"
                    ? "bg-yellow-50 border border-yellow-200"
                    : etat === "ROUGE"
                    ? "bg-red-50 border border-red-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div className="flex items-center">
                  <span
                    className={`text-sm font-bold px-3 py-1.5 rounded-full ${getBadgeClass(etat)}`}
                  >
                    {getEtatLabel(etat)}
                  </span>
                  <ReproductionStatusEditor
                    animalIds={[animal.id]}
                    currentStatus={etat}
                    previousStatus={animal.reproductionEtatPrecedent as EtatGestation | null}
                  />
                </div>
                {currentBreeding?.gestation?.dateVelagePrevue && (
                  <div className="text-sm text-gray-700">
                    Vélage prévu:{" "}
                    <span className="font-semibold">
                      {formatDate(currentBreeding.gestation.dateVelagePrevue)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      (J-
                      {differenceInDays(
                        currentBreeding.gestation.dateVelagePrevue,
                        new Date()
                      )}
                      )
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Chaleurs observées */}
            <ChaleursHistory
              initialChaleurs={animal.chaleurs.map((chaleur) => ({
                id: chaleur.id,
                date: chaleur.date.toISOString(),
                notes: chaleur.notes,
              }))}
              testReproEnabled={testReproEnabled}
            />

            {/* Saillies */}
            {animal.saillies.length > 0 && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Saillies ({animal.saillies.length})
                </h3>
                <div className="space-y-2">
                  {animal.saillies.map((saillie) => (
                    <div
                      key={saillie.id}
                      className="border border-gray-100 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{formatDate(saillie.date)}</span>
                        <div className="flex items-center gap-1.5">
                          {saillie.estimation && (
                            <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded">
                              {saillie.type === "IA"
                                ? "IA probable estimée par échographie"
                                : "Saillie probable estimée par échographie"}
                            </span>
                          )}
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {saillie.type}
                          </span>
                        </div>
                      </div>
                      {saillie.taureau && (
                        <div className="text-xs text-gray-500 mt-1">
                          Taureau:{" "}
                          <span className="font-medium">
                            {saillie.taureau.nopere ?? saillie.taureau.nupere}
                          </span>
                          {saillie.taureau.present && (
                            <span className="ml-2 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs font-semibold">
                              Présent
                            </span>
                          )}
                        </div>
                      )}
                      {saillie.gestation && (
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeClass(
                              saillie.gestation.etat as "VERT" | "JAUNE" | "ROUGE" | "ROSE" | "GRIS"
                            )}`}
                          >
                            {getEtatLabel(
                              saillie.gestation.etat as "VERT" | "JAUNE" | "ROUGE" | "ROSE" | "GRIS"
                            )}
                          </span>
                          {saillie.gestation.dateVelagePrevue && (
                            <span className="text-xs text-gray-500">
                              Vélage prévu: {formatDate(saillie.gestation.dateVelagePrevue)}
                            </span>
                          )}
                        </div>
                      )}
                      <DeleteHistoriqueButton
                        endpoint={`/api/saillies/${saillie.id}`}
                        label="🗑 Supprimer cette saillie"
                        confirmLabel="Supprimer saillie + gestation ?"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historique vélages + IVV */}
            {animal.velagesVache.length > 0 && (
              <div className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Baby size={16} className="text-pink-500" />
                    Historique vélages ({animal.velagesVache.length})
                  </h3>
                  {ivvMoyen && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">IVV moy.</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        ivvMoyen <= 365 ? "bg-green-100 text-green-700"
                        : ivvMoyen <= 400 ? "bg-orange-100 text-orange-700"
                        : "bg-red-100 text-red-700"
                      }`}>
                        {ivvMoyen} j {ivvMoyen <= 365 ? "✓" : ivvMoyen <= 400 ? "⚠" : "✗"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {animal.velagesVache.map((velage, i) => {
                    const older = animal.velagesVache[i + 1];
                    const ivv = older ? differenceInDays(velage.date, older.date) : null;
                    const veauxAffiches = velage.veauxDetails.length > 0
                      ? velage.veauxDetails.map((veau) => ({
                          key: veau.id,
                          animal: veau.animal,
                          nutrav: veau.animal?.nutrav ?? veau.nutrav,
                          nom: veau.animal?.nobovi ?? veau.nom,
                          sexe: veau.animal?.sexbov ?? veau.sexe,
                          statut: veau.statut,
                        }))
                      : velage.veau
                        ? [{
                            key: `ancien-${velage.veau.nutrav}`,
                            animal: velage.veau,
                            nutrav: velage.veau.nutrav,
                            nom: velage.veau.nobovi,
                            sexe: velage.veau.sexbov,
                            statut: "VIVANT",
                          }]
                        : [];
                    const numeroterVeaux = veauxAffiches.length > 1;
                    return (
                      <div key={velage.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{formatDate(velage.date)}</span>
                          <div className="flex items-center gap-1.5">
                            {ivv && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                ivv <= 365 ? "bg-green-50 text-green-700"
                                : ivv <= 400 ? "bg-orange-50 text-orange-600"
                                : "bg-red-50 text-red-600"
                              }`}>
                                IVV {ivv}j
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              velage.qualificatif === "NORMAL"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {velage.qualificatif}
                            </span>
                          </div>
                        </div>
                        {veauxAffiches.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {veauxAffiches.map((veau, index) => (
                              <div
                                key={veau.key}
                                className={`flex items-center gap-2 text-xs text-gray-600 ${numeroterVeaux ? "" : "flex-wrap"}`}
                              >
                                {numeroterVeaux && <span>Veau {index + 1}:</span>}
                                {veau.animal ? (
                                  <Link
                                    href={`/troupeau/${veau.animal.nutrav}`}
                                    className={numeroterVeaux
                                      ? "font-mono font-bold text-green-700 hover:underline"
                                      : "rounded bg-green-100 px-1.5 py-0.5 font-mono font-bold text-green-700 hover:underline"}
                                  >
                                    {veau.animal.nutrav}
                                  </Link>
                                ) : (
                                  <span className={numeroterVeaux ? "font-mono" : "font-mono font-bold"}>
                                    {veau.nutrav ?? veau.nom ?? "sans numéro"}
                                  </span>
                                )}
                                {veau.nom && (veau.animal || veau.nutrav) && (
                                  <span className="text-gray-700">{veau.nom}</span>
                                )}
                                <span className="text-gray-400">
                                  {veau.sexe === "M" ? "♂ Mâle" : veau.sexe === "F" ? "♀ Femelle" : "Sexe inconnu"}
                                </span>
                                <span className={numeroterVeaux
                                  ? veau.statut === "MORT_NE" ? "font-medium text-gray-700" : "text-green-700"
                                  : `rounded-full px-1.5 py-0.5 ${
                                      veau.statut === "MORT_NE"
                                        ? "bg-gray-100 font-medium text-gray-700"
                                        : "bg-green-100 text-green-700"
                                    }`}>
                                  {veau.statut === "MORT_NE" ? "Mort-né" : "Vivant"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {velage.pereNom && (
                          <div className="text-xs text-gray-500 mt-1">Père: {velage.pereNom}</div>
                        )}
                        {velage.capteur && <div className="text-xs text-gray-500 mt-1">Capteur utilisé : {velage.capteur}</div>}
                        <div className="mt-3 flex justify-end">
                          <VelageActions
                            velageId={velage.id}
                            returnTo={`/troupeau/${animal.nutrav}?onglet=reproduction`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sortie */}
            {animal.sortie ? (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <LogOut size={16} className="text-gray-500" />
                  Sortie
                </h3>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span>{formatDate(animal.sortie.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium">
                      {animal.sortie.type === "MORT" && "Mort"}
                      {animal.sortie.type === "ELEVAGE" && "Vente vif"}
                      {animal.sortie.type === "BOUCHERIE" && "Boucherie"}
                      {animal.sortie.type === "ENGRAISSEMENT" && "Engraissement"}
                    </span>
                  </div>
                  {animal.sortie.acheteur && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Acheteur</span>
                      <span>{animal.sortie.acheteur}</span>
                    </div>
                  )}
                  {animal.sortie.poids && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Poids</span>
                      <span>{animal.sortie.poids} kg</span>
                    </div>
                  )}
                  {animal.sortie.prixKilo && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prix / kg</span>
                      <span>{animal.sortie.prixKilo.toFixed(2)} €</span>
                    </div>
                  )}
                  {(animal.sortie.prixDefinitifHT ?? animal.sortie.prixPrevuHT) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prix total</span>
                      <span className="font-bold text-green-700">
                        {(animal.sortie.prixDefinitifHT ?? animal.sortie.prixPrevuHT)!.toLocaleString(
                          "fr-FR",
                          { style: "currency", currency: "EUR" }
                        )}
                        {!animal.sortie.prixDefinitifHT && (
                          <span className="text-xs text-gray-400 font-normal ml-1">(estimé)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <Link
                  href="/finances"
                  className="mt-3 flex items-center gap-1.5 text-xs text-green-700 font-medium hover:underline"
                >
                  <Euro size={12} />
                  Voir dans Finances
                </Link>
              </div>
            ) : animal.statut === "ACTIF" ? (
              <Link
                href={`/finances?nouvelle=1&animal=${animal.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                <LogOut size={16} />
                Enregistrer une sortie
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
