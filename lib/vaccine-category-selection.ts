/**
 * Familles pratiques pour sélectionner les cibles d'un protocole. Les codes historiques
 * VEAU / GENISSE / VACHE / TAUREAU restent valables et inchangés.
 */
export const FAMILLES_CATEGORIES = [
  { code: "VEAU", label: "Tous les veaux (mâles et velles)", enfants: [
    { code: "VEAU_M", label: "Veaux mâles" }, { code: "VELLE", label: "Velles" },
  ] },
  { code: "GENISSE", label: "Toutes les génisses", enfants: [
    { code: "PRESELECTION_GENISSE", label: "Présélection génisses" },
    { code: "PETITE_GENISSE", label: "Petites génisses" },
    { code: "MOYENNE_GENISSE", label: "Moyennes génisses" },
    { code: "GRANDE_GENISSE", label: "Grandes génisses" },
  ] },
  { code: "VACHE", label: "Vaches", enfants: [] },
  { code: "TAUREAU", label: "Taureaux", enfants: [] },
  { code: "A_ENGRAISSER", label: "À engraisser", enfants: [] },
  { code: "ENGRAISSEMENT", label: "Engraissement", enfants: [] },
] as const;

export const LIBELLES_CATEGORIES_VACCINS: Record<string, string> = {
  VEAU: "veaux", VEAU_M: "veaux mâles", VELLE: "velles",
  GENISSE: "génisses", PRESELECTION_GENISSE: "génisses en présélection",
  PETITE_GENISSE: "petites génisses", MOYENNE_GENISSE: "moyennes génisses",
  GRANDE_GENISSE: "grandes génisses", VACHE: "vaches", TAUREAU: "taureaux",
  A_ENGRAISSER: "bovins à engraisser", ENGRAISSEMENT: "bovins en engraissement",
};

const PARENTS: Record<string, string> = Object.fromEntries(
  FAMILLES_CATEGORIES.flatMap((famille) => famille.enfants.map((enfant) => [enfant.code, famille.code])),
);
const ENFANTS: Record<string, string[]> = Object.fromEntries(
  FAMILLES_CATEGORIES.map((famille) => [famille.code, famille.enfants.map((enfant) => enfant.code)]),
);

/** Quand une famille entière est sélectionnée, cocher/décocher un enfant donne
 * le choix exact sans cumuler famille + enfant (ce qui serait trompeur). */
export function basculerCategorieVaccinale(selection: readonly string[], code: string): string[] {
  if (!(code in LIBELLES_CATEGORIES_VACCINS)) return [...selection];
  const precedente = new Set(selection);
  const parent = PARENTS[code];
  if (parent) {
    const enfants = ENFANTS[parent];
    if (precedente.has(parent)) {
      precedente.delete(parent);
      for (const enfant of enfants) if (enfant !== code) precedente.add(enfant);
    } else {
      if (precedente.has(code)) precedente.delete(code);
      else precedente.add(code);
      if (enfants.every((enfant) => precedente.has(enfant))) {
        for (const enfant of enfants) precedente.delete(enfant);
        precedente.add(parent);
      }
    }
  } else {
    const enfants = ENFANTS[code] ?? [];
    if (precedente.has(code)) {
      precedente.delete(code);
    } else {
      precedente.add(code);
      for (const enfant of enfants) precedente.delete(enfant);
    }
  }
  return [...precedente];
}

export function categorieVaccinaleSelectionnee(selection: readonly string[], code: string): boolean {
  return selection.includes(code) || (PARENTS[code] != null && selection.includes(PARENTS[code]));
}

export function sexeImpliciteCategorieVaccinale(categories: readonly string[]): "F" | "M" | null {
  if (!categories.length) return null;
  const femelles = new Set(["VELLE", "GENISSE", "PRESELECTION_GENISSE", "PETITE_GENISSE",
    "MOYENNE_GENISSE", "GRANDE_GENISSE", "VACHE"]);
  const males = new Set(["VEAU_M", "TAUREAU"]);
  if (categories.every((categorie) => femelles.has(categorie))) return "F";
  if (categories.every((categorie) => males.has(categorie))) return "M";
  return null;
}

/** Lecture prudente des catégories d'un ancien protocole. Une valeur illisible doit
 * bloquer l'éditeur plutôt que risquer de convertir le ciblage en « Tous les bovins ». */
export function lireCategoriesHistoriques(raw: string | null): string[] | null {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((valeur) =>
      typeof valeur === "string" && Object.prototype.hasOwnProperty.call(LIBELLES_CATEGORIES_VACCINS, valeur))) return null;
    if (new Set(parsed).size !== parsed.length) return null;
    return parsed;
  } catch {
    return null;
  }
}
