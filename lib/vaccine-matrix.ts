export interface VaccinationMatrice {
  vaccin: string;
  date: Date;
  statut: string;
  medicamentId?: string | null;
}

export interface AnimalMatrice {
  id: string;
  nutrav: string;
  nom: string | null;
  vaccinations: readonly VaccinationMatrice[];
}

export interface PreparationMatrice {
  vaccin: string;
  lignes: readonly { animalId: string; vaccin: string; injection: string; dateMin: Date; dateMax: Date; medicamentId?: string | null; statut?: string }[];
  aConfirmer: readonly { animalId: string; historique: readonly { vaccin: string; date: string }[] }[];
}

/** Médicament de pharmacie catégorisé VACCIN : garantit une colonne même sans historique ni protocole. */
export interface ColonnePharmacie {
  medicamentId: string;
  nom: string;
  voie: string | null;
}

const STATUTS_EN_RETARD = new Set(["EN_RETARD", "EN_RETARD_LEGER"]);

export interface CaseVaccin {
  faits: { date: Date; rappel: boolean }[];
  aFaire: { dateMin: Date; dateMax: Date; injection: string; enRetard: boolean } | null;
  aValider: boolean;
}

export interface LigneMatrice {
  animalId: string;
  nutrav: string;
  nom: string | null;
  cases: Record<string, CaseVaccin>;
}

function cleProduit(nom: string): string {
  const normalise = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
  return normalise.endsWith("_RAPPEL") ? normalise.slice(0, -7) : normalise;
}

export function construireMatriceVaccinale(
  animaux: readonly AnimalMatrice[],
  preparations: readonly PreparationMatrice[],
  colonnesPharmacie: readonly ColonnePharmacie[] = [],
): { vaccins: { cle: string; nom: string; voie: string | null }[]; lignes: LigneMatrice[] } {
  const noms = new Map<string, string>();
  const voies = new Map<string, string | null>();
  // Regroupe prioritairement par medicamentId (fiable) ; le nom normalisé sert de repli pour
  // l'historique libre ancien qui n'a jamais porté d'identifiant de médicament.
  const idVersCle = new Map<string, string>();
  const lignes = new Map<string, LigneMatrice>();

  const resoudreCle = (nom: string, medicamentId?: string | null): string => {
    if (medicamentId) {
      const existante = idVersCle.get(medicamentId);
      if (existante) return existante;
    }
    const cle = cleProduit(nom);
    if (medicamentId && !idVersCle.has(medicamentId)) idVersCle.set(medicamentId, cle);
    return cle;
  };

  const casePour = (animalId: string, nom: string, medicamentId?: string | null): CaseVaccin | null => {
    const ligne = lignes.get(animalId);
    if (!ligne) return null;
    const cle = resoudreCle(nom, medicamentId);
    if (!noms.has(cle) || nom.toUpperCase() === cle) noms.set(cle, nom.toUpperCase().endsWith("_RAPPEL") ? cle : nom);
    return ligne.cases[cle] ??= { faits: [], aFaire: null, aValider: false };
  };

  // Un médicament actif de la pharmacie catégorisé VACCIN garantit sa colonne, même sans
  // historique ni protocole associé.
  for (const medicament of colonnesPharmacie) {
    const cle = resoudreCle(medicament.nom, medicament.medicamentId);
    if (!noms.has(cle)) noms.set(cle, medicament.nom);
    voies.set(cle, medicament.voie);
  }

  for (const animal of animaux) {
    lignes.set(animal.id, { animalId: animal.id, nutrav: animal.nutrav, nom: animal.nom, cases: {} });
    for (const vaccination of animal.vaccinations) {
      if (vaccination.statut !== "FAIT") continue;
      const cellule = casePour(animal.id, vaccination.vaccin, vaccination.medicamentId);
      cellule?.faits.push({ date: vaccination.date, rappel: vaccination.vaccin.toUpperCase().endsWith("_RAPPEL") });
    }
  }
  for (const preparation of preparations) {
    for (const intervention of preparation.lignes) {
      const cellule = casePour(intervention.animalId, intervention.vaccin, intervention.medicamentId);
      if (cellule) cellule.aFaire = {
        dateMin: intervention.dateMin,
        dateMax: intervention.dateMax,
        injection: intervention.injection,
        enRetard: Boolean(intervention.statut && STATUTS_EN_RETARD.has(intervention.statut)),
      };
    }
    for (const attente of preparation.aConfirmer) {
      // Une absence de preuve ne devient jamais une vaccination à faire inventée.
      for (const historique of attente.historique) {
        const cellule = casePour(attente.animalId, historique.vaccin);
        if (cellule) cellule.aValider = true;
      }
    }
  }
  const visibles = [...lignes.values()];
  for (const ligne of visibles) {
    for (const cellule of Object.values(ligne.cases)) {
      cellule.faits.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
  }
  const priorite = (cle: string) => visibles.filter((ligne) => ligne.cases[cle]?.aFaire).length;
  return {
    vaccins: [...noms].map(([cle, nom]) => ({ cle, nom, voie: voies.get(cle) ?? null }))
      .sort((a, b) => priorite(b.cle) - priorite(a.cle) || a.nom.localeCompare(b.nom, "fr")),
    lignes: visibles.sort((a, b) => a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true })),
  };
}
