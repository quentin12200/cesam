import { CATEGORIES_LABELS, getCategorie, type CategorieAnimal } from "./utils.ts";

export interface AnimalCategorieFilterable {
  sexbov: string;
  danais: Date;
  estGenisse: boolean;
  categorie: string | null;
}

function categorieAnimalValide(value: string | null | undefined): value is CategorieAnimal {
  return Boolean(value && value in CATEGORIES_LABELS);
}

/** Filtre strictement sur la catégorie effective affichée par CESAM. */
export function filtrerAnimauxParCategorie<T extends AnimalCategorieFilterable>(
  animaux: T[],
  categorie: string | null | undefined,
): T[] {
  if (!categorieAnimalValide(categorie)) return animaux;
  return animaux.filter((animal) =>
    getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie) === categorie
  );
}
