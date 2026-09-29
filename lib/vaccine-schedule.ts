export interface InterventionVaccinale {
  protocoleId: string;
  vaccin: string;
  animalId: string;
  nutrav: string;
  nom: string | null;
  injection: string;
  dateMin: Date;
  dateMax: Date;
  statut: string;
}

export function trierInterventionsVaccinales<T extends InterventionVaccinale>(lignes: readonly T[]): T[] {
  return [...lignes].sort((a, b) =>
    a.dateMin.getTime() - b.dateMin.getTime() ||
    a.dateMax.getTime() - b.dateMax.getTime() ||
    a.vaccin.localeCompare(b.vaccin, "fr") ||
    a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true })
  );
}
