import assert from "node:assert/strict";
import test from "node:test";
import { bilanExtraction, empreinteExtraction, type PlanPossible, type StatutAvantExtraction } from "./vaccine-protocol-preflight.ts";

const plan: PlanPossible = {
  possible: true,
  vaccinations: [{ id: "vacc-1", animalId: "a1", etapeCibleId: "dose-rotavec" }],
  traitements: [{ id: "trait-1", animalId: "a2", etapeCibleId: "dose-rotavec" }],
  vaccinationsGeneriquesANeutraliser: ["generic-1"],
  traitementsDoublonsADetacher: ["doublon-1"],
  resolusAutomatiquement: 0,
};
const statut: StatutAvantExtraction = {
  animalId: "a1", statut: "PRIMO_A_FAIRE", source: "MANUEL",
  notes: "Observation gardée", brancheInitialeId: null, confirmeAt: new Date("2026-01-01T12:00:00Z"),
};
const entree = { ancienProtocoleId: "proto-legacy", medicamentId: "med-rotavec", plan, statuts: [statut],
  etapes: [{ id: "etape-old", label: "Dose unique", cycle: "INITIAL", medicamentIds: ["med-crypto", "med-rotavec"] }] };

test("le bilan annonce chaque type de modification avant de demander confirmation", () => {
  assert.deepEqual(bilanExtraction(plan, [statut], ["a1", "a1", "a2"]), {
    vaccinationsDeplacees: 1, traitementsDeplaces: 1, vaccinationsGeneriquesNeutralisees: 1,
    traitementsDoublonsDetaches: 1, statutsAnimauxRecalcules: 1, animauxAvecHistorique: 2,
  });
});
test("mêmes actes et statuts dans des ordres différents : même empreinte", () => {
  assert.equal(empreinteExtraction(entree), empreinteExtraction({
    ...entree, etapes: [{ ...entree.etapes[0], medicamentIds: ["med-rotavec", "med-crypto"] }],
  }));
});
test("ajout d'un acte ou suppression d'un doublon : nouvelle empreinte", () => {
  const avant = empreinteExtraction(entree);
  assert.notEqual(avant, empreinteExtraction({ ...entree, plan: { ...plan, vaccinations: [...plan.vaccinations, { id: "vacc-2", animalId: "a1", etapeCibleId: "dose-rotavec" }] } }));
  assert.notEqual(avant, empreinteExtraction({ ...entree, plan: { ...plan, vaccinationsGeneriquesANeutraliser: [] } }));
});
test("un statut manuel ou une étape historique modifiée rend la prévalidation caduque", () => {
  const avant = empreinteExtraction(entree);
  assert.notEqual(avant, empreinteExtraction({ ...entree, statuts: [{ ...statut, statut: "PROTOCOLE_ACQUIS" }] }));
  assert.notEqual(avant, empreinteExtraction({ ...entree, statuts: [{ ...statut, notes: "Nouveau message" }] }));
  assert.notEqual(avant, empreinteExtraction({ ...entree, etapes: [{ ...entree.etapes[0], medicamentIds: ["med-crypto"] }] }));
});
