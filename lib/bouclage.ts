/** Même population que la page Identification, sans règle d’âge supplémentaire. */
export const BOUCLAGE_POPULATION = {
  statut: "ACTIF",
  velageVeau: { isNot: null },
} as const;

export interface BouclageInfo {
  boucleFaite: boolean;
  estConcerneParBouclage: boolean;
}

export function bouclageInfo(animal: {
  statut: string;
  boucleFaite: boolean;
  velageVeau: unknown;
}): BouclageInfo {
  return {
    boucleFaite: animal.boucleFaite,
    estConcerneParBouclage: animal.statut === BOUCLAGE_POPULATION.statut && animal.velageVeau != null,
  };
}
