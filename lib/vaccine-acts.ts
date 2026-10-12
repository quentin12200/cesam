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
  /** Détails d'administration, quand l'acte réel les porte (affichage de l'historique seulement). */
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  etapeLabel?: string | null;
}

export interface ActeTraitementVaccin {
  id?: string;
  dateDebut: Date;
  medicamentNom: string;
  medicamentId: string | null;
  /** Rattachement structuré optionnel : ne change jamais le fait (date, médicament). */
  protocoleVaccinId?: string | null;
  etapeProtocoleVaccinId?: string | null;
  gestationId?: string | null;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  etapeLabel?: string | null;
}

function cleJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type TraitementVaccinalIdentifie = {
  animalId: string;
  dateDebut: Date;
  medicamentId: string | null;
};

function indexerMedicaments<T>(
  valeurs: readonly T[],
  cleDe: (valeur: T) => string,
  medicamentDe: (valeur: T) => string | null,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const valeur of valeurs) {
    const medicamentId = medicamentDe(valeur);
    if (!medicamentId) continue;
    const cle = cleDe(valeur);
    const medicaments = index.get(cle) ?? new Set<string>();
    medicaments.add(medicamentId);
    index.set(cle, medicaments);
  }
  return index;
}

/**
 * Identités médicamenteuses réellement enregistrées comme Traitement VACCIN, indexées avec
 * la même notion de jour que la déduplication de l'historique unifié. Le filtrage
 * `Medicament.categorie = VACCIN` reste effectué par l'appelant Prisma.
 */
export function medicamentsVaccinauxParAnimalEtJour(
  traitements: readonly TraitementVaccinalIdentifie[],
): Map<string, ReadonlySet<string>> {
  return indexerMedicaments(
    traitements,
    (traitement) => `${traitement.animalId}|${cleJour(traitement.dateDebut)}`,
    (traitement) => traitement.medicamentId,
  );
}

export function cleVaccinaleAnimalJour(animalId: string, date: Date): string {
  return `${animalId}|${cleJour(date)}`;
}

/**
 * Une unique ligne Vaccination générique est un artefact technique lorsqu'au moins deux
 * médicaments possibles sont tous prouvés par des Traitement VACCIN certains le même jour.
 * Plusieurs lignes génériques, ou une couverture partielle, restent volontairement ambiguës.
 */
export function vaccinationGeneriqueCouverteParTraitementsCertains(
  nombreVaccinationsGeneriquesDuJour: number,
  medicamentsPossibles: ReadonlySet<string>,
  medicamentsReels: ReadonlySet<string>,
): boolean {
  return nombreVaccinationsGeneriquesDuJour === 1
    && medicamentsPossibles.size > 1
    && [...medicamentsPossibles].every((medicamentId) => medicamentsReels.has(medicamentId));
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
  const medicamentsTraitementsParJour = indexerMedicaments(
    traitements,
    (traitement) => cleJour(traitement.dateDebut),
    (traitement) => traitement.medicamentId,
  );
  const faites = vaccinations
    .filter((vaccination) => vaccination.statut === "FAIT")
    .map((vaccination) => {
      const candidats = medicamentsTraitementsParJour.get(cleJour(vaccination.date));
      const medicamentId = vaccination.medicamentId ?? (candidats?.size === 1 ? [...candidats][0] : null);
      return { ...vaccination, medicamentId, sourceType: vaccination.sourceType ?? "VACCINATION" as const };
    });
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
      protocoleId: traitement.protocoleVaccinId ?? null,
      etapeProtocoleId: traitement.etapeProtocoleVaccinId ?? null,
      gestationId: traitement.gestationId ?? null,
      voie: traitement.voie ?? null,
      dose: traitement.dose ?? null,
      uniteDosage: traitement.uniteDosage ?? null,
      etapeLabel: traitement.etapeLabel ?? null,
      statut: "FAIT",
    }));
  return [...faites, ...issus];
}
