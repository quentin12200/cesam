import { createHash } from "node:crypto";
import type { PlanExtractionVaccin } from "./vaccine-protocol-extraction.ts";

export type PlanPossible = Extract<PlanExtractionVaccin, { possible: true }>;
export type StatutAvantExtraction = {
  animalId: string;
  statut: string;
  source: string;
  notes: string | null;
  brancheInitialeId: string | null;
  confirmeAt: Date | null;
};

export type BilanAvantExtraction = {
  vaccinationsDeplacees: number;
  traitementsDeplaces: number;
  vaccinationsGeneriquesNeutralisees: number;
  traitementsDoublonsDetaches: number;
  statutsAnimauxRecalcules: number;
  statutsAvecDecisionOuNoteAProteger: number;
  animauxAvecHistorique: number;
};

/** Résumé strictement calculé, non mutateur, du plan affiché avant confirmation. */
export function bilanExtraction(
  plan: PlanPossible,
  statuts: readonly StatutAvantExtraction[],
  animalIdsLegacy: readonly string[],
): BilanAvantExtraction {
  return {
    vaccinationsDeplacees: plan.vaccinations.length,
    traitementsDeplaces: plan.traitements.length,
    vaccinationsGeneriquesNeutralisees: plan.vaccinationsGeneriquesANeutraliser.length,
    traitementsDoublonsDetaches: plan.traitementsDoublonsADetacher.length,
    statutsAnimauxRecalcules: statuts.length,
    statutsAvecDecisionOuNoteAProteger: statuts.filter((statut) => statut.source !== "VACCINATION" || Boolean(statut.notes?.trim())).length,
    animauxAvecHistorique: new Set(animalIdsLegacy).size,
  };
}

function ordonner<T>(values: readonly T[], serialiser: (v: T) => string) {
  return values.map(serialiser).sort();
}

/**
 * Empreinte de concurrence optimiste : si l'historique, les étapes ou les statuts
 * manuels ont évolué depuis l'analyse, la confirmation DOIT être refusée.
 *
 * Ne vaut pas approbation médicale, ni sauvegarde des statuts anciens.
 */
export function empreinteExtraction({
  ancienProtocoleId, medicamentId, plan, statuts, etapes,
}: {
  ancienProtocoleId: string;
  medicamentId: string;
  plan: PlanPossible;
  statuts: readonly StatutAvantExtraction[];
  etapes: readonly { id: string; label: string; cycle: string; medicamentIds: readonly string[] }[];
}): string {
  const empreinte = {
    ancienProtocoleId, medicamentId,
    vaccinations: ordonner(plan.vaccinations, (acte) => JSON.stringify([acte.id, acte.animalId, acte.etapeCibleId, acte.medicamentIdAEnregistrer ?? null])),
    traitements: ordonner(plan.traitements, (acte) => JSON.stringify([acte.id, acte.animalId, acte.etapeCibleId])),
    generiquesNeutralises: [...plan.vaccinationsGeneriquesANeutraliser].sort(),
    traitementsDetaches: [...plan.traitementsDoublonsADetacher].sort(),
    etapes: ordonner(etapes, (etape) => JSON.stringify([etape.id, etape.label, etape.cycle, [...etape.medicamentIds].sort()])),
    statuts: ordonner(statuts, (statut) => JSON.stringify([
      statut.animalId, statut.statut, statut.source, statut.notes, statut.brancheInitialeId,
      statut.confirmeAt?.toISOString() ?? null,
    ])),
  };
  return createHash("sha256").update(JSON.stringify(empreinte)).digest("hex");
}
