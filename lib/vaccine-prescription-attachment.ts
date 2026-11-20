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
}): string | null {
  if (!["VACCINATION", "TRAITEMENT"].includes(input.sourceType) || !input.sourceId || !input.ordonnanceId) return "Acte et ordonnance requis";
  if (!input.acteExiste) return "Acte introuvable";
  if (!input.estVaccin) return "Ce traitement n'est pas une vaccination";
  if (!input.medicamentId || !input.medicamentsOrdonnanceIds.includes(input.medicamentId)) return "L'ordonnance ne contient pas le vaccin de cet acte";
  if (input.ordonnanceActuelleId && input.ordonnanceActuelleId !== input.ordonnanceId) return "Une autre ordonnance est déjà associée : correction manuelle nécessaire";
  return null;
}
