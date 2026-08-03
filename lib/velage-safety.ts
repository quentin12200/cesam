export type CalfAnimalSnapshot = {
  id: string;
  nutrav: string;
  nunati: string;
  numeroNational: string | null;
  nobovi: string | null;
  sexbov: string;
  danais: Date;
};

export type CalfDetailSnapshot = {
  id: string;
  animalId: string | null;
  animal: CalfAnimalSnapshot | null;
  nutrav: string | null;
  nunati: string | null;
  nom: string | null;
  sexe: string | null;
  statut: string;
};

export type NormalizedCalf = {
  detailId: string | null;
  animalId: string | null;
  animal: CalfAnimalSnapshot | null;
  nutrav: string;
  nunati: string;
  nom: string;
  sexe: "M" | "F" | "";
  statut: "VIVANT" | "MORT_NE";
};

export function normalizeVelageCalves(source: {
  veau: CalfAnimalSnapshot | null;
  veauxDetails: CalfDetailSnapshot[];
}): NormalizedCalf[] {
  const seenAnimalIds = new Set<string>();
  const calves: NormalizedCalf[] = [];

  for (const detail of source.veauxDetails) {
    if (detail.animalId && seenAnimalIds.has(detail.animalId)) continue;
    if (detail.animalId) seenAnimalIds.add(detail.animalId);
    const sex = detail.animal?.sexbov ?? detail.sexe;
    calves.push({
      detailId: detail.id,
      animalId: detail.animalId,
      animal: detail.animal,
      nutrav: detail.animal?.nutrav ?? detail.nutrav ?? "",
      nunati: detail.animal?.numeroNational ?? detail.nunati ?? "",
      nom: detail.animal?.nobovi ?? detail.nom ?? "",
      sexe: sex === "M" || sex === "F" ? sex : "",
      statut: detail.animalId ? "VIVANT" : detail.statut === "MORT_NE" ? "MORT_NE" : "VIVANT",
    });
  }

  if (source.veau && !seenAnimalIds.has(source.veau.id)) {
    calves.push({
      detailId: null,
      animalId: source.veau.id,
      animal: source.veau,
      nutrav: source.veau.nutrav,
      nunati: source.veau.numeroNational ?? "",
      nom: source.veau.nobovi ?? "",
      sexe: source.veau.sexbov === "M" || source.veau.sexbov === "F" ? source.veau.sexbov : "",
      statut: "VIVANT",
    });
  }

  return calves;
}

export type AnimalRemovalFacts = {
  nutrav: string;
  counts: {
    pesees: number;
    evenements: number;
    traitements: number;
    vaccinations: number;
    parages: number;
    complementsAlim: number;
    chaleurs: number;
    saillies: number;
    demandesEchographie: number;
    velagesVache: number;
    descendants: number;
    ventes: number;
    capteurs: number;
  };
  hasSortie: boolean;
  otherBirthLinks: number;
  protectedDeclarations: number;
  removableBirthDeclarations: number;
  hasOperationalState: boolean;
};

export type RemovalBlockage = { category: string; count: number };

export function consumesLoopNumber(status: string | null | undefined) {
  return status === "VIVANT";
}

const COUNT_LABELS: Array<[keyof AnimalRemovalFacts["counts"], string]> = [
  ["pesees", "pesée(s)"],
  ["evenements", "événement(s) sanitaire(s)"],
  ["traitements", "traitement(s)"],
  ["vaccinations", "vaccination(s)"],
  ["parages", "parage(s)"],
  ["complementsAlim", "complément(s) alimentaire(s)"],
  ["chaleurs", "chaleur(s)"],
  ["saillies", "saillie(s)"],
  ["demandesEchographie", "demande(s) d’échographie"],
  ["velagesVache", "vêlage(s) comme mère"],
  ["descendants", "descendant(s)"],
  ["ventes", "historique(s) de vente"],
  ["capteurs", "attribution(s) de capteur"],
];

export function findRemovalBlockages(facts: AnimalRemovalFacts): RemovalBlockage[] {
  const blockages = COUNT_LABELS.flatMap(([key, category]) => facts.counts[key] > 0
    ? [{ category, count: facts.counts[key] }]
    : []);
  if (facts.hasSortie) blockages.push({ category: "sortie", count: 1 });
  if (facts.otherBirthLinks > 0) blockages.push({ category: "autre lien de naissance", count: facts.otherBirthLinks });
  if (facts.protectedDeclarations > 0) blockages.push({ category: "déclaration administrative transmise ou non supprimable", count: facts.protectedDeclarations });
  if (facts.hasOperationalState) blockages.push({ category: "donnée d’élevage ou de reproduction", count: 1 });
  return blockages;
}

export function describeRemovalBlockage(nutrav: string, blockages: RemovalBlockage[]) {
  const details = blockages.map((item) => `${item.count} ${item.category}`).join(" et ");
  return `Le veau ${nutrav || "sans numéro"} possède ${details}. Le vêlage ne peut pas être supprimé.`;
}
