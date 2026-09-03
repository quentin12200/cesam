import type { Prisma } from "@prisma/client";
import { filtrerAnimauxParCategorie, type AnimalCategorieFilterable } from "./troupeau-category-filter.ts";
import { shouldDisplayNonWeaned } from "./troupeau-display.ts";
import { CATEGORIES_FEMELLES, CATEGORIES_LABELS, CATEGORIES_MALES, type CategorieAnimal } from "./utils.ts";

export type TroupeauSexFilter = "F" | "M";
export type TroupeauReproductionFilter = "PLEINE" | "VIDE" | "A_ECO" | "IMMINENTE";
export type TroupeauHealthFilter = "PROBLEME" | "OK";
export type TroupeauWeaningFilter = "NON_SEVRE" | "SEVRE";
export type TroupeauDryOffFilter = "oui" | "non";

export interface TroupeauFilterParams {
  sexe?: string;
  q?: string;
  categorie?: string;
  tarie?: string;
  repro?: string;
  sanitaire?: string;
  sevrage?: string;
  groupe?: string;
  tri?: string;
}

export const TROUPEAU_CATEGORY_OPTIONS = (Object.entries(CATEGORIES_LABELS) as [CategorieAnimal, string][]).map(
  ([value, label]) => ({ value, label })
);

export const TROUPEAU_REPRODUCTION_OPTIONS = [
  { value: "PLEINE", label: "Gestantes" },
  { value: "VIDE", label: "Vides" },
  { value: "A_ECO", label: "À écho" },
  { value: "IMMINENTE", label: "Imminentes" },
] as const;

export const TROUPEAU_WEANING_OPTIONS = [
  { value: "NON_SEVRE", label: "Non sevrés" },
  { value: "SEVRE", label: "Sevrés" },
] as const;

export const TROUPEAU_HEALTH_OPTIONS = [
  { value: "PROBLEME", label: "En traitement / problème" },
  { value: "OK", label: "Sans problème" },
] as const;

const VALID_REPRODUCTION = new Set(TROUPEAU_REPRODUCTION_OPTIONS.map((option) => option.value));
const VALID_WEANING = new Set(TROUPEAU_WEANING_OPTIONS.map((option) => option.value));
const VALID_HEALTH = new Set(TROUPEAU_HEALTH_OPTIONS.map((option) => option.value));

export function impliedSexForCategory(category: string | undefined): TroupeauSexFilter | undefined {
  if (CATEGORIES_FEMELLES.includes(category as CategorieAnimal)) return "F";
  if (CATEGORIES_MALES.includes(category as CategorieAnimal)) return "M";
  return undefined;
}

export function normalizeTroupeauFilters(params: TroupeauFilterParams): TroupeauFilterParams {
  const categorie = params.categorie && params.categorie in CATEGORIES_LABELS ? params.categorie : undefined;
  return {
    sexe: categorie ? undefined : params.sexe === "F" || params.sexe === "M" ? params.sexe : undefined,
    q: params.q?.trim() || undefined,
    categorie,
    tarie: params.tarie === "oui" || params.tarie === "non" ? params.tarie : undefined,
    repro: VALID_REPRODUCTION.has(params.repro as TroupeauReproductionFilter) ? params.repro : undefined,
    sanitaire: VALID_HEALTH.has(params.sanitaire as TroupeauHealthFilter) ? params.sanitaire : undefined,
    sevrage: VALID_WEANING.has(params.sevrage as TroupeauWeaningFilter) ? params.sevrage : undefined,
    groupe: params.groupe || undefined,
    tri: ["age_asc", "age_desc", "velage_asc", "velage_desc"].includes(params.tri ?? "") ? params.tri : undefined,
  };
}

export function buildTroupeauWhere(params: TroupeauFilterParams): Prisma.AnimalWhereInput {
  const filters = normalizeTroupeauFilters(params);
  const where: Prisma.AnimalWhereInput = { statut: "ACTIF" };
  const effectiveSex = impliedSexForCategory(filters.categorie) ?? filters.sexe;
  if (effectiveSex) where.sexbov = effectiveSex;

  if (filters.q) {
    where.OR = [
      { nutrav: { contains: filters.q } },
      { nobovi: { contains: filters.q } },
      { nunati: { contains: filters.q } },
    ];
  }
  if (filters.tarie === "non") {
    where.velagesVache = { some: { veau: { statut: "ACTIF", sevreFait: false } } };
  } else if (filters.tarie === "oui") {
    where.sexbov = "F";
    where.velagesVache = { none: { veau: { statut: "ACTIF", sevreFait: false } } };
  }
  if (filters.groupe) where.groupeId = filters.groupe;

  if (filters.repro === "PLEINE") {
    where.sexbov = "F";
    where.saillies = { some: { gestation: { etat: { in: ["VERT", "ROSE"] } } } };
  } else if (filters.repro === "VIDE") {
    where.sexbov = "F";
    where.NOT = { saillies: { some: { gestation: { etat: { in: ["VERT", "ROSE"] } } } };
  } else if (filters.repro === "A_ECO") {
    where.sexbov = "F";
    where.OR = [
      { reproductionEtatManuel: "JAUNE" },
      { aEchographier: true },
      { demandesEchographie: { some: { etat: "A_FAIRE" } } },
    ];
  } else if (filters.repro === "IMMINENTE") {
    where.sexbov = "F";
    where.saillies = { some: { gestation: { etat: "ROSE" } } };
  }

  if (filters.sanitaire === "PROBLEME") {
    where.evenements = { some: { resolu: false } };
  } else if (filters.sanitaire === "OK") {
    where.evenements = { none: { resolu: false } };
  }
  return where;
}

export function filtrerAnimauxParCriteresLocaux<T extends AnimalCategorieFilterable & { sevreFait: boolean }>(
  animaux: T[],
  params: TroupeauFilterParams,
  now = new Date()
): T[] {
  const filters = normalizeTroupeauFilters(params);
  const byCategory = filtrerAnimauxParCategorie(animaux, filters.categorie);
  if (!filters.sevrage) return byCategory;
  return byCategory.filter((animal) => {
    const nonWeaned = shouldDisplayNonWeaned(animal.danais, animal.sevreFait, now);
    return filters.sevrage === "NON_SEVRE" ? nonWeaned : !nonWeaned;
  });
}

export interface ActiveTroupeauFilter {
  key: keyof TroupeauFilterParams;
  label: string;
}

export function getActiveTroupeauFilters(
  params: TroupeauFilterParams,
  groups: { id: string; nom: string }[] = []
): ActiveTroupeauFilter[] {
  const filters = normalizeTroupeauFilters(params);
  const active: ActiveTroupeauFilter[] = [];
  if (filters.sexe) active.push({ key: "sexe", label: filters.sexe === "F" ? "♀ Femelles" : "♂ Mâles" });
  if (filters.categorie) active.push({ key: "categorie", label: CATEGORIES_LABELS[filters.categorie as CategorieAnimal] });
  const repro = TROUPEAU_REPRODUCTION_OPTIONS.find((option) => option.value === filters.repro);
  if (repro) active.push({ key: "repro", label: repro.label });
  const weaning = TROUPEAU_WEANING_OPTIONS.find((option) => option.value === filters.sevrage);
  if (weaning) active.push({ key: "sevrage", label: weaning.label });
  const health = TROUPEAU_HEALTH_OPTIONS.find((option) => option.value === filters.sanitaire);
  if (health) active.push({ key: "sanitaire", label: health.label });
  if (filters.groupe) active.push({ key: "groupe", label: groups.find((group) => group.id === filters.groupe)?.nom ?? "Groupe" });
  if (filters.tarie) active.push({ key: "tarie", label: filters.tarie === "oui" ? "Mère tarie" : "Mère non tarie" });
  return active;
}

export function updateTroupeauSearchParams(
  current: URLSearchParams,
  key: keyof TroupeauFilterParams,
  value: string | undefined
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key === "categorie" && value) {
    next.delete("sexe");
    if (impliedSexForCategory(value) === "M") {
      next.delete("repro");
      next.delete("tarie");
    }
  }
  if (key === "sexe" && value) {
    next.delete("categorie");
    if (value === "M") {
      next.delete("repro");
      next.delete("tarie");
    }
  }
  if (key === "repro" && value && impliedSexForCategory(next.get("categorie") ?? undefined) === "M") {
    next.delete("categorie");
  }
  next.delete("page");
  return next;
}

export function resetTroupeauSearchParams(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ["sexe", "categorie", "repro", "sanitaire", "sevrage", "groupe", "tarie"]) next.delete(key);
  next.delete("page");
  return next;
}
