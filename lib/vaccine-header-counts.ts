/** Comptages d'échéances vaccinales, dérivés des cellules de la grille : aucune règle métier supplémentaire. */
export type StatutCelluleCompte = "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "PREVU" | "VIDE";
export type CelluleCompte = {
  statut: StatutCelluleCompte;
  aValider: boolean;
  prochaine: { statut: Exclude<StatutCelluleCompte, "FAIT" | "VIDE"> } | null;
};
export type LigneCompte = { animalId: string; cellules: Record<string, CelluleCompte | undefined> };
export type BlocCompte = { cle: string; sousColonnes: readonly { id: string }[] };
export type NombreEcheances = { aFaire: number; enRetard: number };
export type CompteursVaccin = { total: NombreEcheances; etapes: Record<string, NombreEcheances> };

function echeanceDue(cellule: CelluleCompte | undefined): "A_FAIRE" | "EN_RETARD" | null {
  if (!cellule || cellule.aValider) return null;
  const statut = cellule.statut === "FAIT" ? cellule.prochaine?.statut : cellule.statut;
  return statut === "A_FAIRE" || statut === "EN_RETARD" ? statut : null;
}

/**
 * Un animal n'est compté qu'une fois par vaccin, même si plusieurs étapes sont signalées.
 * Les compteurs suivent uniquement les lignes affichées (recherche/filtres appliqués en amont).
 * aFaire inclut enRetard. Les actes « À rattacher » sont exclus.
 */
export function compterVaccinationsVisibles(
  lignesVisibles: readonly LigneCompte[],
  blocs: readonly BlocCompte[],
): Record<string, CompteursVaccin> {
  const resultats: Record<string, CompteursVaccin> = {};
  for (const bloc of blocs) {
    const total: NombreEcheances = { aFaire: 0, enRetard: 0 };
    const etapes: Record<string, NombreEcheances> = Object.fromEntries(
      bloc.sousColonnes.map((etape) => [etape.id, { aFaire: 0, enRetard: 0 }]),
    );
    const animauxComptes = new Set<string>();
    const animauxEnRetard = new Set<string>();
    const animauxComptesParEtape = new Map(bloc.sousColonnes.map((etape) => [etape.id, new Set<string>()]));
    for (const ligne of lignesVisibles) {
      for (const etape of bloc.sousColonnes) {
        const statut = echeanceDue(ligne.cellules[etape.id]);
        if (!statut) continue;
        const vusEtape = animauxComptesParEtape.get(etape.id)!;
        if (!vusEtape.has(ligne.animalId)) {
          vusEtape.add(ligne.animalId);
          etapes[etape.id].aFaire++;
          if (statut === "EN_RETARD") etapes[etape.id].enRetard++;
        }
        if (!animauxComptes.has(ligne.animalId)) {
          animauxComptes.add(ligne.animalId);
          total.aFaire++;
        }
        if (statut === "EN_RETARD" && !animauxEnRetard.has(ligne.animalId)) {
          animauxEnRetard.add(ligne.animalId);
          total.enRetard++;
        }
      }
    }
    resultats[bloc.cle] = { total, etapes };
  }
  return resultats;
}
