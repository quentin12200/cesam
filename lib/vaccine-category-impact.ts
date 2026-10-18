import { estAnimalConcerneParProtocole } from "./vaccine-eligibility.ts";
import type { AnimalApercuAge } from "./vaccine-age-preview.ts";

export type CibleComparaison = {
  categories: readonly string[];
  sexeCible: string | null;
  gestante: boolean | null;
  rangVelageMin: number | null;
  rangVelageMax: number | null;
  lotCible: string | null;
};

export type ImpactCiblage = {
  animauxVises: number;
  nouvellementVises: number;
  neSerontPlusVises: number;
  populationActive: number;
};

/** Comparaison en lecture seule du ciblage, indépendante des doses et historiques. */
export function comparerPopulationCible(
  animaux: readonly Pick<AnimalApercuAge, "categorie" | "sexe" | "groupeNom" | "nombreVelages" | "gestation">[],
  nouveau: CibleComparaison,
  ancien: CibleComparaison | null,
): ImpactCiblage {
  const admissible = (animal: typeof animaux[number], cible: CibleComparaison) =>
    estAnimalConcerneParProtocole({
      categorie: animal.categorie, sexbov: animal.sexe, groupeNom: animal.groupeNom,
      nombreVelages: animal.nombreVelages, gestation: animal.gestation,
    }, {
      categoriesJson: JSON.stringify(cible.categories),
      sexeCible: cible.sexeCible,
      gestante: cible.gestante, rangVelageMin: cible.rangVelageMin,
      rangVelageMax: cible.rangVelageMax, lotCible: cible.lotCible,
    });
  const bilan: ImpactCiblage = {
    animauxVises: 0, nouvellementVises: 0, neSerontPlusVises: 0, populationActive: animaux.length,
  };
  for (const animal of animaux) {
    const seraVise = admissible(animal, nouveau);
    const etaitVise = ancien === null ? false : admissible(animal, ancien);
    if (seraVise) bilan.animauxVises++;
    if (ancien && seraVise && !etaitVise) bilan.nouvellementVises++;
    if (ancien && !seraVise && etaitVise) bilan.neSerontPlusVises++;
  }
  return bilan;
}
