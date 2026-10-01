/**
 * Historique vaccinal unifié : une vaccination réellement enregistrée dans Sanitaire doit
 * toujours être visible comme faite, qu'elle ait été saisie comme `Vaccination` structurée
 * (via une séance) ou comme simple `Traitement` utilisant un médicament de catégorie VACCIN.
 *
 * `Vaccination` reste la source la plus riche (protocole, étape, gestation) : en cas de
 * doublon entre les deux tables pour le même animal/médicament/jour, elle est prioritaire.
 */

export interface ActeVaccination {
  sourceType?: "VACCINATION" | "TRAITEMENT";
  sourceId?: string | null;
  date: Date;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string | null;
  etapeProtocoleId: string | null;
  gestationId: string | null;
  statut: string;
}

export interface ActeTraitementVaccin {
  id?: string;
  dateDebut: Date;
  medicamentNom: string;
  medicamentId: string | null;
}

function cleJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fusionne les `Vaccination` (statut FAIT) et les `Traitement` dont le médicament est
 * catégorisé VACCIN en une seule liste d'actes réellement faits.
 * Dédoublonnage : même médicament (medicamentId) + même animal (implicite : les deux listes
 * sont déjà scopées à un animal) + même jour calendaire → un seul acte, la Vaccination gagne
 * (elle porte le protocole/étape/gestation). Deux médicaments différents le même jour restent
 * deux actes distincts ; un `Traitement` sans `medicamentId` n'est jamais fusionné.
 */
export function unifierActesVaccinaux(
  vaccinations: readonly ActeVaccination[],
  traitements: readonly ActeTraitementVaccin[]
): ActeVaccination[] {
  const faites = vaccinations
    .filter((vaccination) => vaccination.statut === "FAIT")
    .map((vaccination) => ({ ...vaccination, sourceType: vaccination.sourceType ?? "VACCINATION" as const }));
  const couverts = new Set(
    faites
      .filter((vaccination) => vaccination.medicamentId)
      .map((vaccination) => `${vaccination.medicamentId}|${cleJour(vaccination.date)}`)
  );
  const issus = traitements
    .filter((traitement) => traitement.medicamentId)
    .filter((traitement) => !couverts.has(`${traitement.medicamentId}|${cleJour(traitement.dateDebut)}`))
    .map((traitement): ActeVaccination => ({
      sourceType: "TRAITEMENT",
      sourceId: traitement.id ?? null,
      date: traitement.dateDebut,
      vaccin: traitement.medicamentNom,
      medicamentId: traitement.medicamentId,
      protocoleId: null,
      etapeProtocoleId: null,
      gestationId: null,
      statut: "FAIT",
    }));
  return [...faites, ...issus];
}
