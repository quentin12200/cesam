/** Contrôle métier pur : rattacher une ordonnance sans recréer d'acte vaccinal. */
export function verifierRattachementOrdonnanceActe(input: {
  sourceType: string;
  sourceId: string;
  ordonnanceId: string;
  acteExiste: boolean;
  estVaccin: boolean;
  medicamentId: string | null;
  medicamentsOrdonnanceIds: Array<string | null>;
  ordonnanceActuelleId: string | null;
  nomVaccinActe?: string | null;
  nomsVaccinsOrdonnance?: Array<string | null>;
  nombreMedicamentsOrdonnance?: number;
}): string | null {
  if (!["VACCINATION", "TRAITEMENT"].includes(input.sourceType) || !input.sourceId || !input.ordonnanceId) return "Acte et ordonnance requis";
  if (!input.acteExiste) return "Acte introuvable";
  if (!input.estVaccin) return "Ce traitement n'est pas une vaccination";
  if (input.medicamentId) {
    if (!input.medicamentsOrdonnanceIds.includes(input.medicamentId)) return "L'ordonnance ne contient pas le vaccin de cet acte";
  } else {
    // Actes historiques : aucune association approximative ou basée sur une sous-chaîne.
    // Une ordonnance multi-médicaments est volontairement exclue de ce repli.
    const normaliser = (nom: string | null | undefined) => (nom ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("fr-FR").replace(/\s+/g, " ");
    const nomActe = normaliser(input.nomVaccinActe);
    const noms = (input.nomsVaccinsOrdonnance ?? []).map(normaliser).filter(Boolean);
    if (!nomActe || input.nombreMedicamentsOrdonnance !== 1 || noms.length === 0 || !noms.every((nom) => nom === nomActe)) {
      return "Vaccin historique sans identifiant : correspondance exacte et ordonnance à médicament unique requises";
    }
  }
  if (input.ordonnanceActuelleId && input.ordonnanceActuelleId !== input.ordonnanceId) return "Une autre ordonnance est déjà associée : correction manuelle nécessaire";
  return null;
}
