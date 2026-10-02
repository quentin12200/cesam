/**
 * Soin ajouté à la séance vaccinale (ex. bolus minéral) : mêmes animaux, même date, même exécutant,
 * enregistré comme un Traitement sanitaire NORMAL via /api/evenements/batch. Aucun contexte
 * vaccinal n'est transmis : le produit ne devient jamais un vaccin et reste hors historique vaccinal.
 */
export interface SoinSeance {
  animalIds: readonly string[];
  date: string;
  executant: string;
  medicamentId: string;
  medicamentNom: string;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  delaiAttenteViandeJ?: number | null;
  delaiAttenteLaitJ?: number | null;
}

export function construireChargeSoin(soin: SoinSeance) {
  return {
    animalIds: [...new Set(soin.animalIds)],
    date: soin.date,
    type: "Traitement",
    symptomes: [{ libelle: "Traitement", typeEvenementId: null }],
    constatePar: soin.executant.trim() || null,
    traitements: [{
      medicamentId: soin.medicamentId,
      medicamentNom: soin.medicamentNom,
      voie: soin.voie || null,
      executant: soin.executant.trim() || null,
      dose: soin.dose ?? null,
      uniteDosage: soin.uniteDosage || null,
      doseUnique: true,
      delaiAttenteViandeJ: soin.delaiAttenteViandeJ ?? null,
      delaiAttenteLaitJ: soin.delaiAttenteLaitJ ?? null,
    }],
  };
}