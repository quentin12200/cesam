/** Sélection d'ANIMAUX (colonne de gauche), distincte de la sélection d'ACTES vaccinaux. */

export type EtatSelectionMaitre = "AUCUN" | "PARTIEL" | "TOUS";

/** État de la case maître : relatif aux animaux VISIBLES uniquement. */
export function etatSelectionMaitre(visibles: readonly string[], selection: ReadonlySet<string>): EtatSelectionMaitre {
  if (visibles.length === 0) return "AUCUN";
  const nombre = visibles.filter((id) => selection.has(id)).length;
  return nombre === 0 ? "AUCUN" : nombre === visibles.length ? "TOUS" : "PARTIEL";
}

/** Case maître : tout sélectionner si ce n'est pas déjà le cas, sinon désélectionner les visibles. */
export function basculerSelectionVisibles(visibles: readonly string[], selection: ReadonlySet<string>): Set<string> {
  const suivants = new Set(selection);
  if (etatSelectionMaitre(visibles, selection) === "TOUS") visibles.forEach((id) => suivants.delete(id));
  else visibles.forEach((id) => suivants.add(id));
  return suivants;
}

export function libelleAnimauxSelectionnes(nombre: number): string {
  return `${nombre} ${nombre > 1 ? "animaux" : "animal"} sélectionné${nombre > 1 ? "s" : ""}`;
}

/** Ligne compacte : « 8 animaux sélectionnés · Voir seulement · Vider » (ou « Afficher tous »). */
export function actionsSelectionAnimaux(uniquementSelection: boolean): { basculerVue: string; vider: string } {
  return { basculerVue: uniquementSelection ? "Afficher tous" : "Voir seulement", vider: "Vider" };
}