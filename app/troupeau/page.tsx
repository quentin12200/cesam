import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  getEtatGestation,
  getBadgeClass,
  formatAge,
  getCategorie,
  getCategorieLabel,
  getCategorieColor,
  CATEGORIES_LABELS,
  type CategorieAnimal,
} from "@/lib/utils";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal } from "lucide-react";
import { addDays, differenceInDays, differenceInMonths, subDays } from "date-fns";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import { Suspense } from "react";
import NouvelAnimalForm from "./NouvelAnimalForm";
import GroupeCreateButton from "./GroupeCreateButton";
import NutravBadge from "@/app/components/NutravBadge";
import TroupeauScrollRestorer from "./TroupeauScrollRestorer";
import TroupeauTableau, { type AnimalRow } from "./TroupeauTableau";
import MoreMenu from "./MoreMenu";
import TroupeauTabs from "@/components/TroupeauTabs";
import { syncAutomaticEchoRequests } from "@/lib/echo-requests";

interface PageProps {
  searchParams: Promise<{
    sexe?: string;
    q?: string;
    categorie?: string;
    tarie?: string;
    repro?: string;
    sanitaire?: string;
    groupe?: string;
    tri?: string;
    nouveau?: string;
    filtres?: string;
    vue?: string;
  }>;
}

async function getAnimaux(params: {
  sexe?: string;
  q?: string;
  categorie?: string;
  tarie?: string;
  repro?: string;
  sanitaire?: string;
  groupe?: string;
  tri?: string;
}) {
  await syncAutomaticEchoRequests();
  const { sexe, q, categorie, tarie, repro, sanitaire, groupe, tri } = params;
  const now = new Date();
  const where: Prisma.AnimalWhereInput = {};

  if (sexe && (sexe === "F" || sexe === "M")) where.sexbov = sexe;
  where.statut = "ACTIF";

  if (q && q.trim()) {
    where.OR = [
      { nutrav: { contains: q.trim() } },
      { nobovi: { contains: q.trim() } },
      { nunati: { contains: q.trim() } },
    ];
  }

  // Non tarie = a un veau actif non sevré ; tarie = femelle sans veau actif non sevré
  if (tarie === "non") {
    where.velagesVache = { some: { veau: { statut: "ACTIF", sevreFait: false } } };
  }
  if (tarie === "oui") {
    if (!where.sexbov) where.sexbov = "F";
    where.velagesVache = { none: { veau: { statut: "ACTIF", sevreFait: false } } };
  }

  if (groupe) where.groupeId = groupe;

  // Filtre statut reproduction
  if (repro === "PLEINE") {
    where.sexbov = "F";
    where.saillies = { some: { gestation: { etat: { in: ["VERT", "ROSE"] } } } };
  } else if (repro === "VIDE") {
    where.sexbov = "F";
    where.NOT = { saillies: { some: { gestation: { etat: { in: ["VERT", "ROSE"] } } } } };
  } else if (repro === "A_ECO") {
    where.sexbov = "F";
    where.demandesEchographie = { some: { etat: "A_FAIRE" } };
  }

  // Filtre statut sanitaire
  if (sanitaire === "PROBLEME") {
    where.evenements = { some: { resolu: false } };
  } else if (sanitaire === "OK") {
    where.evenements = { none: { resolu: false } };
  }

  // Filtre catégorie
  if (categorie && categorie !== "TOUS") {
    const ageMoisMin = (m: number) => addDays(now, -(m * 30.44));
    const ageMoisMax = (m: number) => addDays(now, -(m * 30.44));
    switch (categorie as CategorieAnimal) {
      case "VACHE":
        where.sexbov = "F";
        where.estGenisse = false;
        where.danais = { lt: addDays(now, -365) };
        where.categorie = null;
        break;
      case "VELLE":
        where.sexbov = "F";
        where.OR = [
          { estGenisse: false, danais: { gte: addDays(now, -365) }, categorie: null },
          { categorie: "VELLE" },
        ];
        break;
      case "TAUREAU":
        where.sexbov = "M";
        where.danais = { lt: addDays(now, -456) }; // ~15 months
        break;
      case "VEAU_M":
        where.sexbov = "M";
        where.danais = { gte: addDays(now, -456) };
        // inclure ceux sans catégorie manuelle (auto = VEAU_M) et ceux explicitement VEAU_M
        break;
      case "PETITE_GENISSE":
        where.sexbov = "F";
        where.estGenisse = true;
        where.danais = { gte: addDays(now, -365) };
        break;
      case "MOYENNE_GENISSE":
        where.sexbov = "F";
        where.estGenisse = true;
        where.danais = { gte: addDays(now, -730), lt: addDays(now, -365) };
        break;
      case "GRANDE_GENISSE":
        where.sexbov = "F";
        where.estGenisse = true;
        where.danais = { gte: addDays(now, -1095), lt: addDays(now, -730) };
        break;
      default:
        // PRESELECTION_GENISSE et autres — filtre direct par champ categorie
        where.categorie = categorie;
    }
  }

  const orderBy: Prisma.AnimalOrderByWithRelationInput =
    tri === "age_asc" ? { danais: "desc" }
    : tri === "age_desc" ? { danais: "asc" }
    : { nutrav: "asc" };

  const [total, animaux, groupes] = await Promise.all([
    prisma.animal.count({ where }),
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
        tarieFaite: true,
        aEchographier: true,
        demandesEchographie: {
          where: { etat: "A_FAIRE" },
          orderBy: { createdAt: "desc" as const },
          take: 1,
          select: { origine: true, motif: true },
        },
        reproductionEtatManuel: true,
        reproductionEtatPrecedent: true,
        groupe: { select: { id: true, nom: true, couleur: true } },
        saillies: {
          orderBy: { date: "desc" as const },
          take: 1,
          select: {
            date: true,
            gestation: { select: { etat: true, dateVelagePrevue: true } },
          },
        },
        velagesVache: {
          orderBy: { date: "desc" as const },
          take: 1,
          select: {
            date: true,
            veau: { select: { nutrav: true, statut: true, sevreFait: true } },
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
  ]);

  return { animaux, total, groupes };
}

export default async function TroupeauPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sexe = params.sexe;
  const q = params.q;
  const categorie = params.categorie;
  const tarie = params.tarie;
  const repro = params.repro;
  const sanitaire = params.sanitaire;
  const groupe = params.groupe;
  const tri = params.tri;
  const vue = params.vue;
  const showForm = params.nouveau === "1";
  const showFiltres = params.filtres === "1";

  const { animaux, total, groupes } = await getAnimaux({
    sexe, q, categorie, tarie, repro, sanitaire, groupe, tri,
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

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string> = {};
    if (sexe) p.sexe = sexe;
    if (q) p.q = q;
    if (categorie) p.categorie = categorie;
    if (tarie) p.tarie = tarie;
    if (repro) p.repro = repro;
    if (sanitaire) p.sanitaire = sanitaire;
    if (groupe) p.groupe = groupe;
    if (tri) p.tri = tri;
    if (showFiltres) p.filtres = "1";
    if (vue) p.vue = vue;
    Object.assign(p, overrides);
    Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
    const qs = new URLSearchParams(p as Record<string, string>).toString();
    return `/troupeau${qs ? "?" + qs : ""}`;
  }

  const activeFiltersCount = [
    sexe, tarie, repro, sanitaire, groupe,
    categorie && categorie !== "TOUS" ? categorie : undefined,
  ].filter(Boolean).length;


  const CATS_F: { value: string; label: string }[] = [
    { value: "VACHE", label: "Vaches" },
    { value: "PETITE_GENISSE", label: "Petite génisse" },
    { value: "MOYENNE_GENISSE", label: "Moy. génisse" },
    { value: "GRANDE_GENISSE", label: "Grande génisse" },
    { value: "PRESELECTION_GENISSE", label: "Présélection" },
    { value: "VELLE", label: "Velle" },
    { value: "A_ENGRAISSER", label: "À engraisser" },
    { value: "ENGRAISSEMENT", label: "Engraissement" },
  ];

  const CATS_M: { value: string; label: string }[] = [
    { value: "TAUREAU", label: "Taureaux" },
    { value: "VEAU_M", label: "Veaux" },
  ];

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto pb-24">
      <TroupeauScrollRestorer />
      <TroupeauTabs />
      <div className="flex items-center gap-3 mt-2">
<div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold text-gray-800">Animaux</h2>
          <p className="truncate text-xs text-gray-500">Consulter et rechercher tout le troupeau</p>
        </div>
        <Link
          href={buildUrl({ filtres: showFiltres ? undefined : "1" })}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg shadow text-sm font-medium transition-colors ${
            showFiltres || activeFiltersCount > 0
              ? "bg-green-700 text-white"
              : "bg-white text-gray-600"
          }`}
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Filtres</span>
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {activeFiltersCount}
            </span>
          )}
        </Link>

        <MoreMenu
          printHref={`/troupeau/impression?${new URLSearchParams(
            Object.fromEntries(
              Object.entries({ sexe, q, categorie, tarie, repro, sanitaire, groupe, tri })
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

      {/* Panneau de filtres */}
      {showFiltres && (
        <div className="bg-white rounded-xl shadow p-4 space-y-4 border border-green-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Filtres avancés</h3>
            {activeFiltersCount > 0 && (
              <Link
                href="/troupeau?filtres=1"
                className="text-xs text-red-500 font-medium hover:underline"
              >
                Réinitialiser tout
              </Link>
            )}
          </div>

          {/* Tri — placé en premier */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Trier par</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: undefined, label: "N° Travail" },
                { value: "age_asc", label: "Plus jeune d'abord" },
                { value: "age_desc", label: "Plus âgé d'abord" },
              ].map((opt) => (
                <Link
                  key={opt.label}
                  href={buildUrl({ tri: opt.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    tri === opt.value || (!tri && !opt.value)
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Sexe */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Sexe</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: undefined, label: "Tous" },
                { value: "F", label: "♀ Femelles" },
                { value: "M", label: "♂ Mâles" },
              ].map((opt) => (
                <Link
                  key={opt.label}
                  href={buildUrl({ sexe: opt.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    sexe === opt.value || (!sexe && !opt.value)
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Catégorie femelle */}
          {sexe !== "M" && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Catégorie femelle</p>
              <div className="flex gap-1.5 flex-wrap">
                <Link
                  href={buildUrl({ categorie: undefined })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !categorie ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  Toutes
                </Link>
                {CATS_F.map((c) => (
                  <Link
                    key={c.value}
                    href={buildUrl({ categorie: c.value, sexe: "F" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      categorie === c.value
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Catégorie mâle */}
          {sexe !== "F" && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Catégorie mâle</p>
              <div className="flex gap-1.5 flex-wrap">
                <Link
                  href={buildUrl({ categorie: undefined })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !categorie ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  Tous
                </Link>
                {CATS_M.map((c) => (
                  <Link
                    key={c.value}
                    href={buildUrl({ categorie: c.value, sexe: "M" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      categorie === c.value
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tarie */}
          {sexe !== "M" && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">État tarie</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { value: undefined, label: "Toutes" },
                  { value: "oui", label: "Taries" },
                  { value: "non", label: "Non taries" },
                ].map((opt) => (
                  <Link
                    key={opt.label}
                    href={buildUrl({ tarie: opt.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      tarie === opt.value || (!tarie && !opt.value)
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Statut reproduction */}
          {sexe !== "M" && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Statut reproduction</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { value: undefined, label: "Toutes" },
                  { value: "PLEINE", label: "Pleines" },
                  { value: "VIDE", label: "Vides" },
                  { value: "A_ECO", label: "À écho" },
                ].map((opt) => (
                  <Link
                    key={opt.label}
                    href={buildUrl({ repro: opt.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      repro === opt.value || (!repro && !opt.value)
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Statut sanitaire */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Santé</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: undefined, label: "Tous" },
                { value: "PROBLEME", label: "En traitement" },
                { value: "OK", label: "Sains" },
              ].map((opt) => (
                <Link
                  key={opt.label}
                  href={buildUrl({ sanitaire: opt.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    sanitaire === opt.value || (!sanitaire && !opt.value)
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Groupe */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Groupe / Lot</p>
            {groupes.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-1">
                <Link
                  href={buildUrl({ groupe: undefined })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !groupe ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  Tous
                </Link>
                {groupes.map((g) => (
                  <Link
                    key={g.id}
                    href={buildUrl({ groupe: g.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      groupe === g.id
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {g.nom}
                  </Link>
                ))}
              </div>
            )}
            <GroupeCreateButton />
          </div>

        </div>
      )}

      {/* Recherche */}
      <form method="GET" action="/troupeau" className="relative">
        {/* Preserve current filters */}
        {sexe && <input type="hidden" name="sexe" value={sexe} />}
        {categorie && <input type="hidden" name="categorie" value={categorie} />}
        {tarie && <input type="hidden" name="tarie" value={tarie} />}
        {repro && <input type="hidden" name="repro" value={repro} />}
        {sanitaire && <input type="hidden" name="sanitaire" value={sanitaire} />}
        {groupe && <input type="hidden" name="groupe" value={groupe} />}
        {tri && <input type="hidden" name="tri" value={tri} />}
        {showFiltres && <input type="hidden" name="filtres" value="1" />}
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="N° Travail, N° Nat ou nom…"
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </form>

      {/* Résumé filtres actifs */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {total} {total > 1 ? "animaux" : "animal"}
          {activeFiltersCount > 0 && ` · ${activeFiltersCount} filtre${activeFiltersCount > 1 ? "s" : ""} actif${activeFiltersCount > 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Tableau sur ordinateur */}
      <div className="hidden md:block">
        <Suspense fallback={<div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">Chargement…</div>}>
          <TroupeauTableau
            animaux={animaux.map<AnimalRow>((a) => ({
              id: a.id,
              nutrav: a.nutrav,
              nobovi: a.nobovi,
              danais: a.danais.toISOString(),
              sexbov: a.sexbov,
              estGenisse: a.estGenisse,
              tarieFaite: a.tarieFaite,
              aEchographier: a.demandesEchographie.length > 0,
              reproductionEtatManuel: a.reproductionEtatManuel as AnimalRow["reproductionEtatManuel"],
              reproductionEtatPrecedent: a.reproductionEtatPrecedent as AnimalRow["reproductionEtatPrecedent"],
              categorie: a.categorie,
              groupeNom: a.groupe?.nom ?? null,
              saillieDate: a.saillies[0]?.date.toISOString() ?? null,
              gestationEtat: a.saillies[0]?.gestation?.etat ?? null,
              gestationVelagePrevue: a.saillies[0]?.gestation?.dateVelagePrevue?.toISOString() ?? null,
              velageDate: a.velagesVache[0]?.date.toISOString() ?? null,
              veauNutrav: a.velagesVache[0]?.veau?.nutrav ?? null,
              veauStatut: a.velagesVache[0]?.veau?.statut ?? null,
              veauSevreFait: a.velagesVache[0]?.veau?.sevreFait ?? null,
              dernierPoids: a.pesees[0]?.poids ?? null,
              dernierePeseeDate: a.pesees[0]?.date.toISOString() ?? null,
              enAttente: a.traitements.some((t) => getAttenteInfoForTraitement(t).enAttente),
            }))}
            groupes={groupes}
          />
        </Suspense>
      </div>

      {/* Cartes sur téléphone */}
      <div className="space-y-2 md:hidden">
          {animaux.map((animal) => {
            const cat = getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie);
            const catLabel = getCategorieLabel(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie);
            const catColor = getCategorieColor(cat);
            const etat =
              ["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "A_ENGRAISSER"].includes(cat)
                ? ((animal.reproductionEtatManuel as ReturnType<typeof getEtatGestation> | null) ?? getEtatGestation(
                    animal.saillies[0]?.date ?? null,
                    animal.saillies[0]?.gestation?.etat ?? null,
                    animal.saillies[0]?.gestation?.dateVelagePrevue ?? null,
                    animal.velagesVache[0]?.date ?? null,
                    false
                  ))
                : null;
            const veau = animal.velagesVache[0]?.veau;
            const enAttente = animal.traitements.some((t) => getAttenteInfoForTraitement(t).enAttente);

            return (
              <Link
                key={animal.id}
                href={`/troupeau/${animal.nutrav}`}
                className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <NutravBadge nutrav={animal.nutrav} />
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 text-sm truncate">
                        {animal.nobovi ?? <span className="text-gray-400 italic">Sans nom</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{formatAge(animal.danais)}</span>
                        <span className="text-gray-300">·</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catColor}`}>
                          {animal.sexbov === "F" ? "♀" : "♂"} {catLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {enAttente && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700" title="Animal interdit à la vente pendant le délai d'attente">
                            ⛔ Vente interdite
                          </span>
                        )}
                        {etat && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeClass(etat)}`}>
                            {etat === "VERT" ? "Pleine"
                              : etat === "ROSE" ? "Imminente"
                              : etat === "JAUNE" ? "À écho"
                              : etat === "GRIS" ? "Saillie récente"
                              : etat === "REPOS" ? "Repos"
                              : "Vide"}
                          </span>
                        )}
                        {animal.demandesEchographie.length > 0 && (
                          <span
                            className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full"
                            title={animal.demandesEchographie[0]?.origine === "AUTOMATIQUE" ? "Demande automatique" : "Demande manuelle"}
                          >
                            Écho à faire
                          </span>
                        )}
                        {veau && veau.statut === "ACTIF" && !veau.sevreFait && !animal.tarieFaite && (
                          <span className="text-xs text-blue-700 font-mono font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                            🍼 {veau.nutrav}
                          </span>
                        )}
                        {animal.pesees[0] && (
                          <span className="text-xs font-semibold text-gray-700">
                            {animal.pesees[0].poids} kg
                            <span className="ml-1 font-normal text-gray-400">
                              · il y a {differenceInDays(new Date(), animal.pesees[0].date)} j
                            </span>
                          </span>
                        )}
                        {animal.groupe && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                            {animal.groupe.nom}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <svg className="text-gray-400 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </Link>
            );
          })}
          {animaux.length === 0 && (
            <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow">
              Aucun animal trouvé
            </div>
          )}
        </div>

    </div>
  );
}
