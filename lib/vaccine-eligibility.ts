/** Éligibilité d'un animal à un protocole vaccinal : catégorie, sexe, gestation, rang de
 * vêlage, lot. Fonction pure, partagée par lib/vaccine-preparation-data.ts (préparation de
 * séance) et lib/vaccine-grid.ts (grille par étape) pour éviter toute règle dupliquée. */

function categoriesCibles(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function correspondCategorie(cibles: string[], categorie: string): boolean {
  if (cibles.length === 0) return true;
  return cibles.some((cible) => {
    if (cible === "VEAU") return categorie === "VEAU_M" || categorie === "VELLE";
    if (cible === "GENISSE") return categorie.includes("GENISSE");
    return cible === categorie;
  });
}

export function estAnimalConcerneParProtocole(
  animal: { categorie: string; sexbov: string; groupeNom: string | null; nombreVelages: number; gestation: boolean },
  protocole: { categoriesJson: string | null; sexeCible: string | null; gestante: boolean | null; rangVelageMin: number | null; rangVelageMax: number | null; lotCible: string | null }
): boolean {
  if (!correspondCategorie(categoriesCibles(protocole.categoriesJson), animal.categorie)) return false;
  if (protocole.sexeCible && protocole.sexeCible !== animal.sexbov) return false;
  if (protocole.gestante === true && !animal.gestation) return false;
  if (protocole.gestante === false && animal.gestation) return false;
  if (protocole.rangVelageMin != null && animal.nombreVelages < protocole.rangVelageMin) return false;
  if (protocole.rangVelageMax != null && animal.nombreVelages > protocole.rangVelageMax) return false;
  if (protocole.lotCible && animal.groupeNom !== protocole.lotCible) return false;
  return true;
}
