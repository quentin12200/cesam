export interface VaccinationMatrice {
  vaccin: string;
  date: Date;
  statut: string;
}

export interface AnimalMatrice {
  id: string;
  nutrav: string;
  nom: string | null;
  vaccinations: readonly VaccinationMatrice[];
}

export interface PreparationMatrice {
  vaccin: string;
  lignes: readonly { animalId: string; vaccin: string; injection: string; dateMin: Date; dateMax: Date }[];
  aConfirmer: readonly { animalId: string; historique: readonly { vaccin: string; date: string }[] }[];
}

export interface CaseVaccin {
  faits: { date: Date; rappel: boolean }[];
  aFaire: { dateMin: Date; dateMax: Date; injection: string } | null;
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
): { vaccins: { cle: string; nom: string }[]; lignes: LigneMatrice[] } {
  const noms = new Map<string, string>();
  const lignes = new Map<string, LigneMatrice>();
  const casePour = (animalId: string, nom: string): CaseVaccin | null => {
    const ligne = lignes.get(animalId);
    if (!ligne) return null;
    const cle = cleProduit(nom);
    if (!noms.has(cle) || nom.toUpperCase() === cle) noms.set(cle, nom.toUpperCase().endsWith("_RAPPEL") ? cle : nom);
    return ligne.cases[cle] ??= { faits: [], aFaire: null, aValider: false };
  };

  for (const animal of animaux) {
    lignes.set(animal.id, { animalId: animal.id, nutrav: animal.nutrav, nom: animal.nom, cases: {} });
    for (const vaccination of animal.vaccinations) {
      if (vaccination.statut !== "FAIT") continue;
      const cellule = casePour(animal.id, vaccination.vaccin);
      cellule?.faits.push({ date: vaccination.date, rappel: vaccination.vaccin.toUpperCase().endsWith("_RAPPEL") });
    }
  }
  for (const preparation of preparations) {
    for (const intervention of preparation.lignes) {
      const cellule = casePour(intervention.animalId, intervention.vaccin);
      if (cellule) cellule.aFaire = {
        dateMin: intervention.dateMin,
        dateMax: intervention.dateMax,
        injection: intervention.injection,
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
    vaccins: [...noms].map(([cle, nom]) => ({ cle, nom }))
      .sort((a, b) => priorite(b.cle) - priorite(a.cle) || a.nom.localeCompare(b.nom, "fr")),
    lignes: visibles.sort((a, b) => a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true })),
  };
}
