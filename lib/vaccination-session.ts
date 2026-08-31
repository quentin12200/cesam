export interface VaccinationSessionPreset {
  protocoleId: string;
  vaccin: string;
  medicamentId: string;
  voie: string;
  dose: number | null;
  uniteDosage: string | null;
  animaux: Array<{
    animalId: string;
    nutrav: string;
    etapeProtocoleId: string;
    gestationId: string | null;
    typeInjection: string | null;
  }>;
}

export function nutravsSelectionnes<T extends { animalId: string; nutrav: string }>(
  lignes: ReadonlyArray<T>,
  selection: ReadonlySet<string>
): string[] {
  return lignes.filter((ligne) => selection.has(ligne.animalId)).map((ligne) => ligne.nutrav);
}
