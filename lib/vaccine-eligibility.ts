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

export type CibleAnimalVaccin = {
  categorie: string; sexbov: string; groupeNom: string | null; nombreVelages: number; gestation: boolean;
};
export type ConfigurationCibleVaccin = {
  categoriesJson: string | null; sexeCible: string | null; gestante: boolean | null;
  rangVelageMin: number | null; rangVelageMax: number | null; lotCible: string | null;
};
export type CritereExclusionVaccinale = "CATEGORIE" | "SEXE" | "GESTATION" | "RANG_VELAGE" | "LOT";
export type ExclusionVaccinale = { critere: CritereExclusionVaccinale; detail: string };

const libelleCategorie = (categorie: string) => ({
  VEAU_M: "Veau", VELLE: "Velle", VEAU: "Veaux",
  GENISSE: "Génisses", VACHE: "Vaches", TAUREAU: "Taureaux",
  PETITE_GENISSE: "Petite génisse", MOYENNE_GENISSE: "Moyenne génisse",
  GRANDE_GENISSE: "Grande génisse", PRESELECTION_GENISSE: "Présélection génisse",
} as Record<string,string>)[categorie] ?? categorie;

/** Pourquoi le protocole n'est pas proposé ? Même logique que l'éligibilité, sans modifier un animal. */
export function expliquerExclusionsVaccinales(
  animal: CibleAnimalVaccin,
  protocole: ConfigurationCibleVaccin,
): ExclusionVaccinale[] {
  const raisons: ExclusionVaccinale[] = [];
  const cibles = categoriesCibles(protocole.categoriesJson);
  if (!correspondCategorie(cibles, animal.categorie)) {
    raisons.push({ critere: "CATEGORIE",
      detail: `Catégorie actuelle : ${libelleCategorie(animal.categorie)} ; catégories ciblées : ${cibles.map(libelleCategorie).join(", ")}.` });
  }
  if (protocole.sexeCible && protocole.sexeCible !== animal.sexbov) {
    raisons.push({ critere: "SEXE",
      detail: `Sexe : ${animal.sexbov === "F" ? "femelle" : "mâle"} ; protocole réservé aux ${protocole.sexeCible === "F" ? "femelles" : "mâles"}.` });
  }
  if (protocole.gestante === true && !animal.gestation) {
    raisons.push({ critere: "GESTATION", detail: "Le protocole cible les animaux gestants ; gestation non confirmée ici." });
  }
  if (protocole.gestante === false && animal.gestation) {
    raisons.push({ critere: "GESTATION", detail: "Le protocole cible les animaux non gestants ; gestation connue ici." });
  }
  if (protocole.rangVelageMin != null && animal.nombreVelages < protocole.rangVelageMin) {
    raisons.push({ critere: "RANG_VELAGE", detail: `Rang de vêlage : ${animal.nombreVelages} ; minimum du protocole : ${protocole.rangVelageMin}.` });
  }
  if (protocole.rangVelageMax != null && animal.nombreVelages > protocole.rangVelageMax) {
    raisons.push({ critere: "RANG_VELAGE", detail: `Rang de vêlage : ${animal.nombreVelages} ; maximum du protocole : ${protocole.rangVelageMax}.` });
  }
  if (protocole.lotCible && animal.groupeNom !== protocole.lotCible) {
    raisons.push({ critere: "LOT",
      detail: `Lot actuel : ${animal.groupeNom ?? "aucun"} ; lot requis : ${protocole.lotCible}.` });
  }
  return raisons;
}

export function estAnimalConcerneParProtocole(
  animal: CibleAnimalVaccin,
  protocole: ConfigurationCibleVaccin,
): boolean {
  return expliquerExclusionsVaccinales(animal, protocole).length === 0;
}
